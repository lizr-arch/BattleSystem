# BattleSystem

浏览器优先的战斗系统验证沙盒，用来快速验证“异度之刃 2-like”的底层战斗闭环与最小 Combo 原型。

```text
普攻命中
  ↓
Arts 充能（普攻资源）
  ↓
后摇取消（到移动 / 到 Arts）
  ↓
Arts 命中（可选：Driver Combo）
  ↓
Special Gauge 充能（由 Arts 命中驱动）
  ↓
释放 Special（命中推进 Blade Combo）
  ↓
完成路线产出 Token（仅产出，不兑现）
```

明确边界：本仓库当前阶段不实现 Chain Attack / 属性球 / Full Burst / Fusion 等 payoff 机制。
如未来进入 V4，必须先完成 Readiness Review 与拆分计划（见 `docs/v4-readiness-review.md`），且不得在同一里程碑中同时引入“大玩法 + 工程扩张”。

## V1 目标与边界

这个仓库不是完整游戏项目，而是一个可重复验证战斗节奏的原型沙盒（浏览器可跑 + Node 可重复测试）：

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
- Browser HTML visual validation loop + Node tests.

## V2 Driver Combo（已实现）

在不扩玩法的前提下，增加一层“控制链”验证（通过武技命中推进）：

```text
Break -> Topple -> Launch -> Smash
```

默认键位与 effect 绑定：

```text
1: Art1 (Break)
2: Art2 (Topple)
3: Art3 (Launch)
4: Art4 (Smash)
```

所有推进/失败/过期/完成都可通过事件日志与右侧面板观察（详见 `docs/validation-plan.md`）。

## V3 Special / Blade Combo / Token（已实现）

- Arts 命中会为 Special Gauge 充能（默认每个 Art 都有 `specialChargeGain`）。
- Special 有等级（L1~L3）与消耗；释放成功会记录消费与命中事件。
- Special 命中会推进 Blade Combo 路线（默认示例路线：`Fire(L1) -> Water(L2) -> Fire(L3)`）。
- 路线完成后会创建一个 Token 并记录 `TokenCreated`（当前仅用于“延迟奖励输入”的可观察性验证，不包含兑现机制）。

## V3.1 文档同步与验收口径（已实现）

V3.1 不新增玩法实现，只做“文档同步 + 可观察性验收口径对齐”，用于避免后续扩展时出现规则漂移：

- README / AGENTS / docs 路线图与验收计划对齐。
- 明确 V4 的预研内容只允许以 Readiness Review + 拆分计划形式进入仓库（不直接落玩法）。

## V4 Chain Attack 预研（未来，仅文档）

V4 预研的目标是把未来可能的 Chain Attack / Orbs / Full Burst / Fusion 机制拆成“可观察、可测试、可分阶段落地”的计划，而不是在当前仓库直接实现大玩法。
详见 `docs/v4-readiness-review.md`。

## V1 目录结构

```text
index.html              模块装配入口（不再塞战斗逻辑）
src/core/               纯战斗核心：不依赖 DOM / Canvas
src/data/               默认数值与配置装配
src/ui/                 浏览器输入、Canvas 渲染、Debug 面板、沙盒 App
src/dev/                纯逻辑验证工具：scenario runner、trace recorder、内置 scenarios
tests/                  Node 可重复测试
docs/                   架构与模型说明
tools/serve.py          本地静态服务（可选）
```

## Run

推荐两种方式：

1) 直接用浏览器打开 `index.html`。
2) 起本地静态服务：

```bash
npm start
```

Controls:

```text
WASD / Arrow Keys : move
1/2/3/4           : use Art1/Art2/Art3/Art4
Space             : pause / resume
R                 : reset
.                 : step one frame
```

Special/Blade/Scenario 建议通过右侧 Debug 面板按钮验证（不依赖键盘焦点）。

## Test

```text
npm test
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
- `docs/system-map.md`
- `docs/mechanics-map.md`
- `docs/event-catalog.md`
- `docs/test-coverage-map.md`
- `docs/v3-readiness-review.md`
- `docs/v4-readiness-review.md`
