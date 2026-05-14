# V2.2 System Map

本文档是 BattleSystem 的“系统地图”（System Map）：用工程分层视角说明当前仓库有哪些层、每层负责什么、允许/禁止依赖什么，以及修改风险与后续扩展建议。

## 工程结构总览

```text
index.html
src/core/
src/data/
src/ui/
src/dev/
tests/
docs/
tools/
```

## index.html

- 职责：浏览器沙盒入口；只负责页面结构/CSS/模块装配与 DOM 容器（canvas、debug 面板）。
- 可以依赖谁：`src/ui/`（作为 ESM 模块入口）；不应直接触达 `src/core/` 细节。
- 禁止依赖谁：不在此文件内写战斗规则；不写任何“Recovery 能否取消到 Art”之类逻辑。
- 典型文件：`index.html`
- 改动风险：低到中；改坏会导致 UI/测试中的“模块装配”失败（见 `ui-module-load.test.mjs`）。
- 后续扩展建议：保持只做装配；未来如果需要多个 sandbox 入口，建议用多个 HTML 或一个 router，但仍不把玩法写进 HTML。

## src/core/

- 职责：纯战斗核心；输入意图、动作时间轴、普攻/武技规则、取消规则、Driver Combo、事件日志与快照。
- 可以依赖谁：只依赖 `src/core/` 内模块（例如 `math.js`、`enums.js`）；允许被 `src/data/`、`src/dev/`、`src/ui/` 调用。
- 禁止依赖谁：
  - 禁止依赖 DOM / Canvas / `window` / `document` / 浏览器事件 / CSS / 渲染细节 / 具体 UI 控件。
  - 禁止把验证工具（scenario/trace）的概念写进 core 规则里（core 只提供可观察性接口：事件日志与快照）。
- 典型文件：
  - `src/core/combat-actor.js`：核心状态机 + tick + 事件发射 + snapshot
  - `src/core/action.js`：动作时间轴（Startup/Active/Recovery/Finished）与普攻链规格
  - `src/core/combat-input.js`：输入帧结构与输入缓冲（Input Buffer）
  - `src/core/driver-combo.js`：Driver Combo 状态机与事件对象产出
  - `src/core/combat-events.js`：事件格式化 + 统一 emit helper
  - `src/core/combat-event-log.js`：事件日志存储结构
  - `src/core/enums.js`：枚举（ActionPhase/ActorState/CombatEventType 等）
- 改动风险：高；任何改动都可能破坏确定性行为、测试不变量与 UI 可解释性。
- 后续扩展建议：
  - 新机制应以“独立状态模型 + 事件 + snapshot 字段 + tests/scenarios”方式接入（类似 DriverComboState）。
  - UI 只能读取 snapshot / 消费事件，不应决定战斗规则。

## src/data/

- 职责：默认数值与装配逻辑；集中管理动作参数、charge、取消窗口等默认配置，并创建可直接跑的 `CombatActor`。
- 可以依赖谁：`src/core/`；允许被 `src/ui/`、`src/dev/`、`tests/` 使用。
- 禁止依赖谁：不依赖 DOM/Canvas；不在此层写“每帧 tick”或 UI 逻辑。
- 典型文件：
  - `src/data/default-combat-config.js`：默认 ActionSpec/Arts/Actor 装配
- 改动风险：中到高；改默认数值会改变手感与测试预期（本任务禁止改默认数值）。
- 后续扩展建议：
  - V3 计划新增配置项（例如 Special/Blade 路线）应集中放在 data 层，并保持 core 通过配置驱动。

## src/ui/

- 职责：浏览器壳；键盘输入→`CombatInputFrame`、固定帧循环驱动 `actor.tick`、canvas 渲染、Debug 面板与调参/一键验证按钮。
- 可以依赖谁：`src/core/`（读取 snapshot、构造 input、调用 tick、读取事件日志）；`src/data/`（创建默认 actor）；`src/dev/`（scenario runner）。
- 禁止依赖谁：不应在 UI 中判断/实现战斗规则（尤其是取消窗口、命中判定、Driver Combo 推进）。
- 典型文件：
  - `src/ui/sandbox-app.js`：驱动 loop（fixed 60fps）、装配输入/渲染/debug
  - `src/ui/browser-input.js`：浏览器键盘输入→`CombatInputFrame`
  - `src/ui/canvas-renderer.js`：根据 snapshot 绘制画布
  - `src/ui/debug-panel.js`：读取 snapshot 渲染面板；调参 patch；运行 scenarios；发 debug 事件
- 改动风险：中；可能影响浏览器可运行性与验证可视化，但不应影响 core 规则。
- 后续扩展建议：
  - 任何新机制的 UI 展示，优先读取 snapshot 的新字段，而不是“直接读 core 内部字段”或“UI 特判规则”。

## src/dev/

- 职责：确定性验证工具层；scenario runner（脚本化步骤驱动）与 trace recorder（每帧快照+增量事件采样），用于 Node tests 与浏览器 Debug UI 的一键 Run。
- 可以依赖谁：`src/core/`（通过 actor.tick/getSnapshot/eventLog）；允许被 `tests/` 与 `src/ui/` 使用。
- 禁止依赖谁：不依赖 DOM/Canvas；不引入新玩法规则（只能验证/记录，不改变 core）。
- 典型文件：
  - `src/dev/scenario-runner.js`：step DSL + runScenario 输出 proof/trace
  - `src/dev/trace-recorder.js`：抓取 snapshot 与本帧增量事件（用于 tail）
  - `src/dev/scenarios.js`：内置场景注册表（full/wrong-order/expire-*）
  - `src/dev/demo-battle-preset.js`：一键预设战斗场景工厂（Training Brute + GreyWolf + BrownBear + FireCore + Bond Lv3），输出 `createDemoBattlePreset` / `resetDemoPreset` / 配置 spec 常量
- 改动风险：中；可能影响验证结果与 debug 面板的 PASS/FAIL 可信度，但不应改变 core。
- 后续扩展建议：
  - V3 新机制必须配套 scenarios 与 proof/trace 断言（把“手感验证”转为“可审计验证”）。

## tests/

- 职责：Node 端确定性测试；验证 core 规则边界、Driver Combo 不变量、scenario harness 行为与 UI 模块装配。
- 可以依赖谁：`src/core/`、`src/data/`、`src/dev/`；允许读取 `index.html` 做 module load smoke。
- 禁止依赖谁：不依赖浏览器 DOM（保持 Node 可跑）；不删现有测试（本任务禁止）。
- 典型文件：`tests/*.mjs`
- 改动风险：中；会影响 CI/本地验收链路（`npm test`）。
- 后续扩展建议：
  - V3 新机制优先以“事件 + snapshot + scenario”方式写测试，避免只测 UI。

## docs/

- 职责：架构/模型/验证计划/路线图与系统盘点文档；为后续版本提供可审计依据与开发入口。
- 可以依赖谁：可以引用代码文件路径与机制名；不要求与运行时绑定。
- 禁止依赖谁：不应成为“唯一真实来源”；真实规则仍以 core + tests 为准。
- 典型文件：`docs/architecture.md`、`docs/combat-model.md`、`docs/validation-plan.md`、`docs/roadmap.md`
- 改动风险：低到中；但错误文档会误导后续开发（需要保持与代码同步）。
- 后续扩展建议：
  - 进入新玩法版本前，先更新/核对 system-map / mechanics-map / event-catalog / test-coverage-map / readiness review。

## tools/

- 职责：本地辅助脚本（例如静态服务器、轻量审计脚本）。
- 可以依赖谁：可以依赖 Node 标准库或 Python 标准库；不得影响 `npm test`。
- 禁止依赖谁：不引入重型构建系统；不引入复杂 AST 分析（审计脚本保持轻量）。
- 典型文件：`tools/serve.py`
- 改动风险：低；但要避免与平台环境强耦合（保持跨平台可用）。
- 后续扩展建议：
  - 仅添加“可选”的验证工具脚本，并以独立 npm script 暴露（不挂到 `test` 主链路）。

