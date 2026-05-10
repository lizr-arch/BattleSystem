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

## V3：Special / Blade Combo 原型（未来）

范围（仅计划）：

- Arts 充能 Special。
- Specials 推进元素路线。
- 路线成功产出延迟奖励 token（用于后续 cash-out 验证）。

## V4：Chain Attack / token cash-out（未来）

范围（仅计划）：

- Chain Attack 中消耗/打碎 token 完成现金化（payoff）。
- token 破碎可延长攻击序列。
- Full-burst 风格回报可调参验证。

## 工程原则

- 战斗规则不允许“黑盒魔法”，必须可解释。
- 任何重要状态变化必须可被观察（日志/快照/可视化）。
- 动作时序与取消权限由数据驱动，而不是 UI 特判。
- 先做浏览器验证，再做生产级动画与表现扩展。
