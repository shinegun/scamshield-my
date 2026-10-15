import { describe, expect, it } from 'vitest';
import type { WarningMessage } from '../call/state';
import { muteLabel, nextSpoken } from './speak';

function w(action: WarningMessage['action'], audioUrl?: string): WarningMessage {
  return { type: 'warning', action, text: 't', language: 'en', ...(audioUrl ? { audioUrl } : {}) };
}

describe('nextSpoken', () => {
  it('plays nothing for no warnings or a soft warning', () => {
    expect(nextSpoken([], 0)).toEqual({ play: undefined, handled: 0 });
    expect(nextSpoken([w('soft_warning', 'data:soft')], 0)).toEqual({ play: undefined, handled: 1 });
  });

  it('plays a new strong warning once', () => {
    const warnings = [w('soft_warning'), w('strong_warning', 'data:strong')];
    const first = nextSpoken(warnings, 1);
    expect(first).toEqual({ play: 'data:strong', handled: 2 });
    // Re-rendering with the same warnings does not play it again.
    expect(nextSpoken(warnings, first.handled).play).toBeUndefined();
  });

  it('plays the hold clip when it follows the strong one', () => {
    const warnings = [w('strong_warning', 'data:strong'), w('hold_transfers', 'data:hold')];
    expect(nextSpoken(warnings, 1).play).toBe('data:hold');
  });

  it('plays only the newest when several arrive at once', () => {
    const warnings = [w('strong_warning', 'data:strong'), w('hold_transfers', 'data:hold')];
    expect(nextSpoken(warnings, 0).play).toBe('data:hold');
  });

  it('stays silent when a warning has no audio', () => {
    expect(nextSpoken([w('strong_warning')], 0)).toEqual({ play: undefined, handled: 1 });
  });

  it('does not replay warnings already handled', () => {
    expect(nextSpoken([w('strong_warning', 'data:strong')], 1).play).toBeUndefined();
  });
});

describe('muteLabel', () => {
  it('follows the call language', () => {
    expect(muteLabel(false, 'ms-MY')).toBe('Senyap');
    expect(muteLabel(false, 'en-MY')).toBe('Mute');
    expect(muteLabel(true, 'en')).toBe('Unmute');
  });
});
