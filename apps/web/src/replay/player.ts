export interface ReplayLine {
  speaker: 'caller' | 'user';
  text: string;
  // Seconds to wait after the previous line (or the start) before sending.
  delaySec: number;
}

export interface ReplayPlayerOptions {
  send(line: ReplayLine, index: number): void;
  // Read before each line, so a speed change applies from the next line on.
  getSpeed?(): number;
  // Called once after the last line is sent; not after `cancel()`.
  onDone?(): void;
}

// Sends a script's lines one by one, each after its own delay divided by the
// speed. Cancellable; knows nothing about sockets or React.
export class ReplayPlayer {
  private timer?: ReturnType<typeof setTimeout>;
  private cancelled = false;
  private started = false;

  constructor(
    private readonly lines: readonly ReplayLine[],
    private readonly opts: ReplayPlayerOptions,
  ) {}

  get running(): boolean {
    return this.started && !this.cancelled && this.timer !== undefined;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.schedule(0);
  }

  cancel(): void {
    this.cancelled = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule(index: number): void {
    const line = this.lines[index];
    if (!line) {
      this.timer = undefined;
      this.opts.onDone?.();
      return;
    }
    const speed = this.opts.getSpeed?.() ?? 1;
    const waitMs = (line.delaySec * 1000) / (speed > 0 ? speed : 1);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.cancelled) return;
      this.opts.send(line, index);
      if (this.cancelled) return;
      this.schedule(index + 1);
    }, waitMs);
  }
}
