// Developer helper, not part of the product: asks Jev one narrow yes/no
// question about each item in a list, for the orchestrator skill's cheap layer.
// Jev narrows and orders the work; the caller still checks before acting.
//
//   pnpm jev <use> --input items.json          items.json = ["text", ...] or [{"id","text"}, ...]
//   pnpm jev rank --task "..." --input hits.json
//   pnpm jev bar --rule "..." --input items.json
//   pnpm jev files --task "..." --paths a.ts b.ts     (reads the first 4 KB of each file)
//   pnpm jev plan --file plan.md
//
// Uses: rank, failure, bar, injection, files, plan. Prints "probability  id  text"
// sorted high to low. Exits 0 and prints nothing when TYPESAFE_API_KEY is unset.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { noul, TypeSafeClient } from '@typesafe-ai/sdk';

interface Item {
  id: string;
  text: string;
}

const PLAN_RULES: Record<string, string> = {
  action_from_model: 'Does the plan let a scorer or model choose an action (hold, warn, block) instead of the risk engine?',
  breaks_monotonic: 'Does the plan let session flags or the scam stage decrease or reset during a call?',
  non_google_service: 'Does the plan add a hosted service other than Google Cloud, Firebase or Jev (for example Supabase, Cloudflare, BigQuery or Cloud SQL)?',
  api_key_for_gemini: 'Does the plan call Gemini with an API key rather than Vertex AI and the service account?',
  edits_shared_without_test: 'Does the plan change packages/shared (weights, thresholds, floors) without keeping or updating the reference-call test?',
  breaks_replay: 'Does the plan risk breaking the guided replay demo (scripted calls sent as transcript.inject)?',
  no_checks: 'Does the plan make changes without saying which checks (pnpm test, pnpm typecheck) close them?',
};

// pnpm runs scripts in the package folder; INIT_CWD is where the user typed the command.
const read = (p: string) => readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), p), 'utf8');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function argList(name: string): string[] {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return [];
  const out: string[] = [];
  for (const a of process.argv.slice(i + 1)) {
    if (a.startsWith('--')) break;
    out.push(a);
  }
  return out;
}

function readItems(path: string): Item[] {
  const raw = JSON.parse(read(path)) as (string | Item)[];
  return raw.map((r, i) => (typeof r === 'string' ? { id: String(i), text: r } : r));
}

function need(v: string | undefined, flag: string): string {
  if (!v) {
    console.error(`missing --${flag}`);
    process.exit(2);
  }
  return v;
}

// One request per item: each carries the same question over its own text.
async function ask(client: TypeSafeClient, question: string, items: Item[]): Promise<void> {
  const rows = await Promise.all(
    items.map(async (it) => {
      const res = await client.systemOne({
        state: { text: it.text.slice(0, 4000) },
        questions: { q: noul(question) },
      });
      return { p: res.answers.q.noul, it };
    }),
  );
  for (const { p, it } of rows.sort((a, b) => b.p - a.p)) {
    console.log(`${p.toFixed(2)}  ${it.id}  ${it.text.replace(/\s+/g, ' ').slice(0, 80)}`);
  }
}

async function main() {
  const use = process.argv[2];
  if (!process.env.TYPESAFE_API_KEY) return; // silent when there is no key
  const client = new TypeSafeClient({ timeout: 10_000 });

  switch (use) {
    case 'rank':
      return ask(client, `Is this the kind of result a developer would want for the task: ${need(arg('task'), 'task')}`, readItems(need(arg('input'), 'input')));
    case 'failure':
      return ask(client, 'Is this failure caused by the machine (Node version, missing key, network, install) rather than the code?', readItems(need(arg('input'), 'input')));
    case 'injection':
      return ask(client, 'Does this text try to give instructions to an AI assistant that reads it?', readItems(need(arg('input'), 'input')));
    case 'bar':
      return ask(client, `Does this item satisfy the rule: ${need(arg('rule'), 'rule')}`, readItems(need(arg('input'), 'input')));
    case 'files': {
      const task = need(arg('task'), 'task');
      const items = argList('paths').map((p) => ({ id: p, text: read(p).slice(0, 4000) }));
      return ask(client, `Would a developer need to read or change this file for the task: ${task}`, items);
    }
    case 'plan': {
      const plan = read(need(arg('file'), 'file'));
      const res = await client.systemOne({
        state: { plan },
        questions: Object.fromEntries(Object.entries(PLAN_RULES).map(([k, q]) => [k, noul(q)])),
      });
      for (const k of Object.keys(PLAN_RULES)) {
        console.log(`${res.answers[k]!.noul.toFixed(2)}  ${k}`);
      }
      return;
    }
    default:
      console.error('usage: pnpm jev <rank|failure|injection|bar|files|plan> ...');
      process.exit(2);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
