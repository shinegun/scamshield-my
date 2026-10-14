import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReplayPlayer, type ReplayLine } from './player';

const LINES: ReplayLine[] = [
  { speaker: 'caller', text: 'one', delaySec: 1 },
  { speaker: 'user', text: 'two', delaySec: 4 },
  { speaker: 'caller', text: 'three', delaySec: 2 },
];

describe('ReplayPlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends lines in order after each line\'s own delay at 1x', () => {
    const sent: string[] = [];
    const onDone = vi.fn();
    new ReplayPlayer(LINES, { send: (l) => sent.push(l.text), onDone }).start();

    vi.advanceTimersByTime(999);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual(['one']);
    vi.advanceTimersByTime(3999);
    expect(sent).toEqual(['one']);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual(['one', 'two']);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(sent).toEqual(['one', 'two', 'three']);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('halves every delay at 2x', () => {
    const sent: string[] = [];
    new ReplayPlayer(LINES, { send: (l) => sent.push(l.text), getSpeed: () => 2 }).start();

    vi.advanceTimersByTime(500);
    expect(sent).toEqual(['one']);
    vi.advanceTimersByTime(2000);
    expect(sent).toEqual(['one', 'two']);
    vi.advanceTimersByTime(1000);
    expect(sent).toEqual(['one', 'two', 'three']);
  });

  it('reads the speed before each line, so a change applies to the lines after the next', () => {
    let speed = 1;
    const sent: string[] = [];
    new ReplayPlayer(LINES, { send: (l) => sent.push(l.text), getSpeed: () => speed }).start();

    vi.advanceTimersByTime(1000); // 'one' sent; the wait for 'two' (4 s) was set at 1x
    speed = 2;
    vi.advanceTimersByTime(4000);
    expect(sent).toEqual(['one', 'two']);
    vi.advanceTimersByTime(1000); // 'three' waits 2 s / 2
    expect(sent).toEqual(['one', 'two', 'three']);
  });

  it('passes the speaker, text and index to send', () => {
    const send = vi.fn();
    new ReplayPlayer(LINES, { send }).start();
    vi.advanceTimersByTime(5000);
    expect(send).toHaveBeenNthCalledWith(1, LINES[0], 0);
    expect(send).toHaveBeenNthCalledWith(2, LINES[1], 1);
  });

  it('stops sending after cancel, and does not call onDone', () => {
    const sent: string[] = [];
    const onDone = vi.fn();
    const player = new ReplayPlayer(LINES, { send: (l) => sent.push(l.text), onDone });
    player.start();

    vi.advanceTimersByTime(1000);
    expect(sent).toEqual(['one']);
    player.cancel();
    vi.advanceTimersByTime(60_000);
    expect(sent).toEqual(['one']);
    expect(onDone).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('finishes straight away with no lines', () => {
    const onDone = vi.fn();
    new ReplayPlayer([], { send: vi.fn(), onDone }).start();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
