import type { CallScript } from '@scamshield/shared';

export interface DoorRow {
  title: string;
  subtitle: string;
  scam: boolean;
}

const SUBTITLES: Record<CallScript['id'], string> = {
  'scam-ms': 'Scam · Bahasa Melayu',
  'scam-manglish': 'Scam · Manglish',
  innocent: 'Innocent · should stay quiet',
};

// One row of the front door's call list: the script title without its
// trailing "(language)", a plain subtitle, and whether it is a scam call.
export function doorRow(script: CallScript): DoorRow {
  return {
    title: script.title.replace(/\s*\([^)]*\)\s*$/, ''),
    subtitle: SUBTITLES[script.id],
    scam: script.expectedAction !== 'none',
  };
}
