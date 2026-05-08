# BattleSystem

Browser-first combat-system prototype for quickly validating a Xenoblade Chronicles 2-like bottom combat loop:

```text
Auto attack hit
  ↓
Art charge
  ↓
Recovery cancel
  ↓
Use art
```

## Current scope

This repository starts as a lightweight architecture and validation sandbox, not a full game.

Implemented / planned in the first browser prototype:

- Fixed-frame combat simulation.
- Player movement intent.
- Auto attack chain: `AA1 -> AA2 -> AA3`.
- Action phases: `Startup / Active / Recovery / Finished`.
- `Startup` cannot be soft-canceled by movement or art input.
- `Active` fires hit events and art charge.
- `Recovery` can be canceled into movement or ready arts.
- Short art input buffer.
- Cancel bonus window after hit.
- Browser HTML visual validation loop.

## Run

Open `index.html` directly in a browser.

Controls:

```text
WASD / Arrow Keys : move
1                 : use Art1
Space             : pause / resume
R                 : reset
```

## Architecture direction

```text
InputFrame
  ↓
InputBuffer
  ↓
CombatActor / State Machine
  ↓
Action Timeline
  ↓
Hit / Charge / Cancel / Art Events
  ↓
Browser Canvas Debug View
```

## Design notes

- Movement is a combat input, not just locomotion.
- Movement blocks auto-attack startup when the actor is free.
- Once an attack enters startup, normal movement cannot soft-cancel it.
- Recovery cancel and cancel bonus are separate concepts.
- All important decisions should be observable through logs or debug UI.

## Next steps

See:

- `docs/architecture.md`
- `docs/validation-plan.md`
- `docs/roadmap.md`
