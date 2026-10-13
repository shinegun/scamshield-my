# 6. Code, not the model, turns flags into actions

- Status: Accepted
- Date: 2026-10-12

## Context

The scorer returns a scam stage, a scam type and a probability for each of 13 red flags. A bank needs to set its own thresholds and explain each decision to a regulator. A scam call can run for hours, and the handoff at minute 5 still matters at hour 3.

## Decision

`packages/shared/src/risk.ts` owns every action. The model never chooses one.

- **Memory.** Each flag keeps its peak probability for the call, and the stage never moves backwards.
- **Score.** Flags combine by noisy-OR: `risk = 1 − Π(1 − weight × probability)`. Several weak flags add up; one weak flag alone stays low.
- **Thresholds.** Soft warning at 0.40, strong warning at 0.70, transfers held at 0.85. Tunable per bank.
- **Floors.** Identity requested: at least a strong warning. Money requested: transfers held. Unknown number for over an hour: at least a soft warning.

## Not in the original plan

- **The weights are hand-tuned.** They were set so the real MCMC-to-police call escalates stage by stage as the plan's table says. They are starting values until we have a test set.
- **The hold floor at the financial stage** is new. The plan only listed floors for the identity stage and for long calls.

## Consequences

- Peak memory means one false-positive tick sticks for the rest of the call. If this shows up in testing, add decay.
- Changing a weight or threshold is a one-line change with a test that shows the effect on the reference call.
- The same module runs in the pipeline and can run in the web app, so both always agree on the action.
