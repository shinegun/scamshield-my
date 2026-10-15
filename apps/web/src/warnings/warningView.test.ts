import { describe, expect, it } from 'vitest';
import type { WarningMessage } from '../call/state';
import {
  bannerTone,
  deriveWarningView,
  dismissBanner,
  dismissOverlay,
  initialWarningUi,
  nativeStrings,
  reopenOverlay,
  warningStrings,
} from './warningView';

function warning(action: WarningMessage['action'], language = 'en', text = `${action} text`): WarningMessage {
  return { type: 'warning', action, text, language };
}

describe('deriveWarningView', () => {
  it('shows nothing when there are no warnings', () => {
    expect(deriveWarningView([], initialWarningUi)).toEqual({});
  });

  it('shows only the banner for a soft warning', () => {
    const soft = warning('soft_warning');
    const view = deriveWarningView([soft], initialWarningUi);
    expect(view.banner).toBe(soft);
    expect(view.overlay).toBeUndefined();
    expect(view.pill).toBeUndefined();
  });

  it('shows the overlay for strong after soft, banner following the latest warning', () => {
    const soft = warning('soft_warning');
    const strong = warning('strong_warning');
    const view = deriveWarningView([soft, strong], initialWarningUi);
    expect(view.overlay).toBe(strong);
    expect(view.banner).toBe(strong);
    expect(view.pill).toBeUndefined();
  });

  it('dismissing the overlay leaves the pill, and the pill reopens it', () => {
    const warnings = [warning('soft_warning'), warning('strong_warning')];
    const dismissed = dismissOverlay(initialWarningUi, warnings);
    const view = deriveWarningView(warnings, dismissed);
    expect(view.overlay).toBeUndefined();
    expect(view.pill?.warning).toBe(warnings[1]);
    expect(view.pill?.label).toBe('Scam warning');

    const reopened = deriveWarningView(warnings, reopenOverlay(dismissed));
    expect(reopened.overlay).toBe(warnings[1]);
    expect(reopened.pill).toBeUndefined();

    const again = dismissOverlay(reopenOverlay(dismissed), warnings);
    expect(deriveWarningView(warnings, again).pill).toBeDefined();
  });

  it('shows the overlay again when a hold arrives after a dismissed strong', () => {
    const strong = warning('strong_warning');
    const hold = warning('hold_transfers');
    const dismissed = dismissOverlay(initialWarningUi, [strong]);
    expect(deriveWarningView([strong], dismissed).pill?.warning).toBe(strong);
    const view = deriveWarningView([strong, hold], dismissed);
    expect(view.overlay).toBe(hold);
    expect(view.pill).toBeUndefined();
  });

  it('hides the banner once dismissed', () => {
    const warnings = [warning('soft_warning')];
    const view = deriveWarningView(warnings, dismissBanner(initialWarningUi, warnings));
    expect(view).toEqual({});
  });

  it('banner text follows the latest warning, through to hold', () => {
    const soft = warning('soft_warning', 'en', 'careful');
    const strong = warning('strong_warning', 'en', 'stop');
    const hold = warning('hold_transfers', 'en', 'held');
    expect(deriveWarningView([soft], initialWarningUi).banner?.text).toBe('careful');
    expect(deriveWarningView([soft, strong], initialWarningUi).banner?.text).toBe('stop');
    expect(deriveWarningView([soft, strong, hold], initialWarningUi).banner?.text).toBe('held');
  });

  it('a dismissed banner comes back on a higher level only', () => {
    const soft = warning('soft_warning');
    const soft2 = warning('soft_warning', 'en', 'again');
    const strong = warning('strong_warning');
    const hold = warning('hold_transfers');
    const ui = dismissBanner(initialWarningUi, [soft]);
    expect(deriveWarningView([soft, soft2], ui).banner).toBeUndefined();
    expect(deriveWarningView([soft, soft2, strong], ui).banner).toBe(strong);
    const ui2 = dismissBanner(ui, [soft, strong]);
    expect(deriveWarningView([soft, strong, strong], ui2).banner).toBeUndefined();
    expect(deriveWarningView([soft, strong, hold], ui2).banner).toBe(hold);
  });

  it('styles the banner by level: soft yellow, strong and hold red', () => {
    expect(bannerTone('soft_warning')).toBe('soft');
    expect(bannerTone('strong_warning')).toBe('strong');
    expect(bannerTone('hold_transfers')).toBe('strong');
  });

  it('tolerates stale dismissed state after warnings reset', () => {
    const stale = { ...initialWarningUi, overlaysSeen: 2 };
    expect(deriveWarningView([], stale)).toEqual({});
    expect(deriveWarningView([warning('strong_warning')], stale).pill).toBeDefined();
  });
});

describe('warningStrings', () => {
  it('uses Malay for ms languages', () => {
    const hold = warningStrings('hold_transfers', 'ms-MY');
    expect(hold.header).toBe('Pemindahan wang ditahan sementara');
    expect(hold.dismiss).toBe('Saya faham');
    expect(hold.pill).toBe('Amaran penipuan');
    expect(warningStrings('strong_warning', 'ms').header).toBe('Amaran: kemungkinan penipuan');
  });

  it('uses English otherwise', () => {
    const hold = warningStrings('hold_transfers', 'en-MY');
    expect(hold.header).toBe('Transfers paused');
    expect(hold.dismiss).toBe('I understand');
    expect(warningStrings('strong_warning', 'en').header).toBe('Warning: this looks like a scam');
  });

  it('adds the NSRC line for hold only, in both languages', () => {
    const line = 'National Scam Response Centre (NSRC): 997';
    expect(warningStrings('hold_transfers', 'ms').secondary).toBe(line);
    expect(warningStrings('hold_transfers', 'en').secondary).toBe(line);
    expect(warningStrings('strong_warning', 'en').secondary).toBeUndefined();
  });
});

describe('nativeStrings', () => {
  it('titles the card by action and language', () => {
    expect(nativeStrings('soft_warning', 'en').cardTitle).toBe('Possible scam');
    expect(nativeStrings('strong_warning', 'en').cardTitle).toBe('Likely scam');
    expect(nativeStrings('hold_transfers', 'ms').cardTitle).toBe('Kemungkinan besar penipuan');
    expect(nativeStrings('soft_warning', 'ms').cardTitle).toBe('Mungkin penipuan');
  });

  it('translates the alert labels', () => {
    expect(nativeStrings('strong_warning', 'ms').endCall).toBe('Tamatkan Panggilan');
    expect(nativeStrings('strong_warning', 'en').why).toBe('Why am I seeing this?');
  });
});
