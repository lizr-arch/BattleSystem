# AGENTS.md

本文件是 BattleSystem 仓库的开发代理规范。任何本地大模型、Codex、自动化脚本或人工开发者在修改本仓库前，都必须先阅读并遵守本文件。

## 1. 项目定位

BattleSystem 当前不是完整游戏项目，而是一个用于快速验证“异度之刃 2-like”战斗系统底层循环的浏览器优先原型。

当前核心闭环：

```text
输入意图
  ↓
动作状态机
  ↓
Startup / Active / Recovery
  ↓
普攻命中
  ↓
武技充能
  ↓
后摇取消
  ↓
武技消费
```

当前阶段：V1 已完成模块化重构。

主要目标：

- 保持浏览器沙盒可运行。
- 保持战斗核心可测试、可迁移、可解释。
- 用最小工程复杂度验证机制，不提前扩成完整游戏。

## 2. 角色分工

本地模型/开发代理的角色：

- 主程序。
- 前端验证工具开发。
- 简单调试 UI / 可视化实现。
- 必要的文档维护。

制作人/架构负责人意图：

- 先做机制验证，再做表现扩展。
- 先维护核心规则的确定性，再堆玩法。
- 所有新机制必须能通过日志、测试或可视化被验证。

如果用户没有明确要求，不要擅自扩展大玩法。

## 3. 当前目录边界

```text
index.html              浏览器沙盒入口，只负责页面结构、CSS、模块装配
src/core/               纯战斗核心，不依赖 DOM / Canvas / window / document
src/data/               默认战斗配置与 actor 装配
src/ui/                 浏览器输入、Canvas 渲染、Debug 面板、Sandbox App
tests/                  Node 可重复测试
docs/                   架构、战斗模型、验证计划、路线图
tools/serve.py          本地静态服务器
```

### 3.1 `src/core/`

`src/core` 是核心逻辑层。禁止依赖：

- DOM
- Canvas
- `window`
- `document`
- 浏览器事件
- CSS
- 渲染细节
- 具体 UI 控件

可以包含：

- 动作时间轴。
- 状态机。
- 输入意图结构。
- 输入缓冲。
- 武技充能。
- 事件日志。
- 战斗规则。
- 小型数学工具。

核心原则：

```text
输入只表达意图，不直接改变战斗状态。
状态机决定当前动作能否响应输入。
动作阶段决定能否取消。
事件日志记录所有关键结果。
```

### 3.2 `src/data/`

`src/data` 存放默认数值与装配逻辑。默认数值应尽量集中管理，不要散落在 UI 或测试中。

当前默认值：

```text
AA1: startup 18f, active 2f, recovery 24f, damage 10, charge +1
AA2: startup 22f, active 2f, recovery 28f, damage 14, charge +1
AA3: startup 30f, active 2f, recovery 36f, damage 24, charge +2
Art1: startup 15f, active 4f, recovery 28f, damage 70, maxCharge 3
Input Buffer: 10f
Cancel Bonus: 15f
Cancel Bonus Multiplier: 1.2x
FPS: 60
```

如需调整这些值，必须说明调整原因，并确认测试或手感验证结果。

### 3.3 `src/ui/`

`src/ui` 只负责浏览器壳：

- 键盘输入转为 `CombatInputFrame`。
- Canvas 绘制。
- Debug 面板。
- 调参 UI。
- 固定帧循环驱动。

`src/ui` 可以读取 core 状态并展示，但不应该决定战斗规则。

错误示例：

```text
在 UI 里判断 Recovery 能否取消到 Art。
```

正确示例：

```text
UI 调用 actor.tick(input)，然后根据 actor 状态和事件日志显示结果。
```

## 4. 必须保持的核心规则

### 4.1 输入规则

- 移动是持续输入意图。
- 武技是瞬时输入，进入短输入缓冲。
- 输入不直接改变战斗结果。
- 所有输入是否生效，由状态机和当前动作阶段决定。

### 4.2 动作阶段

每个动作使用统一阶段：

```text
Startup -> Active -> Recovery -> Finished
```

规则：

- `Startup`：普通移动和武技输入不能软取消。
- `Active`：触发命中、伤害、武技充能。
- `Recovery`：允许按动作配置取消到移动或 ready 武技。
- `Finished`：自然结束并进入下一步。

### 4.3 普攻规则

- 角色有目标且在普攻范围内，且没有移动意图时，才可以启动普攻。
- 普攻链为 `AA1 -> AA2 -> AA3`。
- 普攻命中才给武技充能。
- 普攻后摇移动取消后，普攻链重置到 `AA1`。
- 命中收益已经发生后，不能因为移动取消而回滚。

### 4.4 武技规则

- 武技 `charge >= maxCharge` 时 ready。
- 使用武技会消耗 charge。
- 普攻 Recovery 中使用 ready 武技，可以取消后摇。
- Cancel Bonus 窗口内取消到武技，获得伤害奖励。
- Recovery Cancel 和 Cancel Bonus 是两个不同概念，禁止混成一个判断。

### 4.5 事件日志

任何重要战斗行为都必须有可观察事件。

应记录：

- 输入进入缓冲。
- 输入被消费。
- 动作开始。
- 动作阶段变化。
- 命中。
- whiff。
- 武技充能变化。
- 武技 ready。
- 后摇取消到移动。
- 后摇取消到武技。
- Cancel Bonus 生效。
- 动作结束。

## 5. 开发流程

任何非微小修改都必须按以下流程：

```text
SPEC -> PLAN -> DO -> VERIFY -> REPORT
```

### 5.1 SPEC

先明确：

- 要解决的问题。
- 不解决的问题。
- 成功标准。
- 不能破坏的既有规则。

### 5.2 PLAN

再列出：

- 要改哪些文件。
- 每个文件为什么改。
- 测试怎么验证。
- 风险点是什么。

### 5.3 DO

实现时要求：

- 小步提交。
- 不做无关重构。
- 不引入未批准依赖。
- 不扩大任务范围。

### 5.4 VERIFY

至少执行：

```bash
npm test
```

如修改浏览器沙盒，还要手动验证：

```bash
npm start
# 打开 http://127.0.0.1:8000/index.html
```

手动验证至少覆盖：

- 站定进入普攻。
- 持续移动不启动普攻。
- Startup 中移动不取消。
- Active 命中充能。
- Recovery 移动取消。
- Recovery ready Art 取消。
- Cancel Bonus 窗口内生效。

### 5.5 REPORT

最终回复必须包含：

- 修改文件列表。
- 关键行为变化。
- 测试结果。
- 是否已推送。
- commit / branch / PR 链接。
- 遗留风险。

## 6. Git 工作流

默认不要直接在 `main` 做大改。推荐：

```bash
git checkout main
git pull
git checkout -b <task-branch>
# implement
git test / npm test
git push -u origin <task-branch>
# open PR
```

只有用户明确要求直接提交到 `main` 时，才允许直接修改 `main`。

提交信息应清楚说明目的，例如：

```text
V1.1 add combat snapshot API
V2 add driver combo status model
Fix input buffer expiry event
```

## 7. 禁止事项

未经用户明确要求，禁止：

- 引入 React / Vue / Angular。
- 引入 Vite / Webpack / Rollup 等构建系统。
- 引入 TypeScript。
- 引入复杂资源管线。
- 把项目改成完整游戏。
- 添加复杂敌人 AI。
- 添加队友 AI。
- 添加大型美术资产。
- 添加联网、存档、账号、后端服务。
- 把战斗核心写死到 UI。
- 让 `src/core` 依赖 DOM / Canvas。
- 删除现有测试。
- 为了让测试通过而削弱核心规则。
- 在没有说明原因的情况下改变默认数值。

## 8. 当前路线图

### V0：完成

浏览器单文件/原型，验证最小战斗循环。

### V1：完成

模块化重构：

- `src/core` 纯战斗核心。
- `src/data` 默认配置。
- `src/ui` 浏览器验证壳。
- Node 测试。

### V1.1：建议下一步

只做质量补强，不加大玩法：

- 增加 `CombatActor.snapshot()`，让 UI 少读内部字段。
- 增加 typed event helper，减少字符串日志依赖。
- 增加浏览器 smoke test 或轻量页面加载检查。
- 把调参 UI 改成 config patch，而不是直接改 actor 内部值。
- 补充 docs 中的 V1.1 验收标准。

### V2：未来玩法原型

实现 Driver Combo：

```text
Break -> Topple -> Launch -> Smash
```

V2 要求：

- 先设计状态模型。
- 先写测试。
- 再接 UI 可视化。
- 不要同时做 Blade Combo / Chain Attack。

### V3：未来

Special / Blade Combo 原型。

### V4：未来

Chain Attack / token cash-out 原型。

## 9. 新机制接入规则

任何新机制必须回答：

```text
它挂在哪个事件后面？
它改变哪个状态？
它是否产生新事件？
它是否需要 UI 可视化？
它的测试用例是什么？
它是否破坏 V1 既有规则？
```

示例：Driver Combo 不应该直接散落在 UI 里，应该挂在 core 的 Art hit / effect 处理链上。

## 10. 验收标准

修改完成后，至少满足：

- `npm test` 通过。
- `index.html` 可运行。
- `src/core` 不依赖 DOM / Canvas。
- 关键行为可通过事件日志观察。
- 文档同步更新。
- 没有无关功能扩张。

如果无法完成其中任何一项，必须明确报告，不要假装完成。

## 11. 给本地模型的简短执行口令

开始任务前，先重复检查：

```text
我是否在改正确层级？
我是否保持 src/core 纯逻辑？
我是否没有扩大玩法范围？
我是否补了测试？
我是否更新了文档？
我是否能用事件日志证明行为？
```

如果答案不是全部为“是”，先停下修正计划。
