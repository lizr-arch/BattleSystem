# BattleSystem

浏览器优先的战斗系统验证沙盒，用来快速验证“异度之刃 2-like”的底层战斗闭环与最小 Combo 原型。

```text
普攻命中
  ↓
Arts 充能（普攻资源）
  ↓
后摇取消（到移动 / 到 Arts）
  ↓
Arts 命中（可选：Driver Combo）
  ↓
Special Gauge 充能（由 Arts 命中驱动）
  ↓
释放 Special（命中推进 Blade Combo）
  ↓
完成路线产出 Token（仅产出，不兑现）
```

V4.0 额外闭环（Single Driver Routine-Orb MVP）：

```text
Arts 命中（映射为套路技能）
  ↓
生成 Routine Tiles（最多 3 张）
  ↓
3 张同 Routine => 生成 Routine Orb（套路球）
  ↓
破球（元素伤害 + Burn）
  ↓
Burn tick 可击杀 => BattleEnded(Victory)
```

V4.2 额外闭环（Enemy Attack MVP）：

```text
敌人在范围内
  ↓
发动 EnemyStrike（敌人普通攻击）
  ↓
Startup / Active / Recovery（动作阶段）
  ↓
EnemyAttackHit => PlayerDamageApplied（玩家掉血）
  ↓
PlayerDefeated + BattleEnded(Defeat)（可失败）
```

V5 方向（Backpack + Blade Nested Socket）：

```text
Driver Backpack（9×9 驱动者背包）
  ↓
放入多个 BladeItem（异刃物品）
  ↓
Blade 内部装备生成 socket（嵌入槽位）
  ↓
socket 插入 ElementCore（元素核心）
  ↓
LoadoutResolver 输出 activeBlades
  ↓
BladeRuntime 参与自动攻击
```

明确边界：<= V5.1 不实现 Chain Attack / Full Burst / Fusion 等 payoff 机制；Orbs 仅实现 “Routine Orb（套路球）” 的最小闭环，不覆盖复杂属性球系统与连锁兑现；Enemy 仅实现单敌人、单技能（EnemyStrike）的最小攻击闭环，不实现追击/寻路/行为树/仇恨系统；V5.1 不实现拖拽 UI、物品旋转、异刃复杂 AI。

## V5.0 Backpack + Blade Nested Socket Design（设计中）

V5.0 是设计阶段，不改 gameplay code。阅读入口：

- `docs/v5-backpack-blade-index.md`
- `docs/backpack-loadout-design.md`
- `docs/blade-nested-socket-design.md`
- `docs/v5.1-backpack-blade-mvp-spec.md`

## V4.1 Enemy Attack Model Design（敌人攻击模型设计）

V4.1 是设计阶段，不实现复杂 NPC AI（敌人 AI）。它为 V4.2 Enemy Attack MVP Implementation（敌人攻击最小实现）提供开发规格：

- `docs/enemy-attack-model.md`
- `docs/npc-ai-design.md`
- `docs/v4.2-enemy-attack-mvp-spec.md`

## V4.2 Enemy Attack MVP（已实现）

- core：新增 EnemyStrike 配置与 enemy runtime state；敌人按距离与冷却自动发起攻击；命中可让玩家掉血并触发 Defeat。
- 可观察性：新增 `EnemyAttack*`、`PlayerDamageApplied/PlayerHpChanged/PlayerDefeated` 等事件；`getSnapshot()` 扩展 `snapshot.enemy/snapshot.player/snapshot.battle`。
- 一键验证入口：
  - Node：`npm test`（包含 enemy-attack/enemy-strike scenarios 与断言）。
  - Browser：右侧 Debug 面板 “Enemy/Player” 区块与 Scenario 按钮可直接复现 hit/whiff/defeat 等场景（不依赖键盘焦点）。

## V4.3 Player Defeat / Battle Failure Polish（已实现）

V4.3 是失败体验打磨阶段，不新增大玩法。目标是把 `BattleEnded Defeat（战斗失败）` 从事件结果打磨成稳定、可观察、可测试、可 reset 的失败体验。

设计文档：

- `docs/player-defeat-polish-design.md`
- `docs/v4.3-player-defeat-polish-spec.md`

## V1 目标与边界

这个仓库不是完整游戏项目，而是一个可重复验证战斗节奏的原型沙盒（浏览器可跑 + Node 可重复测试）。

Implemented / planned in the first browser prototype:

- Fixed-frame combat simulation.
- Player movement intent.
- Auto attack chain: `AA1 -> AA2 -> AA3`.
- Action phases: `Startup / Active / Recovery / Finished`.
- `Startup` cannot be soft-canceled by movement or art input.
- `Active` fires hit events and art charge.
- `Recovery` can be canceled into movement or ready arts.
- Short art input buffer.
- Cancel bonus window after hit.
- Browser HTML visual validation loop + Node tests.

## Test

```text
npm test
```

## Next steps

See:

- `docs/v5-backpack-blade-index.md`
- `docs/backpack-loadout-design.md`
- `docs/blade-nested-socket-design.md`
- `docs/v5.1-backpack-blade-mvp-spec.md`
- `docs/architecture.md`
- `docs/validation-plan.md`
- `docs/roadmap.md`
- `docs/system-map.md`
- `docs/mechanics-map.md`
- `docs/event-catalog.md`
- `docs/test-coverage-map.md`
- `docs/routine-orb-system.md`
- `docs/enemy-attack-model.md`
- `docs/npc-ai-design.md`
- `docs/v4.2-enemy-attack-mvp-spec.md`
- `docs/player-defeat-polish-design.md`
- `docs/v4.3-player-defeat-polish-spec.md`
- `docs/v3-readiness-review.md`
- `docs/v4-readiness-review.md`
