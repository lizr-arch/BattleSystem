# 战斗模型

## 实现位置（V1-V2）

- 规则实现：`src/core/*`（纯逻辑，不依赖 DOM / Canvas）
- 默认数值：`src/data/default-combat-config.js`
- 浏览器沙盒：`src/ui/*` + 根目录 `index.html`

## 基础闭环（V1）

```text
玩家站定
  ↓
自动普攻开始
  ↓
Startup 前摇
  ↓
Active 命中
  ↓
武技充能
  ↓
Recovery 后摇
  ↓
移动取消 / 武技取消
```

## 普攻定位

当前设计里，普攻不是主要操作输出，而是资源生产器。

普攻命中会：

1. 造成基础伤害。
2. 给武技增加 charge。
3. 打开 Cancel Bonus 窗口。
4. 推动普攻链节奏。

## 移动含义

移动不是传统 ARPG 的自由走砍，而是资源生产条件。

| 场景 | 结果 |
| --- | --- |
| 未行动时移动 | 阻止普攻启动 |
| 普攻 Startup 中移动 | 不打断已经承诺的攻击 |
| 普攻 Recovery 中移动 | 取消后摇，进入移动，并重置普攻链 |

## 武技含义

武技是资源消费：

- 普攻命中使武技充能。
- 武技 Ready 后可以被输入消费。
- 在普攻后摇中使用 Ready 武技，可以跳过普攻后摇。
- 如果仍处于 Cancel Bonus 窗口，则获得奖励。

## Driver Combo（V2）

Driver Combo 是“控制链”层，不改变 V1 的普攻/充能/取消闭环，而是挂在“武技命中”的效果处理之后，用来验证状态推进、持续时间、失败分支是否可解释。

### 状态模型

```text
stage: None / Break / Topple / Launch
framesLeft: 当前阶段剩余帧数（倒计时）
```

- stage 初始为 `None`。
- `Break/Topple/Launch` 有各自持续时间；倒计时归零会过期回到 `None`。
- `Smash` 不是一个持续 stage，而是“完成效果”：触发后立刻结束并回到 `None`。

### 推进规则

推进仅发生在 Art 命中时（whiff 不推进），并按 effect 顺序要求：

```text
None   + Break  => Applied(Break)
Break  + Topple => Advanced(Break->Topple)
Topple + Launch => Advanced(Topple->Launch)
Launch + Smash  => Finished(Smash) 并回到 None
```

额外规则：

- `Break` 阶段再次命中 `Break` 会刷新持续时间（用于容错验证）。
- 错序 effect 会产出 `DriverComboFailed`，且不推进 stage（通过日志可证明）。

### 默认持续时间（60 FPS）

| 阶段 | 持续（帧） | 约等于（秒） |
| --- | ---: | ---: |
| Break | 180f | 3.0s |
| Topple | 150f | 2.5s |
| Launch | 120f | 2.0s |

## 默认参数

| 动作 | Startup | Active | Recovery | Damage | Charge Gain | Effect |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| AA1 | 18f | 2f | 24f | 10 | +1 | - |
| AA2 | 22f | 2f | 28f | 14 | +1 | - |
| AA3 | 30f | 2f | 36f | 24 | +2 | - |
| Art1 | 15f | 4f | 28f | 40 | 0 | Break |
| Art2 | 15f | 4f | 28f | 50 | 0 | Topple |
| Art3 | 15f | 4f | 28f | 60 | 0 | Launch |
| Art4 | 15f | 4f | 28f | 80 | 0 | Smash |

| 参数 | 默认值 |
| --- | ---: |
| 逻辑帧率 | 60 FPS |
| Input Buffer | 10f |
| Cancel Bonus | 15f |
| Art1 Max Charge | 2 |
| Art2 Max Charge | 3 |
| Art3 Max Charge | 4 |
| Art4 Max Charge | 4 |

## 当前暂不实现

当前阶段暂不实现：

- 敌人攻击和 AI。
- 仇恨系统。
- 必杀技。
- 异刃连击。
- 属性球。
- 连锁攻击。

这些后续都可以挂在当前 `ActionHit` / `DriverCombo*` 等事件链路之后。
