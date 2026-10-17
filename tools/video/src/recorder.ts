import { execFileSync } from 'node:child_process';
import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright';
import type { ServerMessage } from '@scamshield/shared';
import { ensureDir } from './paths.js';

// One recorded shot: a browser page whose video, WebSocket traffic and our
// own marks all share one clock, t = seconds since the video started. The
// editing agent never watches the video; it reads events.json and
// timeline.md, and pulls frames only to check a cut.

export interface ShotEvent {
  t: number;
  kind: 'ws' | 'mark' | 'audio';
  type: string;
  summary: string;
  data?: unknown;
}

export interface ShotOptions {
  name: string;
  dir: string;
  // CSS viewport, also the video size. Playwright pads rather than scales a
  // smaller page, so the default is full 1080p; zoom in at edit time.
  viewport?: { width: number; height: number };
}

export const VIDEO = { width: 1920, height: 1080 };

export class Recorder {
  readonly events: ShotEvent[] = [];
  private t0 = 0;
  private lastRisk: { action?: string; stage?: string; flags: Set<string> } = { flags: new Set() };
  private warnings = 0;
  private waiters: Array<{ test: (m: ServerMessage) => boolean; resolve: (t: number) => void }> = [];

  private constructor(
    readonly opts: ShotOptions,
    private browser: Browser,
    private context: BrowserContext,
    readonly page: Page,
  ) {}

  static async start(opts: ShotOptions): Promise<Recorder> {
    const viewport = opts.viewport ?? VIDEO;
    ensureDir(opts.dir);
    rmSync(join(opts.dir, 'raw'), { recursive: true, force: true });
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const context = await browser.newContext({
      viewport,
      recordVideo: { dir: join(opts.dir, 'raw'), size: viewport },
    });
    const page = await context.newPage();
    const rec = new Recorder(opts, browser, context, page);
    rec.t0 = Date.now();
    page.on('websocket', (ws) => {
      rec.log('ws', 'socket.open', `socket opened ${ws.url()}`);
      ws.on('framereceived', (f) => {
        if (typeof f.payload !== 'string') return;
        try {
          rec.onServer(JSON.parse(f.payload) as ServerMessage);
        } catch {
          // Not JSON; ignore.
        }
      });
    });
    return rec;
  }

  t(): number {
    return Math.round((Date.now() - this.t0) / 10) / 100;
  }

  log(kind: ShotEvent['kind'], type: string, summary: string, data?: unknown): number {
    const t = this.t();
    this.events.push({ t, kind, type, summary, data });
    console.log(`${t.toFixed(2).padStart(7)}  ${summary}`);
    return t;
  }

  mark(label: string): number {
    return this.log('mark', 'mark', `MARK ${label}`);
  }

  async wait(seconds: number): Promise<void> {
    await this.page.waitForTimeout(seconds * 1000);
  }

  // Click by accessible name (button or link), or by a locator. Animated
  // buttons (the pulsing Accept) never settle, so clicks are forced.
  async click(target: string | Locator, mark?: string): Promise<void> {
    const loc = typeof target === 'string' ? this.page.getByRole('button', { name: target, exact: true }).or(this.page.getByRole('link', { name: target, exact: true })).first() : target;
    try {
      await loc.waitFor({ state: 'visible', timeout: 20_000 });
      await loc.click({ force: true });
    } catch (err) {
      await this.dumpControls();
      throw err;
    }
    this.mark(mark ?? `click ${typeof target === 'string' ? target : 'element'}`);
  }

  async fill(selector: string, value: string, mark?: string): Promise<void> {
    await this.page.locator(selector).first().pressSequentially(value, { delay: 90 });
    this.mark(mark ?? `type "${value}" into ${selector}`);
  }

  // Resolve with t when a server message matching `test` arrives (or has
  // already arrived during this shot).
  waitFor(label: string, test: (m: ServerMessage) => boolean, timeoutSec = 120): Promise<number> {
    const seen = this.events.find((e) => e.kind === 'ws' && e.data && test(e.data as ServerMessage));
    if (seen) return Promise.resolve(seen.t);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), timeoutSec * 1000);
      this.waiters.push({ test, resolve: (t) => (clearTimeout(timer), resolve(t)) });
    });
  }

  // Seconds of the last warning clip, so a shot can let it finish.
  lastAudioSeconds(): number {
    const a = [...this.events].reverse().find((e) => e.kind === 'audio');
    return (a?.data as { seconds?: number } | undefined)?.seconds ?? 0;
  }

  async dumpControls(): Promise<void> {
    const list = await this.page
      .locator('button, a, input, [role=button]')
      .evaluateAll((els) =>
        els
          .filter((e) => (e as HTMLElement).offsetParent)
          .map((e) => `${e.tagName}[${e.getAttribute('aria-label') ?? e.getAttribute('placeholder') ?? ''}] ${(e.textContent ?? '').trim().slice(0, 40)}`),
      )
      .catch(() => []);
    console.error(`Visible controls at ${this.t()}s:\n  ${list.join('\n  ')}`);
  }

  async stop(): Promise<void> {
    const video = this.page.video();
    const duration = this.t();
    await this.context.close();
    await this.browser.close();
    const raw = await video?.path();
    const { dir, name } = this.opts;
    if (raw) renameSync(raw, join(dir, 'video.webm'));
    rmSync(join(dir, 'raw'), { recursive: true, force: true });
    writeFileSync(join(dir, 'events.json'), JSON.stringify({ shot: name, video: `shots/${name}/video.webm`, duration, events: this.events }, null, 2));
    writeFileSync(join(dir, 'timeline.md'), this.timeline(duration));
    console.log(`\nWrote shots/${name}/video.webm, events.json and timeline.md (${duration}s)`);
  }

  private onServer(m: ServerMessage): void {
    const summary = this.describe(m);
    const t = summary === null ? this.t() : this.log('ws', m.type, summary, m);
    if (summary === null) this.events.push({ t, kind: 'ws', type: m.type, summary: '', data: m });
    if (m.type === 'warning' && m.audioUrl) void this.saveAudio(m.audioUrl, t);
    this.waiters = this.waiters.filter((w) => (w.test(m) ? (w.resolve(t), false) : true));
  }

  // One line per message worth reading. Risk ticks that change nothing on
  // screen return null and are kept out of timeline.md.
  private describe(m: ServerMessage): string | null {
    switch (m.type) {
      case 'transcript':
        return `LINE "${m.text}"`;
      case 'risk': {
        const raised = Object.entries(m.flags)
          .filter(([k, v]) => (v ?? 0) >= 0.5 && !this.lastRisk.flags.has(k))
          .map(([k]) => k);
        raised.forEach((k) => this.lastRisk.flags.add(k));
        const changed = m.action !== this.lastRisk.action || m.stage !== this.lastRisk.stage;
        this.lastRisk.action = m.action;
        this.lastRisk.stage = m.stage;
        if (!changed && raised.length === 0) return null;
        const parts = [`RISK ${m.risk.toFixed(2)} action=${m.action} stage=${m.stage}`];
        if (raised.length) parts.push(`new signals: ${raised.join(', ')}`);
        return parts.join(' | ');
      }
      case 'warning':
        return `WARNING ${m.action} (${m.language})${m.audioUrl ? ' [spoken]' : ''}: "${m.text}"`;
      case 'transfer':
        return `TRANSFER ${m.status} RM${m.amountRm} to ${m.toAccount}`;
      case 'race.result':
        return `RACE ${m.entries.map((e) => `${e.scorer} ${e.ok ? `${e.latencyMs}ms` : 'failed'}`).join(', ')}`;
      case 'error':
        return `ERROR ${m.message}`;
      default:
        return m.type;
    }
  }

  private async saveAudio(url: string, t: number): Promise<void> {
    const n = ++this.warnings;
    const file = `warning-${n}.mp3`;
    const path = join(this.opts.dir, file);
    const bytes = url.startsWith('data:')
      ? Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
      : Buffer.from(await (await fetch(url)).arrayBuffer());
    writeFileSync(path, bytes);
    const seconds = Number(
      execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).toString().trim(),
    );
    this.events.push({
      t,
      kind: 'audio',
      type: 'warning.audio',
      summary: `AUDIO shots/${this.opts.name}/${file} plays ${t}s to ${(t + seconds).toFixed(2)}s (${seconds.toFixed(2)}s)`,
      data: { file: `shots/${this.opts.name}/${file}`, seconds },
    });
    console.log(`${t.toFixed(2).padStart(7)}  saved ${file} (${seconds.toFixed(2)}s)`);
  }

  private timeline(duration: number): string {
    const rows = this.events
      .filter((e) => e.summary)
      .sort((a, b) => a.t - b.t)
      .map((e) => `| ${e.t.toFixed(2)} | ${e.summary.replace(/\|/g, '/')} |`);
    return [
      `# Shot \`${this.opts.name}\``,
      '',
      `Video: \`shots/${this.opts.name}/video.webm\`, ${duration}s, 1920x1080. Times are seconds into that video.`,
      'LINE = a call line appears in the transcript. RISK = the risk meter, action or stage changed, or new signal chips appeared.',
      'WARNING = a warning was shown. AUDIO = the spoken warning, which the recording itself does not contain; place the file at that time.',
      'MARK = something the capture script did (a click, typing, a hold).',
      '',
      '| t (s) | event |',
      '| ---: | --- |',
      ...rows,
      '',
    ].join('\n');
  }
}
