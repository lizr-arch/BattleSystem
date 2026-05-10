# 战斗模型

## 实现位置（V1）

- 规则实现：`src/core/*`（纯逻辑，不依赖 DOM / Canvas）
- 默认数值：`src/data/default-combat-config.js`
- 浏览器沙盒：`src/ui/*` + 根目录 `index.html`

## 第一阶段闭环

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

## 默认参数

| 动作 | Startup | Active | Recovery | Damage | Charge Gain |
| --- | ---: | ---: | ---: | ---: | ---: |
| AA1 | 18f | 2f | 24f | 10 | +1 |
| AA2 | 22f | 2f | 28f | 14 | +1 |
| AA3 | 30f | 2f | 36f | 24 | +2 |
| Art1 | 15f | 4f | 28f | 70 | 0 |

| 参数 | 默认值 |
| --- | ---: |
| 逻辑帧率 | 60 FPS |
| Input Buffer | 10f |
| Cancel Bonus | 15f |
| Art1 Max Charge | 3 |

## 当前暂不实现

第一阶段暂不实现：

- 敌人攻击和 AI。
- 仇恨系统。
- 破防 / 倒地 / 浮空 / 猛击。
- 必杀技。
- 异刃连击。
- 属性球。
- 连锁攻击。

这些后续都可以挂在当前 `ActionHit` / `ArtHit` / `CombatEvent` 链路之后。
