import type { CallState } from '@scamshield/shared';
import type { ScoreResult, Scorer } from './types';

// ADR 2: ask the primary with a hard timeout and no retries; if it is slow or
// fails, use the fallback's answer. The fallback starts at the same time so
// its answer is usually ready by the time the primary gives up.
export class FallbackScorer implements Scorer {
  private readonly timeoutMs: number;

  constructor(
    private readonly primary: Scorer,
    private readonly fallback?: Scorer,
    opts: { timeoutMs?: number } = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? 800;
  }

  get name() {
    return this.primary.name;
  }

  async score(state: CallState, signal?: AbortSignal): Promise<ScoreResult> {
    const primaryCtl = linked(signal);
    const fallbackCtl = linked(signal);

    const primaryRun = this.primary.score(state, primaryCtl.signal);
    const fallbackRun = this.fallback?.score(state, fallbackCtl.signal);
    // The fallback may fail after we stop caring about it; don't leave that unhandled.
    fallbackRun?.catch(() => {});

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${this.primary.name} scorer timed out after ${this.timeoutMs} ms`)),
        this.timeoutMs,
      );
    });

    let primaryError: unknown;
    try {
      const result = await Promise.race([primaryRun, timedOut]);
      fallbackCtl.abort();
      return result;
    } catch (err) {
      primaryError = err;
      primaryCtl.abort();
      primaryRun.catch(() => {});
    } finally {
      clearTimeout(timer);
    }

    if (!fallbackRun) throw asError(primaryError);
    try {
      return await fallbackRun;
    } catch (fallbackError) {
      throw new Error(
        `Both scorers failed. ${this.primary.name}: ${asError(primaryError).message}; ` +
          `${this.fallback!.name}: ${asError(fallbackError).message}`,
      );
    }
  }
}

const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

// An AbortController that also aborts when the caller's signal does.
function linked(parent?: AbortSignal): AbortController {
  const ctl = new AbortController();
  if (parent?.aborted) ctl.abort(parent.reason);
  else parent?.addEventListener('abort', () => ctl.abort(parent.reason), { once: true });
  return ctl;
}
