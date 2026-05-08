# Core Combat Module

This directory is reserved for the pure combat-system core.

The first remote version keeps the runnable browser sandbox in `index.html` so that the combat loop can be validated immediately from GitHub.

The next extraction step is to move the inline logic from `index.html` into modules with this target shape:

```text
src/core/
  action.js              ActionSpec / ActionInstance
  art.js                 Art charge and consume logic
  combat-actor.js        State machine owner
  combat-input.js        Input frame and command buffer
  combat-event-log.js    Observable event log
  enums.js               State / phase / event enums
  math.js                Small vector helpers
```

The core must remain independent from DOM, Canvas, Unity, and animation systems.

## Required invariants

- Input expresses intent; it does not directly mutate combat state.
- Startup cannot be soft-canceled by ordinary movement or art input.
- Active fires hit logic exactly once.
- Recovery cancel and cancel bonus are separate mechanisms.
- Every significant state transition should be visible through an event log.
