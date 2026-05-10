# V3 实现回顾（Special / Blade Combo / Token）

本文档反映“当前代码已实现的 V3 原型”与可验证入口，作为后续审计与扩展的基线。

明确边界：本仓库不实现 Chain Attack，也不实现 token 的 cash-out/兑现机制（只验证 token 产出与可观察性）。

## 1. V3 已实现内容（以代码为准）

### Special Gauge

- 状态：`charge(0..300)` + `readyLevel(0..3)` + `ratio`
- 充能入口：Art 命中（`onArtHit`）按 `art.specialChargeGain` 增加；whiff 不充能
- 事件：
  - `SpecialChargeChanged`
  - `SpecialBecameReady`
  - `DebugGrantSpecialReady`（调试注入）

### Special Cast

- 入口：`actor.castSpecial(specialId)`（当前由 Debug 面板按钮与 scenarios 使用，不经 `CombatInputFrame`）
- 失败原因（可审计）：unknown_special / busy / out_of_range / insufficient_level
- 成功链路：`SpecialConsumed` → `ActionStarted` → 命中帧 `SpecialHit`（同帧也会有 `ActionHit <actionId>`）

### Blade Combo Route

- 状态：`BladeComboState`（stage/framesLeft/routeId/stepIndex/expectedNext）
- 推进入口：Special 命中（`onSpecialHit`）按 `{ element, level }` 调用 `bladeCombo.apply(...)`
- 完成产物：`BladeComboFinished` 后创建 token 并发出 `TokenCreated`
- 事件：
  - `BladeComboStarted / Advanced / Failed / Expired / Finished`
  - `TokenCreated`

### Driver Combo 并行关系

- Driver Combo：由 Arts 命中推进（Break/Topple/Launch/Smash）
- Blade Combo：由 Specials 命中推进（route chain）
- 两条链并行存在，不共享 stage 字段，不互相读取推进条件（由 coexist scenario 保护）

## 2. 默认配置与示例路线（当前实现）

- 默认配置集中于 `src/data/default-combat-config.js`
- 示例元素：Fire / Water
- 示例路线：
  - `FireWaterFire`（240f）
  - steps：Fire(L1) → Water(L2) → Fire(L3)
  - 完成产出：`FireToken`

## 3. 验收证据（tests + scenarios + UI）

### Node（确定性主证据）

- `npm test` 覆盖：
  - `tests/special-gauge.test.mjs`
  - `tests/special-actor.test.mjs`
  - `tests/blade-combo.test.mjs`
  - `tests/blade-combo-scenario.test.mjs`
  - 以及 V1/V2 既有 tests（必须保持全绿）

### Browser（可观察性与装配证据）

- Debug 面板展示并支持：
  - Special Gauge / Blade Combo / Tokens 可视化
  - 一键 Run scenarios（包含 driver 与 blade 两套场景）
  - Grant Ready / Grant Special / Cast Specials 等 debug 注入入口（不依赖键盘焦点）

## 4. 保护性不变量（后续扩展必须保持）

- `src/core` 不依赖 DOM/Canvas/window/document
- V1/V2 既有普攻/武技/取消/Driver Combo 规则不变，且 tests/scenarios 必须保持通过
- “Recovery Cancel” 与 “Cancel Bonus” 概念分离
- whiff 不推进：
  - Art whiff 不推进 Driver Combo
  - Special whiff 不推进 Blade Combo

## 5. 明确不做（仓库边界）

- Chain Attack（明确排除，不纳入路线图）
- Token cash-out（兑现/破碎/消费/Full Burst 等 payoff 机制）

