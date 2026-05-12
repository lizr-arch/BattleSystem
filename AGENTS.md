# AGENTS.md

本文件是 BattleSystem 仓库的开发代理规范。任何本地大模型、Codex、自动化脚本或人工开发者在修改本仓库前，都必须先阅读并遵守本文件。

## 1. 项目定位

BattleSystem 当前不是完整游戏项目，而是一个用于快速验证“异度之刃 2-like”战斗系统底层循环的浏览器优先原型。

当前核心闭环：

```text
Driver（驱动者）输入与动作
  ↓
Startup / Active / Recovery（前摇 / 命中段 / 后摇）
  ↓
AutoAttack / Art（普攻 / 武技）
  ↓
Driver Combo（驱动者连击）
  ↓
Special / Blade Combo / Token（必杀技 / 异刃连击 / 延迟奖励资源）
  ↓
Routine-Orb（套路挂球）
  ↓
Enemy Attack / Defeat（敌人攻击 / 失败闭环）
```

V5 当前方向：

```text
Driver Backpack（9×9 驱动者背包）
  ↓
BladeItem（异刃物品，占背包格子）
  ↓
Blade Internal Equipment（异刃内部装备）
  ↓
Generated Socket（生成插槽）
  ↓
ElementCore（元素核心）
  ↓
ResolvedLoadout（解析后构筑）
  ↓
BladeRuntime（异刃战斗单位）
```

V5 必读设计入口：

- `docs/v5-backpack-blade-index.md`
- `docs/backpack-loadout-design.md`
- `docs/blade-nested-socket-design.md`
- `docs/v5.1-backpack-blade-mvp-spec.md`

主要目标：

- 保持浏览器沙盒可运行。
- 保持战斗核心可测试、可迁移、可解释。
- 用最小工程复杂度验证机制，不提前扩成完整游戏。
- 文档设计由制作/架构负责；本地大模型主要负责按 SPEC（规格）编程实现。

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
src/dev/                纯逻辑验证工具：scenario runner、trace recorder、内置 scenarios
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
- Backpack / Loadout / BladeRuntime 纯逻辑。

核心原则：

```text
输入只表达意图，不直接改变战斗状态。
状态机决定当前动作能否响应输入。
动作阶段决定能否取消。
事件日志记录所有关键结果。
Combat（战斗）不应每帧扫描 Backpack（背包），只读取 ResolvedLoadout（解析后构筑）。
```

### 3.2 `src/data/`

`src/data` 存放默认数值与装配逻辑。默认数值应尽量集中管理，不要散落在 UI 或测试中。

如需调整默认数值，必须说明调整原因，并确认测试或手感验证结果。

### 3.3 `src/ui/`

`src/ui` 只负责浏览器壳：

- 键盘输入转为 `CombatInputFrame`。
- Canvas 绘制。
- Debug 面板。
- 调参 UI。
- 固定帧循环驱动。

`src/ui` 可以读取 core 状态并展示，但不应该决定战斗规则。

## 4. 必须保持的核心规则

- `src/core` 保持纯逻辑。
- 输入不直接改变战斗结果。
- 重要状态变化必须有事件日志。
- Scenario Runner（脚本化场景运行器）是主要可验证入口。
- 新机制必须补 tests（测试）和 docs（文档）。
- 不得为了让测试通过而削弱核心规则。

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

进入 V5.1 前必须先阅读：

```text
docs/v5-backpack-blade-index.md
docs/backpack-loadout-design.md
docs/blade-nested-socket-design.md
docs/v5.1-backpack-blade-mvp-spec.md
```

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
npm run audit:map
```

如修改浏览器沙盒，还要手动验证：

```bash
npm start
# 打开 http://127.0.0.1:8000/index.html
```

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
npm test
npm run audit:map
git push -u origin <task-branch>
# open PR
```

只有用户明确要求直接提交到 `main` 时，才允许直接修改 `main`。

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

V5.1 额外禁止：

- 拖拽 UI。
- 物品旋转。
- 复杂形状。
- 背包商店/掉落。
- Blade 独立寻路。
- Blade 复杂 AI。
- Blade 自己挂 RoutineOrb（套路球）。
- Chain Attack（连锁攻击阶段）。
- Full Burst（最终爆发）。
- Fusion Combo（融合连击）。

## 8. 新机制接入规则

任何新机制必须回答：

```text
它挂在哪个事件后面？
它改变哪个状态？
它是否产生新事件？
它是否需要 UI 可视化？
它的测试用例是什么？
它是否破坏既有规则？
```

## 9. 验收标准

修改完成后，至少满足：

- `npm test` 通过。
- `npm run audit:map` PASS。
- `index.html` 可运行。
- `src/core` 不依赖 DOM / Canvas。
- 关键行为可通过事件日志观察。
- 文档同步更新。
- 没有无关功能扩张。

如果无法完成其中任何一项，必须明确报告，不要假装完成。
