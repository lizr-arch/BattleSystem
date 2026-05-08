# Manual Test Plan

Open `index.html` in a browser and use the right-side event log to validate the combat loop.

## Controls

```text
WASD / Arrow Keys : move
1                 : use Art1
Space             : pause / resume
R                 : reset
.                 : step one frame
```

## Cases

### 1. Stand still near the dummy

Expected:

```text
ActionStarted AA1
ActionPhaseChanged AA1 Startup->Active
ActionHit AA1 damage=10
ArtChargeChanged Art1 0->1
ActionFinished AA1
AutoAttackChainAdvanced -> AA2
```

### 2. Keep moving

Expected:

- Auto attack does not start while the actor is free.
- Art charge does not increase.

### 3. Move during startup

Expected:

- Startup is not canceled.
- The hit still fires.
- Recovery can then be canceled to movement.

### 4. Move during recovery

Expected:

```text
RecoveryCanceledToMovement AA1
```

The hit reward should remain, but the auto-attack chain should reset.

### 5. Press Art1 before it becomes ready

Expected:

- Input enters the short buffer.
- If the hit makes Art1 ready before the buffer expires, the buffered command is consumed.

### 6. Cancel Art1 during recovery

Expected:

```text
RecoveryCanceledToArt AA3 -> Art1
InputConsumed UseArt1
CancelBonusApplied Art1
ActionStarted Art1 [CANCEL]
```

### 7. Late art cancel

Expected:

- Recovery may still cancel to Art1 if the recovery window remains open.
- Cancel bonus should not apply after the bonus timer expires.
