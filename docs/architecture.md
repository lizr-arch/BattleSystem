# BattleSystem 架构说明

## 目标

当前仓库不是完整游戏项目，而是一个可以快速验证战斗系统底层节奏的浏览器沙盒。核心目标是把下面这条资源链做稳定：

```text
输入意图
  ↓
动作状态机
  ↓
Startup / Active / Recovery
  ↓
普攻命中事件
  ↓
武技充能
  ↓
后摇取消
  ↓
武技消费
```

## 第一版远端内容

当前 main 分支优先保证可运行：

- `index.html`：自包含浏览器验证页，直接打开即可运行。
- `README.md`：项目说明与运行方式。
- `package.json`：项目元信息。
- `docs/*`：架构、模型、验证计划、路线图。

后续可继续把本地模块化版本拆成：

```text
src/core/        纯战斗核心
src/data/        默认数值配置
src/ui/          浏览器输入、Canvas、Debug 面板
tests/           自动测试
```

## 设计原则

1. 先验证机制，不先做美术表现。
2. 逻辑固定 60 FPS，方便复现。
3. 输入只表达意图，不直接改战斗状态。
4. 动作由时间轴驱动，拆成前摇、命中段、后摇。
5. 取消权限和取消奖励分离。
6. 所有关键行为都写入事件日志。

## 主状态机

当前状态：

```text
Locomotion
AutoAttack
Art
```

### Locomotion

- 可以移动。
- 如果 Ready 武技输入存在，可以普通释放武技。
- 如果无移动意图、目标在普攻范围内，进入 `AutoAttack`。

### AutoAttack

动作由动作时间轴驱动：

```text
Startup：不接受移动 / 武技软取消
Active：触发命中
Recovery：可以取消到移动或 Ready 武技
Finished：自然进入下一段普攻
```

### Art

当前版本武技释放中动作锁定，不允许移动取消。武技结束后根据当前移动意图决定回到 `Locomotion` 或重新开始普攻判断。

## 取消规则

继续保持两层概念分离：

| 层 | 含义 |
| --- | --- |
| Recovery Cancel | 后摇能否被取消 |
| Cancel Bonus | 命中后短时间内取消是否获得奖励 |

这样可以做出：

```text
后摇 40 帧都能取消
但只有命中后 15 帧内取消才有 1.2 倍收益
```

## 后续迁移到 C# / Unity

浏览器原型中的结构可迁移成：

| Browser Prototype | C# / Unity |
| --- | --- |
| ActionSpec | CombatActionSpec / ScriptableObject |
| ActionInstance | Runtime action instance |
| Actor | Pure combat model / combat controller |
| Input frame | Per-frame input intent |
| Event log | Event bus / debug log |

Unity 层建议只负责：

```text
读取输入
驱动 CombatActor.Tick
消费事件
驱动 Animator / VFX / UI
```
