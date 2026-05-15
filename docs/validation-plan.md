# 验证计划（V1-V6.2）

本文件定义浏览器战斗沙盒的手动验证用例，以及对应的 Node 可重复测试范围。

## 目标

在保持“浏览器可跑 + Node 可重复测试”的前提下，把战斗闭环、Driver Combo（控制链）、V3 的 Special/Blade/Token、V4.0 的 Single Driver Routine-Orb MVP（单驾驶员·套路球最小闭环）、V4.2 的 Enemy Attack MVP（敌人最小攻击闭环），以及 V4.3 的 Player Defeat Polish（玩家失败打磨）验证清楚，并保证行为可解释、可复现。

明确边界：在 <= V6.2 范围内，本仓库不实现 Chain Attack / Full Burst / Fusion 等 payoff 机制，也不实现 token 的 cash-out/兑现机制；Orbs 仅实现 “Routine Orb（套路球）” 的最小闭环，不覆盖复杂属性球系统与连锁兑现；敌人仅实现单敌人、单攻击（EnemyStrike）的最小攻击闭环，不实现追击/寻路/行为树/仇恨系统。
如进入后续 V6.x，只允许先以 Readiness Review + 拆分计划形式进入（见 `docs/v4-readiness-review.md`），再逐步落最小原型与可观察性资产。

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

单驾驶员·套路球 MVP（V4.0）：

```text
Art 命中（可映射为套路技能）
  ↓
RoutineTileAdded（最多 3 张）
  ↓
3 张同 Routine => RoutineOrbCreated
  ↓
breakRoutineOrb()（破球）
  ↓
ElementDamageApplied + DebuffApplied(Burn)
  ↓
DebuffTickDamage 扣血可击杀
  ↓
TargetDefeated + BattleEnded(Victory)
```

敌人攻击 MVP（V4.2）：

```text
敌人在范围内
  ↓
EnemyAttackStarted / EnemyAttackPhaseChanged
  ↓
EnemyAttackHit => PlayerDamageApplied（玩家掉血）
  ↓
PlayerDefeated + BattleEnded(Defeat)（可失败）
```

失败体验打磨（V4.3）：

```text
PlayerDefeated
  ↓
BattleEnded(Defeat)
  ↓
战斗规则停止
  ↓
输入被忽略
  ↓
Reset 后恢复可战斗状态
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

## 手动验证矩阵（V4.0：Single Driver Routine-Orb MVP）

说明：V4.0 的验证推荐优先使用 Scenario 一键 Run（Node 与浏览器都可复现），手动键盘操作仅用于观察 UI/Canvas 表现与直觉校验。

| Case | 玩家操作 | 期望结果 |
| --- | --- | --- |
| 生成 Routine Tiles | 依次命中 `Art1 -> Art2 -> Art3`（确保命中） | 依次产生 `RoutineTileAdded`，面板 tiles 显示 3 张 |
| 生成 Routine Orb | 在已有 3 张同 Routine 的前提下 | 产生 `RoutineOrbCreated`，面板 orb 显示 `FireRoutine L6` |
| 破球成功 | 点击/触发 `breakRoutineOrb` | 产生 `RoutineOrbBreakStarted/ElementDamageApplied/DebuffApplied/RoutineOrbBroken/RoutineOrbBreakFinished`；orb/tiles 清空 |
| 破球失败 | 无 orb 时点击/触发 `breakRoutineOrb` | 产生 `RoutineOrbBreakFailed reason=no_orb` |
| 灼烧 tick 可击杀 | 用场景把 targetHp 设低（例如 280），生成 orb 并破球 | 出现 `DebuffTickDamage`，最终 `TargetDefeated` 与 `BattleEnded Victory` |

## 手动验证矩阵（V4.2：Enemy Attack MVP）

说明：V4.2 的验证推荐优先使用右侧 Debug 面板的 Enemy/Player 区块与 Scenario 一键 Run（不依赖键盘焦点）。键盘与移动仅用于补充观察 Canvas 提示与直觉校验。

| Case | 玩家操作 | 期望结果 |
| --- | --- | --- |
| 敌人开始攻击 | 运行 scenario `enemy-starts-attack-when-player-in-range` | 出现 `EnemyAttackStarted`；Enemy/Player 面板显示 enemy.state=Attacking 且 phase=Startup |
| 命中造成掉血 | 运行 scenario `enemy-attack-hits-player` | 出现 `EnemyAttackHit`、`PlayerDamageApplied`、`PlayerHpChanged`；玩家 HP 下降但未必死亡 |
| 打空不掉血 | 运行 scenario `enemy-attack-whiffs-when-player-out-of-range` | 出现 `EnemyAttackWhiffed reason=out_of_range`；不应出现 `PlayerDamageApplied`；玩家 HP 不变 |
| 冷却门禁 | 运行 scenario `enemy-attack-enters-cooldown` | 出现 `EnemyAttackCooldownStarted/Finished`；冷却期间不应再次 `EnemyAttackStarted` |
| 被 Topple/Launch 控制不攻击 | 运行 scenario `enemy-cannot-attack-while-toppled` | 出现 `EnemyControlled`；enemy.state=Controlled；不应出现 `EnemyAttackStarted` |
| 敌人可击败玩家 | 运行 scenario `enemy-can-defeat-player` | 出现 `PlayerDefeated` 与 `BattleEnded result=Defeat`；Enemy/Player 面板显示 battle inactive |
| 玩家可击杀正在攻击的敌人 | 运行 scenario `player-can-defeat-attacking-enemy` | 出现 `TargetDefeated`（Victory）；在敌人被击杀前不应出现 `EnemyAttackHit` |

## 手动验证矩阵（V4.3：Player Defeat Polish）

| Case | 操作 | 期望结果 |
| --- | --- | --- |
| Defeat 后战斗停止 | 运行 scenario `player-defeat-stops-combat` | 场景 PASS；120 帧内无新的战斗事件 |
| Defeat 后 Reset 恢复 | 运行 scenario `reset-after-defeat` | 场景 PASS；reset 后 player / target alive，battle active |
| Defeat 后输入被忽略 | 运行 scenario `input-ignored-after-defeat` | 场景 PASS；输入不触发 `ActionStarted` / `InputConsumed` |
| Canvas 显示 DEFEAT | 运行 scenario `enemy-can-defeat-player` 或 `player-defeat-stops-combat` | Canvas 显示 `DEFEAT`，暂停时显示 `Press R to Reset` |
| DebugPanel 显示 Defeat | 运行 defeat 相关 scenario 后观察面板 | Battle Result 显示 `inactive result=Defeat`，Player HP 显示 0/dead |

## Debug 信号（浏览器侧）

使用右侧 Debug 面板与事件日志检查：

- 当前 state / action / phase 与时序进度条。
- Arts 的 charge / maxCharge / ready。
- Input Buffer 与 Cancel Bonus 窗口。
- Driver Combo：当前 stage、剩余帧数/进度。
- Special Gauge：charge / readyLevel（L0~L3）。
- Blade Combo：stage、routeId、expectedNext、剩余帧数/进度。
- Tokens：当前 tokens 列表（id/element/route/createdFrame）。
- Single Driver MVP：target HP、tiles/orb、burn、最后一条 MVP 相关事件。
- Enemy/Player：enemy state/action/phase/cooldown/hp；player hp；battle result；最后一条敌人相关事件。
- Bond：Trust / TrustLevel / Mood / Sync（Backpack / Blades 区块）。

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
BattleStarted target=Dummy hp=280/280
DamageApplied target=Dummy amount=40 src=Art
TargetHpChanged 280->240/280
RoutineTileAdded routine=FireRoutine layer=1 tiles=1
RoutineOrbCreated routine=FireRoutine totalLayer=6
RoutineOrbBreakStarted routine=FireRoutine totalLayer=6
ElementDamageApplied element=Fire amount=120
DebuffApplied Burn 300f
DebuffTickDamage Burn amount=5
TargetDefeated target=Dummy
BattleEnded result=Victory
EnemyTargetSelected enemy=Enemy target=Player
EnemyAttackStarted EnemyStrike
EnemyAttackPhaseChanged EnemyStrike Startup->Active
EnemyAttackHit EnemyStrike damage=15
PlayerDamageApplied amount=15 src=EnemyStrike enemy=Enemy
PlayerHpChanged 100->85/100
EnemyAttackFinished EnemyStrike
EnemyAttackCooldownStarted EnemyStrike 90f
EnemyControlled stage=Topple 60f
EnemyAttackInterrupted EnemyStrike reason=driver_combo
PlayerDefeated
BattleEnded result=Defeat
Reset
BattleStarted target=Dummy hp=999999/999999
```

## 验收标准（V1-V5.4）

- core deterministic tests（Node）：主验收证据，验证不变量与规则边界。
- scenario runner（Node/UI）：机制链路验收证据，验证完整流程与失败原因（不依赖键盘焦点）。
- browser smoke：UI/模块加载验收证据，确认 index.html 装配不报错。
- manual keyboard playtest：仅补充（手感/直觉验证），不作为唯一验收证据。

- `index.html` 可直接打开运行（无构建步骤）。
- `src/core` 保持纯逻辑，不依赖 DOM / Canvas。
- `npm test` 在 Node 下通过。
- `npm run audit:map` PASS（文档盘点门禁）。
- 上述 V1~V5.4 关键用例能通过日志与 scenario proof 被解释（键盘复现仅作补充）。
- 关键决策点均能通过事件日志被证明（输入缓冲/消费、命中/打空、取消、Driver Combo、Special、Blade Combo、Token 产出、EnemyAttack 命中/打空/冷却/被控、Player Damage/Defeat、Reset after Defeat）。

## 文档一致性验收（V5.4）

V5.4 验收以“口径一致 + 可追溯 + 一键可复现”为主：

- README / AGENTS / docs 路线图不互相矛盾（版本命名、边界、非目标一致）。
- `docs/mechanics-map.md` 与 `docs/test-coverage-map.md` 保持同步（机制与测试覆盖口径一致）。
- `docs/routine-orb-system.md` 与事件目录/模型/测试覆盖口径一致。
- Enemy Attack 相关文档（`docs/enemy-attack-model.md` / `docs/npc-ai-design.md` / `docs/v4.2-enemy-attack-mvp-spec.md`）与实现/事件目录/测试覆盖口径一致。
- Player Defeat 相关文档（`docs/player-defeat-polish-design.md` / `docs/v4.3-player-defeat-polish-spec.md`）与实现/事件目录/测试覆盖口径一致。
- 后续 V4.x 预研只能通过 `docs/v4-readiness-review.md` 进入，且必须拆分里程碑。
- Bond 相关文档（`docs/blade-bond-system-design.md` / `docs/event-catalog.md`）与实现/事件目录/测试覆盖口径一致。

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
- Battle / HP / Result：DamageApplied/TargetHpChanged/TargetDefeated/BattleEnded 的链路可审计。
- Routine Orb MVP：tiles/orb/break/burn tick/击杀闭环（scenarios + tests）。
- Enemy Attack MVP：EnemyAttack 时序/命中/打空/冷却/被控与 PlayerDefeated（tests + scenarios）。
- Player Defeat Polish：Defeat 后停止、Defeat 后输入被忽略、Reset 后恢复、finalSnapshot 保留真实 Defeat 状态。
- Backpack Blade MVP：backpack-grid/loadout-resolver/blade-runtime 测试（4 个新测试文件 + 6 个内置 scenarios）。
- V6.2 烟雾脚本：三个可选浏览器烟雾测试脚本（`npm run smoke:demo-static` / `npm run smoke:demo-r-key` / `npm run smoke:demo-ui`），不进入 `npm test`。


## 浏览器手动验收（V5.1 Backpack / Blades）

1. 打开 `index.html`，在 Debug 面板找到 "Backpack / Blades" 区块。
2. 确认 Backpack Size 显示背包尺寸。
3. 确认 Active Blades 列表显示 BladeId、role、element、state、cooldown。
4. 点击 "Run Backpack Blade MVP" → Scenario Result 显示 PASS。
5. 点击 "Run Blade Fire Core" → Scenario Result 显示 PASS。
6. 点击 "Run Multiple Blades Limit" → Scenario Result 显示 PASS。
7. Canvas 上在 Player 周围显示橙色 BladeRuntime 标记（element 名称 + cooldown 数字）。

## 非目标（当前阶段不做：<= V6.2）

- 生产级最终动画与复杂表现管线。
- 复杂敌人 AI（追击/寻路/行为树/多敌人/队友 AI/完整 Aggro 仇恨系统）。
- Chain Attack / Full Burst / Fusion（延后；按 Readiness Review 拆分推进）。
- 复杂属性球系统与连锁兑现（当前仅实现 Routine Orb 最小闭环）。
- Token cash-out（兑现/破碎/消费；延后）。
- 背包拖拽 UI / 物品旋转 / 复杂形状。
- Blade 独立寻路 / Blade 复杂 AI / Blade 自己挂 RoutineOrb。
- 完整伤害公式与数值平衡。

## V5.3.1 验收标准（BladeRuntime Constructor Cleanup）

V5.3.1 为纯结构性重构（BladeRuntime 构造函数参数收敛为 `resolvedBlade` 对象），不引入新玩法。验收要求：

- `npm test` PASS（26 suites 全部通过）。
- `npm run audit:map` PASS。
- 4 个 blade 相关测试文件通过：`blade-runtime.test.mjs`、`beast-blade-archetype.test.mjs`、`beast-blade-runtime.test.mjs`、`backpack-blade-scenario.test.mjs`。
- `CombatActor.getSnapshot()` 输出的 blade 相关字段与 V5.3 完全兼容，无字段缺失或结构变更。
- 所有 V5.1/V5.3 scenarios 不回归。

## 浏览器手动验收（V5.4：Bond System）

1. 打开 `index.html`，在 Debug 面板找到 "Backpack / Blades" 区块。
2. 确认 Active Blades 列表中显示 Bond 数据：Trust、TrustLevel、Mood、Sync。
3. 点击 "Run bond-blade-hit-gains-sync" → Scenario Result 显示 PASS，验证 `BondSyncChanged` 事件存在。
4. 点击 "Run bond-sync-triggered" → Scenario Result 显示 PASS，验证 `BondSyncTriggered` 事件存在。
5. 点击 "Run bond-victory-gains-trust" → Scenario Result 显示 PASS，验证 Trust + Mood 增加。
6. 点击 "Run bond-defeat-lowers-mood" → Scenario Result 显示 PASS，验证 Mood 下降但 Trust 不变。
7. Canvas 上在 BladeRuntime 标记旁显示 Trust 等级标记（如 "Lv1"）。

## 手动验证矩阵（V5.4：Bond System MVP）

| Case | 操作 | 期望结果 |
| --- | --- | --- |
| Hit gains Sync | 点击 Run Bond Hit Sync | 出现 BondSyncChanged，blade bond.sync > 0 |
| Sync Trigger | 点击 Run Bond Trigger | 出现 BondSyncTriggered，bond.sync 清零 |
| Victory gains Trust/Mood | 点击 Run Bond Victory | 出现 BondTrustChanged 与 BondMoodChanged reason=victory |
| Defeat lowers Mood | 点击 Run Bond Defeat | 出现 BondMoodChanged reason=defeat，Trust 不下降 |
| Loyal gains more Trust | 点击 Run Bond Loyal | Loyal 异刃 Trust 增长更多 |
| Proud gains more Sync less Trust | 点击 Run Bond Proud | Proud 异刃 Sync 增长更多，Trust 增长较少 |

V5.4 Bond 约束：
- DebugPanel 应显示 Trust / TrustLevel / Mood / Sync。
- V5.4 MVP 中 Sync 达阈值后清零（sync=0）。
- overflow 只作为 `BondSyncTriggered` 事件数据记录，不保留到 `bond.sync`。

## V6.1 验证（Demo Battle Tuning + Dual-Layer HUD）

V6.1 不新增战斗机制，仅新增 Demo HUD 可观察性层。验证重点在 diagnostics.warnings 系统与 dual-layer 数据生成。

### 自动化测试

- `tests/demo-hud-model.test.mjs`（13 tests）：验证 `createDemoHudModel()` 纯函数。
  - 正常 demo preset snapshot → playerHud 全字段存在、diagnostics.warnings 为空。
  - 6 条 warning 规则逐一验证：hpLow / bladeNotAttacking / cooldownStalled / artsUnused / specialUnused / bondLowSync。
  - 异常 snapshot 产生正确 warning；正常 snapshot 零 warning。
- `tests/demo-tuning-scenario.test.mjs`（6 scenarios）：
  - normal-demo-has-zero-warnings：正常 demo preset 无 warning。
  - hp-low-warning / blade-not-attacking-warning / cooldown-stalled-warning / arts-unused-warning / bond-low-sync-warning：每条规则逐一验证。

### 浏览器手动验收

1. 打开 `index.html`，在 Debug 面板确认 dual-layer HUD 显示。
2. Player HUD 区域显示：HP bar、Arts charge、Driver Combo、Special Gauge、Blade Combo、Routine Orb、Bond、Traits、Enemy、Result。
3. Dev Diagnostics 区域显示 diagnostics.warnings 列表。
4. 正常运行 demo preset 时 warnings 为空（零 warning）。
5. 触发异常状态（如 HP 降低、异刃停止攻击等）产生对应 warning。

### V6.1 边界

- 无新战斗机制：不改变伤害、充能、状态机、事件日志。
- 无 Chain Attack / Full Burst / Fusion Combo。
- 无 Life Skill gameplay。
- 无 formal backpack UI。
- 数值保持不变。

## V6.2 验证（Playable MVP Release Candidate）

V6.2 不新增战斗机制，验证重点在文档完整性、npm scripts 可用性与 smoke 脚本通过。

### Smoke 脚本验证

三个可选浏览器烟雾测试脚本，不进入 `npm test`：

```bash
npm run smoke:demo-static   # 静态检查 index.html 与 debug-panel.js DOM 元素
npm run smoke:demo-r-key    # Playwright: 验证 R 键重置行为
npm run smoke:demo-ui       # Playwright: 验证浏览器 UI 交互
```

### 发布验收清单

完整验收流程参见 `docs/v6.2-playable-demo-release-checklist.md`。

### V6.2 边界

- 无新战斗机制：不改变伤害、充能、状态机、事件日志。
- 无 Chain Attack / Full Burst / Fusion Combo。
- 无 Life Skill gameplay。
- 数值保持不变。
- Smoke 脚本不进入 `npm test`。
