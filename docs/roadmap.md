# Roadmap

BattleSystem will grow from a browser validation sandbox into a reusable combat-system core.

## V0: Auto attack and art loop

Status: done (baseline loop validated).

Scope:

- Browser single-file sandbox.
- Fixed-frame simulation.
- Movement intent.
- Auto-attack chain.
- Startup / Active / Recovery action phases.
- Art charge.
- Input buffer.
- Recovery cancel.
- Cancel bonus.
- Event log and debug UI.

Success criteria:

- `index.html` can run directly in a browser.
- A player can validate the base loop against a target dummy.
- Key transitions are visible through the event log.

## V1: Modular combat core

Status: done (module split landed on main).

Split the browser prototype into modules:

```text
src/core/
src/data/
src/ui/
tests/
```

Goals:

- Keep combat logic independent from DOM and Canvas.
- Add deterministic input-script replay tests.
- Add config-driven action data.

## V2: Driver combo prototype

Add the first control-chain layer:

```text
Break -> Topple -> Launch -> Smash
```

Goals:

- Art effects can apply combat statuses.
- Status duration can be extended or consumed.
- Combat log can prove every transition.

## V3: Special / blade combo prototype

Add special gauge and elemental route validation.

Goals:

- Arts charge specials.
- Specials advance a route.
- Successful route produces a delayed reward token.

## V4: Chain attack prototype

Add delayed reward cash-out.

Goals:

- Tokens can be broken during a chain attack.
- Breaking tokens extends the attack sequence.
- Full-burst style payoff can be tuned.

## Engineering principles

- No opaque magic in combat rules.
- Every major state transition must be inspectable.
- Data should drive action timing and cancel permissions.
- Browser validation comes before production animation.
