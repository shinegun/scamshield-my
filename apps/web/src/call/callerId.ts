import type { CallScript } from '@scamshield/shared';

export interface CallerId {
  number: string;
  place: string;
}

// The scripts carry no caller number, so the web app shows a fixed made-up
// one per script. Display only; packages/shared stays as it is.
const CALLER_IDS: Record<CallScript['id'], CallerId> = {
  'scam-ms': { number: '+60 3-2611 4402', place: 'Kuala Lumpur' },
  'scam-manglish': { number: '+60 3-2611 4402', place: 'Kuala Lumpur' },
  innocent: { number: '+60 3-7955 1300', place: 'Petaling Jaya' },
};

export const callerIdOf = (script: CallScript | undefined): CallerId | undefined =>
  script ? CALLER_IDS[script.id] : undefined;
