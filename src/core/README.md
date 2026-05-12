# Core Combat Module

This directory contains the pure combat-system core. It must remain independent from DOM, Canvas, Unity, and animation systems.

```text
src/core/
  action.js              ActionSpec / ActionInstance
  art.js                 Art charge and consume logic
  combat-actor.js        State machine owner
  combat-input.js        Input frame and command buffer
  combat-event-log.js    Observable event log
  enemy-strike.js        EnemyStrike spec and runtime state
  enums.js               State / phase / event enums
  math.js                Small vector helpers
```

## Required invariants

- Input expresses intent; it does not directly mutate combat state.
- Startup cannot be soft-canceled by ordinary movement or art input.
- Active fires hit logic exactly once.
- Recovery cancel and cancel bonus are separate mechanisms.
- Every significant state transition should be visible through an event log.
