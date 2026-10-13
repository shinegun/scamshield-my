---
name: orchestrator
description: Run a task as an orchestrator, where the main session (Opus) plans, decides and reviews while Sonnet and Haiku subagents do the searching, implementing and command-running. Use this for any build task in this repo with more than one step or more than a couple of files, such as building a feature, scaffolding a package, wiring a service, a refactor, or a bake-off, and whenever the user says "orchestrate", "delegate", "use subagents", "split this up", or asks to save usage. Skip it for one-file edits and quick questions.
---

# Orchestrator

The main session is the expensive model. Spend it on what needs judgment: breaking the task down, deciding the design, writing briefs and reviewing what comes back. Hand the rest to cheaper subagents through the Agent tool, setting `model` on each call.

Invoking this skill is the user's request to spawn subagents.

## 1. Decide whether to delegate at all

A subagent starts cold. It re-reads files and re-learns context the main session already has, so delegating small work costs more than doing it. Do the work inline when it is one file, a few lines, or something already fully in context. Delegate when the work is large enough that the brief is much shorter than the work, or when several pieces can run at once.

## 2. Split the task

Break the task into pieces that each have one clear outcome and a way to check it. Then sort them:

- **Dependent pieces** run in order. Anything that changes a shared contract goes first, and the main session does it, because every later brief is written against it. In this repo that means `packages/shared` (`schema.ts`, `risk.ts`, `events.ts`).
- **Independent pieces** are spawned together in one message so they run in parallel. Two subagents must not write the same files; if they might, run them in order or give each `isolation: "worktree"`.

Tell the user the split and the model for each piece in a few lines, then start. Do not wait for approval unless a piece is a real design choice the user has not made.

## 3. Pick the model

| Model | Use for | Examples |
| --- | --- | --- |
| `haiku` | Work with one right answer and no design in it | Finding where something is used, reading docs for a specific fact, running tests and reporting failures, renames, boilerplate from an exact template, summarising a log |
| `sonnet` | Implementation where the design is already decided | Building a module against a written interface, writing tests for existing behaviour, a React screen from a described layout, a refactor with a stated end state |
| main session (Opus) | Judgment, and anything where a mistake is expensive | Interfaces and data shapes, changes to `packages/shared`, anything an ADR constrains, weights and thresholds in the risk engine, debugging that has already beaten a subagent, final review |

For searches use `subagent_type: "Explore"` with `model: "haiku"`. When unsure between two models, start with the cheaper one; a failed Haiku run costs little.

If a subagent fails or returns poor work, send it one correction with SendMessage. If that fails too, move up one model or take the piece back. Do not loop.

## 4. Write the brief

The subagent sees CLAUDE.md and the repo, and nothing from this conversation. A brief that leaves out a decision made here will get that decision remade, often differently. Each brief states:

1. **Outcome**: what exists when it is done, in one or two sentences.
2. **Where**: the files to create or change, and the files to read first.
3. **Decided already**: interfaces, types, names and library choices, pasted in full where short. Name the ADR if one applies.
4. **Out of bounds**: files and packages not to touch. Always include "do not change `packages/shared`; report back if it needs to change".
5. **Done when**: the command that must pass, e.g. `pnpm --filter <pkg> test` and `pnpm typecheck`.
6. **Report**: what to send back, with a length limit.

Ask for a short report: what changed (file paths), the result of the check command, and anything it was unsure about or did differently from the brief. The report lands in the main session's context, so a long one spends the tokens the delegation was meant to save. Never ask for file contents back; read the diff instead.

Example:

```
Agent(
  description: "Build Gemini scorer",
  model: "sonnet",
  prompt: """
Build the Gemini scorer for the pipeline.

Outcome: services/pipeline/src/scorers/gemini.ts exports `geminiScorer`, which
implements the `Scorer` interface in services/pipeline/src/scorers/types.ts.

Read first: packages/shared/src/schema.ts, docs/adr/0002-scorer.md.

Decided already:
- It takes a CallState and returns a Decision; both types come from @scamshield/shared.
- Model: Gemini Flash-Lite with structured output. Build the response schema from
  RED_FLAGS, SCAM_STAGES and SCAM_TYPES, and send each flag's `question` verbatim.
- The scorer returns flags, stage and type only. It never picks an action (ADR 6).
- Call Gemini through Vertex AI with application default credentials (ADR 8); no API key.

Out of bounds: do not change packages/shared; report back if it needs to change.
Do not add other scorers or wire this into the WebSocket handler.

Done when: `pnpm --filter @scamshield/pipeline test` and `pnpm typecheck` pass,
with a unit test that mocks the API and checks a response maps to a valid Decision.

Report, under 150 words: files changed, test and typecheck result, and anything
you were unsure about or did differently from this brief.
"""
)
```

## 5. Review and integrate

A subagent's report says what it meant to do. Check what it did:

- Read the diff (`git diff --stat`, then the parts that matter). Reading a diff is far cheaper than writing the code.
- Run `pnpm test` and `pnpm typecheck` in the main session after each batch, since parallel pieces can each pass alone and break together.
- Check the piece against the brief's "decided already" and "out of bounds" lines, and against the ADR rules in CLAUDE.md.

Fix small problems inline. Send larger ones back to the same subagent with SendMessage so it keeps its context, rather than spawning a new one.

## 6. Report to the user

Finish with what was built, what was verified and how, and anything left open. Mention which pieces went to which model only if the user asks or something went wrong with one.
