# 路线图（Roadmap）

BattleSystem 会从“浏览器验证沙盒”逐步长成可复用的战斗核心。每个阶段都优先保证：可解释、可验证、可测试。

## V0：普攻 + 武技闭环（完成）

状态：完成（基础闭环已验证）

范围：

- 浏览器单页验证沙盒。
- 固定帧模拟（60 FPS）。
- 移动意图输入。
- 普攻链：`AA1 -> AA2 -> AA3`。
- 统一动作阶段：`Startup / Active / Recovery / Finished`。
- 武技充能与消费。
- 输入缓冲。
- 后摇取消（到移动 / 到武技）。
- Cancel Bonus 窗口。
- 事件日志 + Debug UI。

验收：

- `index.html` 可直接在浏览器运行（无构建步骤）。
- 玩家可对着木桩复现闭环节奏。
- 关键转移能通过事件日志被证明。

## V1：模块化战斗核心（完成）

状态：完成（模块拆分已落地）

范围：

```text
src/core/   纯逻辑核心（不依赖 DOM/Canvas）
src/data/   默认数值与装配
src/ui/     浏览器输入/渲染/调试 UI
tests/      Node 可重复测试
```

目标：

- 保持战斗规则与浏览器壳解耦。
- 增加可重复回放/时序边界相关测试。
- 让数值与动作参数由配置驱动。

## V2：Driver Combo 原型（完成）

状态：完成（状态模型 + 事件 + 最小 UI/测试已落地）

新增控制链层（通过武技命中推进）：

```text
Break -> Topple -> Launch -> Smash
```

范围：

- core 层实现 Driver Combo 状态机（stage + 剩余帧数）。
- Art 命中时挂载 effect（`Break/Topple/Launch/Smash`）推进状态。
- 每次推进/失败/超时/完成均产生日志事件，便于验证。
- 浏览器 Debug 面板展示当前 stage 与剩余时间；Smash 成功有显式提示。

验收：

- 通过 `1/2/3/4` 的顺序输入可稳定推进并完成 Smash。
- 错序输入产出 `DriverComboFailed`，且不改变 stage（可通过日志证明）。
- 超时产出 `DriverComboExpired`，stage 回到 None（可通过日志证明）。
- `npm test` 覆盖并通过 Driver Combo 的关键不变量。

## V2.1：Observability Validation Harness（完成）

状态：完成（scenario runner + trace + Debug UI 按钮已落地）

背景：

- 浏览器里用键盘 `1/2/3/4` 验证 Driver Combo 在自动化/AI 环境下不稳定（焦点、one-shot、buffer 窗口、Recovery 消费窗口等）。

范围：

- 新增纯逻辑 `scenario runner`（不依赖 DOM/Canvas），用 `tick(CombatInputFrame)` 驱动并输出 proof + trace。
- 内置 scenarios：full-driver-combo / wrong-order-smash / expire-break / expire-topple。
- Debug UI 增加一键 Run 按钮与 PASS/FAIL + proof 摘要展示；提供 Debug Input（Grant Ready / Cast Art1~4 / Step To Recovery），不依赖键盘焦点。
- Node 测试覆盖 scenario runner 与 Driver Combo scenarios（`npm test` 通过）。

验收：

- core deterministic tests 是主验收；scenario runner 是机制链路验收；browser smoke 是 UI/加载验收；键盘 playtest 仅补充。
- 点击 Run Full Combo 可稳定 PASS，且 proof/日志能解释每一次推进/失败/过期/完成。

## V2.1.1：UI polish（完成）

状态：完成（Driver Combo 面板绑定与 Scenario 观察体验已补强）

范围：

- Driver Combo Stage/Timer 面板绑定与刷新保持稳定。
- Scenario Run 后保持 paused，便于观察画布状态。
- 文档路线图状态与实现保持同步。

验收：

- 浏览器中一键 Run scenarios 后，画布停留在可观察状态（paused）。
- Driver Combo stage/timer 与事件日志保持一致（可通过面板与日志共同证明）。

## V2.2：System Map and Mechanic Inventory（完成）

状态：完成（系统地图/机制盘点/事件目录/测试覆盖图/Readiness Review 已落地）

目标：

- 在进入 V3 前完成架构审计与系统资产盘点。
- 明确当前机制、事件、状态、测试覆盖与未来接入点，形成可审计文档。

交付物：

- `docs/system-map.md`
- `docs/mechanics-map.md`
- `docs/event-catalog.md`
- `docs/test-coverage-map.md`
- `docs/v3-readiness-review.md`

## V3：Special / Blade Combo / Token 原型（完成）

状态：完成（core + events + scenarios/tests + 最小 UI 可观察性）

范围：

- Special Gauge（资源条）：
  - Arts 命中会按配置为 gauge 充能（示例默认：Art1~4 分别 +25/+25/+30/+40）。
  - 阈值：100/200/300，对应 readyLevel：L1/L2/L3。
- Special（必杀）：
  - 释放时检查等级是否足够；不足会失败并记录原因；足够会消耗并进入动作时序。
  - 命中会产出 `SpecialHit`，并作为 Blade Combo 的推进输入。
- Blade Combo（路线链）：
  - Specials 命中推进路线（示例默认路线：`Fire(L1) -> Water(L2) -> Fire(L3)`）。
  - 错元素/等级不足会失败但不推进；倒计时归零会过期回 None。
- Token（延迟奖励输入）：
  - 路线完成会产出一个 Token 并记录 `TokenCreated`（当前仅“产出与可观察性验证”，不含兑现机制）。
- 验收入口：
  - Node：`npm test`（包含 Special/Blade/Token 相关 tests 与 scenarios）。
  - Browser：右侧 Debug 面板展示 gauge/route/tokens，并提供一键 Run scenarios 与 debug buttons（不依赖键盘焦点）。

## V3.1：文档同步 + 可观察性验收口径（当前/完成）

状态：当前（本任务完成后视为完成；不新增玩法实现）

范围：

- README / AGENTS / docs 的路线图、验证计划、机制图、测试覆盖图保持一致。
- 明确 V4 的预研入口与拆分规则（先文档与验收资产，后最小原型）。
- 新增 `docs/v4-readiness-review.md`（V4 的唯一入口文档）。

验收：

- 文档之间不互相矛盾（边界、非目标、路线阶段一致）。
- `npm test` 仍通过；浏览器入口不受影响。

## V4：Chain Attack / Orbs / Full Burst / Fusion（未来，必须拆分）

说明：V4 只在完成 Readiness Review 与拆分计划后才允许进入实现阶段；禁止一次性引入大玩法与工程扩张。

- V4.0（文档与验收资产）：机制拆解、事件目录草案、tests/scenarios 计划、风险与拆分里程碑。
- V4.1（最小原型）：最小闭环 + 可观察性（事件/快照/trace），不做数值平衡与复杂表现。
- V4.2（工具与可视化）：补齐 Debug UI、场景按钮、proof/trace 体验与覆盖矩阵。

## 明确不做（当前版本边界：<= V3.1）

- Chain Attack / 属性球 / Full Burst / Fusion（当前不做；如未来进入 V4，必须按 Readiness Review 拆分里程碑推进）。
- Token cash-out（当前只验证 token 的产出与可观察性；兑现/破碎/消耗等 payoff 机制需等待 V4 拆分评审）。

## 工程原则

- 战斗规则不允许“黑盒魔法”，必须可解释。
- 任何重要状态变化必须可被观察（日志/快照/可视化）。
- 动作时序与取消权限由数据驱动，而不是 UI 特判。
- 先做浏览器验证，再做生产级动画与表现扩展。
