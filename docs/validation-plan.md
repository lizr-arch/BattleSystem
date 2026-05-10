# Validation Plan (V1)

This document defines the validation cases for the browser combat sandbox and the corresponding Node replay tests.

## Goal

Validate the core loop before adding full character animation, enemy AI, party mechanics, blade combos, or chain attacks.

```text
Auto attack hit
  ↓
Art charge
  ↓
Recovery cancel
  ↓
Use art
```

## Manual test matrix

| Case | Player action | Expected result |
| --- | --- | --- |
| Stand still near dummy | Stop moving inside auto range | Auto attack chain starts: `AA1 -> AA2 -> AA3` |
| Keep moving | Hold movement input | Auto attack does not start while actor is free |
| Move during startup | Start `AA1`, then hold movement before hit | Startup is not canceled; hit still fires; recovery can then be canceled |
| Move during recovery | Move after hit | Hit reward is kept; recovery cancels to locomotion; auto chain resets |
| Early art input | Press `1` shortly before hit makes Art1 ready | Input buffer is consumed during recovery; Art1 starts |
| Cancel bonus | Use Art1 inside cancel bonus window | Art damage receives bonus |
| Late art cancel | Use Art1 during recovery after bonus expires | Recovery cancel can still occur, but no bonus |

## Debug signals

Use the right-side UI and event log to inspect:

- Current state.
- Current action.
- Current phase.
- Action timeline progress.
- Art charge.
- Cancel bonus window.
- Input buffer window.

Expected events include:

```text
ActionStarted AA1
ActionPhaseChanged AA1 Startup->Active
ActionHit AA1 damage=10
ArtChargeChanged Art1 0->1
CancelBonusWindowOpened 15f
RecoveryCanceledToMovement AA1
RecoveryCanceledToArt AA3 -> Art1
CancelBonusApplied Art1
ActionHit Art1 damage=84 [bonus]
```

## Acceptance criteria for V1

- The sandbox can be opened directly through `index.html` (no build step).
- `src/core` remains pure and independent from DOM / Canvas.
- `npm test` passes on Node.
- The user can reproduce each test case above through keyboard input.
- Every important state transition is visible in the event log.
- Movement, art input, startup lock, active hit, recovery cancel, and cancel bonus can be observed separately.

## Automated tests

`tests/` covers the core invariants:

- Timing boundaries for action phases.
- Standing in range starts `AA1`.
- Continuous movement blocks auto attack and charge gain.
- Startup cannot be soft-canceled by movement.
- Active hit produces art charge.
- Recovery can be canceled into movement, keeping hit reward.
- Ready Art can be consumed during recovery cancel.
- Cancel bonus applies inside its window.

## Non-goals for V1
- Final animation.
- Complex enemy AI.
- Party member AI.
- Blade combo.
- Driver combo.
- Chain attack.
- Damage formula balance.
