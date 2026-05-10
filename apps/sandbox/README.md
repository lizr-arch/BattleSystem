# Browser Sandbox

The current browser sandbox is available at the repository root:

```text
index.html
```

Open it directly in a browser to validate the V1 combat loop (module-assembled, no build step).

## Purpose

This sandbox is not the final game client. It is a fast visual validation tool for:

- Movement intent.
- Auto-attack startup / active / recovery phases.
- Art charge.
- Input buffering.
- Recovery cancel to movement.
- Recovery cancel to art.
- Cancel bonus timing.
- Event-log based debugging.

## Notes

The sandbox is intentionally lightweight: `src/core` holds the pure combat model, and `src/ui` provides browser input + Canvas rendering + debug panel.
