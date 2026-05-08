# Browser Sandbox

The current browser sandbox is available at the repository root:

```text
index.html
```

Open it directly in a browser to validate the V0 combat loop.

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

## Future layout

The next modular version can move the root sandbox into:

```text
apps/sandbox/index.html
apps/sandbox/main.js
apps/sandbox/styles.css
```

For V0, the root `index.html` remains self-contained so it can run without a build step.
