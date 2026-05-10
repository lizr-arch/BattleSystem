# BattleSystem

浏览器优先的战斗系统验证沙盒，用来快速验证“异度之刃 2-like”的底层战斗闭环：

```text
Auto attack hit
  ↓
Art charge
  ↓
Recovery cancel
  ↓
Use art (hit)
  ↓
Driver Combo (optional)
```

## V1 目标与边界

这个仓库不是完整游戏项目，而是一个可重复验证战斗节奏的原型沙盒：

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
