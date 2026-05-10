# 验证计划（V1-V3）

本文件定义浏览器战斗沙盒的手动验证用例，以及对应的 Node 可重复测试范围。

## 目标

在保持“浏览器可跑 + Node 可重复测试”的前提下，把战斗闭环、Driver Combo（控制链）、以及 V3 的 Special/Blade/Token 原型验证清楚，并保证行为可解释、可复现。

明确边界：本仓库不实现 Chain Attack，也不实现 token 的 cash-out/兑现机制。

核心闭环（V1）：

```text
普攻命中
  ↓
武技充能
  ↓
后摇取消
  ↓
武技命中
```

控制链（V2）：

```text
Art 命中 effect 推进：Break -> Topple -> Launch -> Smash
```

路线链（V3）：

```text
Art 命中 => Special Gauge 充能
  ↓
Special 消费并命中 => 推进 Blade Combo route
  ↓
route 完成 => TokenCreated（仅产出，不兑现）
```

## 手动验证矩阵（V1：基础闭环）

| Case | 玩家操作 | 期望结果 |
| --- | --- | --- |
| 站定进入普攻 | 在普攻范围内停止移动 | 普攻链自动启动：`AA1 -> AA2 -> AA3` |
| 持续移动不启动普攻 | 一直按住移动 | 角色空闲时不启动普攻 |
| Startup 中移动不取消 | `AA1` 开始后，在命中前持续移动 | Startup 不被软取消；命中仍触发；随后可在 Recovery 取消 |
| Recovery 中移动取消 | 命中后（进入 Recovery）再移动 | 命中收益保留；后摇取消到移动；普攻链重置 |
| 提前按武技进缓冲 | Art 将 ready 前，提前按 `1` | 输入进入缓冲；在 Recovery 可被消费并启动 Art1 |
| Cancel Bonus 生效 | 在 Cancel Bonus 窗口内用 Art1 | Art 伤害获得奖励（日志可观察） |
| 过窗仍可取消但无奖励 | Cancel Bonus 过期后，在 Recovery 用 Art1 | 仍可后摇取消到 Art，但无奖励 |

## 手动验证矩阵（V2：Driver Combo）

说明：默认配置里 `Art1/2/3/4` 的 effect 分别为 `Break/Topple/Launch/Smash`，且只在 Art 命中时推进（whiff 不推进）。

| Case | 玩家操作 | 期望结果 |
| --- | --- | --- |
| 基础推进到 Smash | 依次使用 `1 -> 2 -> 3 -> 4`，每次都命中 | 产生 `DriverComboApplied/Advanced/Finished` 事件；完成后 stage 回到 None |
| Break 刷新 | 已处于 Break 时再次命中 `Art1` | `DriverComboRefreshed`；剩余时间回满 |
| 错序失败（不改变阶段） | stage 为 None 时先命中 `Art2`，或 Break 时先命中 `Art3` | `DriverComboFailed`；stage/剩余时间不推进（通过日志与面板确认） |
| 超时过期 | 进入 Break/Topple/Launch 后等待到倒计时归零 | `DriverComboExpired`；stage 回到 None |
| Whiff 不推进 | 让 Art 打空（不在范围内） | `ActionWhiffed`；不产出 Driver Combo 推进事件 |

## 手动验证矩阵（V3：Special / Blade Combo / Token）

说明：V3 的手动验证建议优先用 Debug 面板按钮（Grant Special / Cast Special / Run Scenarios），避免键盘焦点与 one-shot 误差；键盘操作仍可用于移动/Arts 的补充手感验证。

| Case | 玩家操作 | 期望结果 |
| --- | --- | --- |
| Special Gauge 充能 | 连续命中若干次 Arts（或用 Debug 面板准备后命中） | 产生 `SpecialChargeChanged`；跨过 100/200/300 时产生 `SpecialBecameReady` |
| Special 不足等级失败 | 把 gauge 调到 L1 或 L2，然后尝试释放 L3 special | `SpecialCastFailed reason=insufficient_level`；不进入动作 |
| Special 成功消费与命中 | 把 gauge 调到对应等级（或用 Grant Special），释放对应 special 并命中 | 产生 `SpecialConsumed`；在命中帧产生 `SpecialHit` |
| Blade Combo 完整路线 | 依次命中 `Fire(L1) -> Water(L2) -> Fire(L3)` | 产生 `BladeComboStarted/Advanced/Finished`；并产生 `TokenCreated` |
| Blade Combo 错元素失败 | 在 Stage1 期待 Water 时改用 Fire | 产生 `BladeComboFailed reason=wrong_element`；stage 不推进 |
| Blade Combo 等级不足失败 | 在 Stage2 期待 Fire(L3) 时用 Fire(L1) | 产生 `BladeComboFailed reason=insufficient_level`；stage 不推进 |
| Blade Combo 超时过期 | 进入 Stage1 后不继续输入，等待倒计时归零 | 产生 `BladeComboExpired`；stage 回到 None |
| Driver + Blade 并行 | 先用 Arts 进入 Driver Combo，再用 Special 开启 Blade Combo | 两条状态机同时活跃，互不覆盖；事件链各自独立 |

## Debug 信号（浏览器侧）

使用右侧 Debug 面板与事件日志检查：

- 当前 state / action / phase 与时序进度条。
- Arts 的 charge / maxCharge / ready。
- Input Buffer 与 Cancel Bonus 窗口。
- Driver Combo：当前 stage、剩余帧数/进度。
- Special Gauge：charge / readyLevel（L0~L3）。
- Blade Combo：stage、routeId、expectedNext、剩余帧数/进度。
- Tokens：当前 tokens 列表（id/element/route/createdFrame）。

期望事件示例（非穷举）：

```text
ActionStarted AA1
ActionPhaseChanged AA1 Startup->Active
ActionHit AA1 damage=10
ArtChargeChanged Art1 0->1
CancelBonusWindowOpened 15f
RecoveryCanceledToArt AA3 -> Art1
CancelBonusApplied Art1
ActionHit Art1 damage=48 [bonus]
SpecialChargeChanged 0->25 L0->L0 from=Art1
SpecialBecameReady L1 charge=100
DebugGrantSpecialReady charge=300 L3
SpecialConsumed FireLv1 L1 cost=100 300->200
SpecialHit FireLv1 element=Fire L1 damage=120
BladeComboStarted route=FireWaterFire Stage1 element=Fire next=Water minL=2 240f
BladeComboAdvanced route=FireWaterFire Stage1->Stage2 element=Water next=Fire minL=3 240f
BladeComboFinished route=FireWaterFire element=Fire
TokenCreated FireToken element=Fire route=FireWaterFire
DriverComboApplied Break 180f
DriverComboAdvanced Break->Topple 150f
DriverComboAdvanced Topple->Launch 120f
DriverComboFinished Smash
DriverComboExpired Break
DriverComboFailed stage=Break effect=Launch requires=Topple
DriverComboRefreshed Break 12f->180f
```

## 验收标准（V1-V3）

- core deterministic tests（Node）：主验收证据，验证不变量与规则边界。
- scenario runner（Node/UI）：机制链路验收证据，验证完整流程与失败原因（不依赖键盘焦点）。
- browser smoke：UI/模块加载验收证据，确认 index.html 装配不报错。
- manual keyboard playtest：仅补充（手感/直觉验证），不作为唯一验收证据。

- `index.html` 可直接打开运行（无构建步骤）。
- `src/core` 保持纯逻辑，不依赖 DOM / Canvas。
- `npm test` 在 Node 下通过。
- 上述 V1~V3 关键用例能通过日志与 scenario proof 被解释（键盘复现仅作补充）。
- 关键决策点均能通过事件日志被证明（输入缓冲/消费、命中/打空、取消、Driver Combo、Special、Blade Combo、Token 产出）。

## 自动化测试（Node）

`tests/` 覆盖核心不变量：

- 动作阶段时序边界正确。
- 站定且在范围内会启动 `AA1`。
- 持续移动会阻止普攻启动与充能收益。
- Startup 不可被移动软取消。
- Active 命中产出充能。
- Recovery 可取消到移动，且命中收益不回滚。
- ready Art 可在 Recovery 被消费并启动。
- Cancel Bonus 在窗口内生效。
- Driver Combo：顺序推进、错序失败、超时过期、Break 刷新、Smash 完成回到 None。
- Special Gauge：充能、readyLevel 阈值、消费与失败原因。
- Blade Combo：开始/推进/失败/过期/完成，以及 TokenCreated。

## 非目标（当前阶段不做）

- 生产级最终动画与复杂表现管线。
- 复杂敌人 AI / 攻击行为。
- 队友 AI。
- 属性球。
- Token cash-out（兑现/破碎/消费）。
- Chain Attack（明确排除）。
- 完整伤害公式与数值平衡。
