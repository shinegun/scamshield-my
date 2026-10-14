// Drafts the replay scripts with ILMU, YTL AI Labs' Malaysian model, and
// writes them to src/scripts/. ILMU only authors the text we commit; the
// running app never calls it (ADR 8).
//
//   node --env-file=.env packages/shared/tools/draft-calls.ts
//
// Needs ILMU_API_KEY in .env. Review the output and have a native speaker read
// it before committing. Self-contained (no imports from src/) so Node can run
// it directly with its built-in type stripping.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODEL = process.env.ILMU_MODEL ?? 'ilmu-v3.1';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scripts');

// Mirrors SCAM_STAGES in src/schema.ts; the order is load-bearing.
const STAGES = [
  'authority_setup',
  'victim_framing',
  'family_pressure',
  'isolation',
  'identity_request',
  'financial_request',
] as const;
type Stage = (typeof STAGES)[number] | 'none';

interface Line {
  speaker: 'caller' | 'user';
  stage: Stage;
  delaySec: number;
  text: string;
}

async function ask(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.ilmu.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.ILMU_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.7,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`ILMU ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  return body.choices[0]?.message.content ?? '';
}

// The model may wrap JSON in prose or a code fence; take the outermost array.
function parseArray(text: string): unknown[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('no JSON array in reply');
  const value: unknown = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(value)) throw new Error('reply is not an array');
  return value;
}

function checkLines(raw: unknown[], opts: { scam: boolean; minSec: number; maxSec: number }): Line[] {
  const lines = raw.map((v, i) => {
    const l = v as Record<string, unknown>;
    if (l.speaker !== 'caller' && l.speaker !== 'user') throw new Error(`line ${i}: bad speaker`);
    if (typeof l.text !== 'string' || !l.text.trim()) throw new Error(`line ${i}: no text`);
    const delaySec = Math.round(Number(l.delaySec));
    if (!(delaySec >= 1 && delaySec <= 15)) throw new Error(`line ${i}: delaySec ${String(l.delaySec)}`);
    const stage = opts.scam ? l.stage : 'none';
    if (opts.scam && !STAGES.includes(stage as (typeof STAGES)[number])) throw new Error(`line ${i}: stage ${String(l.stage)}`);
    return { speaker: l.speaker, stage: stage as Stage, delaySec, text: l.text.trim() };
  });
  if (opts.scam) {
    const ranks = lines.map((l) => STAGES.indexOf(l.stage as (typeof STAGES)[number]));
    if (ranks.some((r, i) => i > 0 && r < ranks[i - 1]!)) throw new Error('stages go backwards');
    for (const s of STAGES) if (!lines.some((l) => l.stage === s)) throw new Error(`stage ${s} missing`);
  }
  const total = lines.reduce((sum, l) => sum + l.delaySec, 0);
  if (total < opts.minSec || total > opts.maxSec) throw new Error(`length ${total}s outside ${opts.minSec}-${opts.maxSec}s`);
  return lines;
}

async function withRetries<T>(what: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      console.error(`${what}: attempt ${attempt} failed: ${(err as Error).message}`);
      if (attempt === 4) throw err;
    }
  }
}

const SCAM_SYSTEM = `Anda penulis skrip untuk demo pendidikan anti-penipuan sebuah bank Malaysia.
Tulis dialog panggilan telefon yang realistik. Semua nama, nombor kes, nombor telefon dan jumlah wang mestilah rekaan.
Jawab dengan tatasusunan JSON sahaja, tanpa teks lain.`;

const SCAM_PROMPT = `Tulis panggilan penipuan "MCMC ke polis" dalam Bahasa Melayu standard, berdasarkan kes sebenar di Malaysia:
seorang pegawai "MCMC" memberitahu mangsa bahawa nombor telefon atas namanya didaftarkan di Sabah dan digunakan untuk mesej penipuan,
kemudian menyambungkan panggilan kepada seorang "inspektor polis" yang berkata kad pengenalan mangsa dikaitkan dengan pengubahan wang haram.

Panggilan mesti melalui enam peringkat ini, mengikut urutan, tanpa berpatah balik:
1. authority_setup: pemanggil memperkenalkan diri sebagai MCMC, kemudian menyambung kepada polis.
2. victim_framing: "inspektor" berkata identiti mangsa dicuri dan dia mahu membantu membersihkan nama mangsa.
3. family_pressure: ibu bapa atau keluarga mangsa akan disiasat; jangan beritahu sesiapa kerana ini siasatan sulit.
4. isolation: jangan letak telefon, kekal dalam talian, ugutan waran tangkap.
5. identity_request: hantar gambar kad pengenalan depan dan belakang, dan swafoto memegang IC.
6. financial_request: pindahkan semua baki ke "akaun selamat Bank Negara", kemudian bacakan nombor TAC.

Keperluan:
- 22 hingga 28 baris. Pemanggil bercakap kebanyakannya; mangsa bertanya, ragu-ragu, takut, kemudian akur.
- Setiap peringkat sekurang-kurangnya 3 baris. Baris pendek seperti percakapan telefon sebenar (1 hingga 3 ayat).
- Pemanggil menggunakan "encik"; nada formal dan meyakinkan, dengan tekanan yang semakin meningkat.
- Jangan sebut nombor telefon atau nombor kad pengenalan penuh; nombor rujukan kes dan jumlah wang boleh.
- Mangsa belum memindahkan wang apabila panggilan tamat: baris terakhir mangsa membuka aplikasi bank dan menunggu TAC, kerana demo menunjukkan bank menahan pindahan itu.
- delaySec ialah saat sebelum baris itu diucapkan (1 hingga 12). Jumlah semua delaySec antara 150 dan 180.

Format setiap elemen: {"speaker": "caller" atau "user", "stage": salah satu daripada authority_setup, victim_framing, family_pressure, isolation, identity_request, financial_request, "delaySec": nombor, "text": "..."}`;

const MANGLISH_SYSTEM = `You localise dialogue for a Malaysian bank's anti-scam education demo.
Reply with a JSON array of strings only, no other text.`;

function manglishPrompt(lines: Line[]): string {
  return `Rewrite each line of this Malay phone call in Manglish: natural Malaysian English as spoken in KL, with light particles ("ah", "lah", "kena", "one") where a Malaysian would really use them, not in every line.
Keep the meaning, the speaker's role and the pressure of each line. The caller says "sir" or "you", not "encik". Keep every invented name, case number and amount.
Return exactly ${lines.length} strings, one per input line, in the same order.

${JSON.stringify(lines.map((l) => `${l.speaker}: ${l.text}`), null, 1)}`;
}

const INNOCENT_PROMPT = `Write a genuine, innocent phone call in natural Malaysian English: a Maybank card services officer calls a customer to confirm one card transaction (an online purchase on Shopee of an invented amount under RM300).
The officer verifies only that they are speaking to the cardholder by name confirmation, never asks for an IC number, OTP, TAC, PIN, password, transfer or app install, and at the end reminds the customer that the bank will never ask for their TAC or password over the phone.
The customer is friendly, confirms the purchase, and asks one small question (for example when the parcel arrives or whether the card is still usable), which the officer answers.
Requirements: 10 to 14 lines, short like a real phone call. delaySec is the seconds before each line (1 to 10); the delaySec total must be between 55 and 80. All names and amounts invented.
Each element: {"speaker": "caller" or "user", "delaySec": number, "text": "..."}. Reply with the JSON array only.`;

function tsLines(lines: Line[]): string {
  return lines
    .map(
      (l) =>
        `    {\n      speaker: '${l.speaker}',\n      delaySec: ${l.delaySec},\n      stage: '${l.stage}',\n      text: ${JSON.stringify(l.text)},\n    },`,
    )
    .join('\n');
}

function writeScript(file: string, header: string, constName: string, meta: Record<string, unknown>, lines: Line[]) {
  const metaTs = Object.entries(meta)
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v).replace(/^"(.*)"$/, (_m, s: string) => `'${s.replace(/'/g, "\\'")}'`)},`)
    .join('\n');
  const body = `import type { CallScript } from './types';

${header}
export const ${constName}: CallScript = {
${metaTs}
  lines: [
${tsLines(lines)}
  ],
};
`;
  writeFileSync(join(OUT, file), body);
  const total = lines.reduce((s, l) => s + l.delaySec, 0);
  console.log(`wrote ${file}: ${lines.length} lines, ${total}s`);
}

if (!process.env.ILMU_API_KEY) throw new Error('Set ILMU_API_KEY in .env');

const malay = await withRetries('Malay scam', async () =>
  checkLines(parseArray(await ask(SCAM_SYSTEM, SCAM_PROMPT)), { scam: true, minSec: 140, maxSec: 190 }),
);

const manglishText = await withRetries('Manglish scam', async () => {
  const out = parseArray(await ask(MANGLISH_SYSTEM, manglishPrompt(malay)));
  if (out.length !== malay.length || out.some((t) => typeof t !== 'string' || !t.trim())) {
    throw new Error(`got ${out.length} lines, want ${malay.length}`);
  }
  // Drop a "caller: " / "user: " prefix if the model echoed it.
  return (out as string[]).map((t) => t.replace(/^(caller|user):\s*/i, '').trim());
});

const innocent = await withRetries('innocent call', async () =>
  checkLines(parseArray(await ask(MANGLISH_SYSTEM.replace('strings', 'objects'), INNOCENT_PROMPT)), {
    scam: false,
    minSec: 50,
    maxSec: 85,
  }),
);

writeScript(
  'scam-ms.ts',
  `// The MCMC-to-police call, in standard Malay. Drafted with ILMU (${MODEL}) by
// tools/draft-calls.ts, then reviewed by a native speaker.`,
  'SCAM_MS',
  {
    id: 'scam-ms',
    title: 'Panggilan "MCMC" (Bahasa Melayu)',
    summary: 'A caller from "MCMC" hands you to a "police inspector" who says your IC was used for money laundering.',
    language: 'ms-MY',
    callerKnown: false,
    callerInternational: false,
    expectedAction: 'hold_transfers',
  },
  malay,
);

writeScript(
  'scam-manglish.ts',
  `// The MCMC-to-police call, in Manglish: the Malay script line for line, with
// the same stages and timing. Localised with ILMU (${MODEL}).`,
  'SCAM_MANGLISH',
  {
    id: 'scam-manglish',
    title: '"MCMC" call (Manglish)',
    summary: 'The same scam in Malaysian English: "MCMC" hands you to a "police inspector" who wants your IC and your balance.',
    language: 'en-MY',
    callerKnown: false,
    callerInternational: false,
    expectedAction: 'hold_transfers',
  },
  malay.map((l, i) => ({ ...l, text: manglishText[i]! })),
);

writeScript(
  'innocent.ts',
  `// A real bank's fraud check. It claims authority and mentions a TAC, so it is
// the hardest innocent call: risk must stay low and a transfer must go through.
// Drafted with ILMU (${MODEL}).`,
  'INNOCENT',
  {
    id: 'innocent',
    title: 'Bank card check (innocent)',
    summary: 'Your bank calls to confirm a Shopee purchase. Nothing is asked of you, so nothing should be flagged.',
    language: 'en-MY',
    callerKnown: false,
    callerInternational: false,
    expectedAction: 'none',
  },
  innocent,
);
