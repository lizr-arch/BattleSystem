# 异刃羁绊系统设计（Blade Bond System Design）

**V5.4.1 实现状态**: Bond System MVP 已实现。V5.5.1 新增 Trust Unlock Combat Slot：Trust Lv3 解锁 `BondCombatSlot1`（数据层，不消费）。Trust/Mood/Sync 三维度、BladeAttackHit/Victory/Defeat 事件挂钩、Loyal/Proud trait 影响已落地。V5.4.1 新增 Bond 生命周期语义：Trust 跨 resetRuntime 保留、Mood 在 resetRuntime 后回到 50、Sync 在 resetRuntime 后清零。详细实现见 `src/core/bond.js` 与 `src/core/blade-runtime.js`。

注意：BondSkillUnlocked/BondSocketUnlocked/BondMilestoneReached/BondAssistActivated 仍未实现。

**V5.4 明确不做**：送礼系统、喂食系统、羁绊剧情/事件、多异刃好感竞争、异刃离队、Life Skill gameplay。

## Bond 生命周期（V5.4.1）

V5.4.1 明确了 Bond 三维度在 resetRuntime 时的行为：

- **Trust（信任）**：长期值，`resetRuntime()` 后不丢失。BladeRuntime 创建时从 `resolvedBlade.bond.trust` 恢复。
- **Mood（心情）**：短期值，`resetRuntime()` 后回到中性值 50。
- **Sync（战斗默契）**：战斗内值，`resetRuntime()` 后清零。

实现细节：
- `BladeRuntime.exportBondSnapshot({ resetBattleTransient })` 导出 bond 状态
- `CombatActor.commitBladeBondStates({ resetBattleTransient })` 将 runtime bond 同步回 resolvedLoadout
- `resetRuntime()` 在清空 bladeRuntimes 前调用 `commitBladeBondStates({ resetBattleTransient: true })`，将 Mood/Sync 重置后写回
- Victory/Defeat 后也调用 `commitBladeBondStates({ resetBattleTransient: false })`，确保 Trust 持久化

V5.4.1 不做：送礼/喂食/羁绊剧情/多异刃好感竞争/异刃离队/Life Skill gameplay/Chain Attack/Full Burst/Fusion Combo。

## Trust Unlock Combat Slot（V5.5.1）

V5.5.1 实现 Trust Lv3 解锁 `BondCombatSlot1`：

- Trust Lv1/Lv2：`resolvedBlade.unlocks.combatSlots = []`
- Trust Lv3+：`resolvedBlade.unlocks.combatSlots = ['BondCombatSlot1']`

实现文件：`src/core/combat-unlocks.js`。

解锁不消费（不装备技能、不改变伤害），仅作为后续技能/槽位系统的数据入口。DebugPanel 可在 Backpack/Blades 区块查看 Unlocks。

V5.5.1 不做：技能系统、Socket UI、Trait upgrade、Element 交互、Chain Attack、Full Burst、Fusion Combo。

## 1. 设计目标

羁绊（Bond）不是简单的"好感度"系统。羁绊是异刃与 Driver 之间多层次的关系系统，拆分为三维度：

- **Trust（信任）**：长期积累的关系深度，成长慢但持久
- **Mood（心情）**：短期波动的情感状态，受战斗事件影响大
- **Sync（战斗默契）**：战斗中的即时配合度，影响协同效果

三个维度独立计算，互相影响但不完全绑定。

核心设计原则：**羁绊改变的是行为、触发条件、技能解锁、socket 潜力、协同机会——而不是简单的攻击力+1%。**

## 2. Trust（信任）

Trust 是 Driver 与异刃之间的长期信任值。成长缓慢，但不会轻易下降。

### 来源

- 一起战斗（每场战斗结束后小幅增长）
- 参与胜利（异刃命中过敌人或造成过伤害）
- 主角低血时异刃保护了主角（护主事件触发）
- 长期携带（保持异刃在 active loadout 中）
- 使用异刃偏好的战斗方式（如狼喜欢追击风格、熊喜欢重击风格）
- 特殊羁绊事件（日后扩展，如喂食、任务等）

### 作用

- **解锁技能**：Trust 达到特定等级解锁异刃的新战斗技能
- **解锁特殊动作**：高 Trust 解锁特殊出场动画或战斗中特殊行为
- **提高协同触发概率**：Trust 越高，Sync 触发的协同效果概率越高
- **解锁更多内部 socket**：Trust 等级提升可以解锁异刃内部的隐藏 socket 槽位
- **允许高级 SlotModule**：某些高级模块需要最低 Trust 等级才能装备
- **影响 LifeSkill 成长**：生活技能可随 Trust 成长

### Trust 等级

建议分 5 级：
- Lv1：初识（起点）
- Lv2：信赖（解锁第一个隐藏技能）
- Lv3：深交（解锁第二个 socket）
- Lv4：挚友（解锁特殊动作或技能）
- Lv5：灵魂羁绊（解锁全部潜力和隐藏机制）

Trust 不下降（或仅在极端情况下降，如长时间不使用）。

## 3. Mood（心情）

Mood 是短期波动的情感状态。变化快，影响当前战斗表现。

### 来源

正面：
- 连续命中目标
- 异刃技能触发成功
- 战斗胜利
- 使用异刃喜欢的食物（日后扩展）
- 战斗风格符合异刃性格（如 Fierce 异刃喜欢激进打法）

负面：
- 连续受到伤害
- 异刃濒死（低血量）
- Driver 频繁将异刃换下
- 战斗失败/逃跑
- 战斗风格违背异刃性格（如 Cautious 异刃被逼入险境）
- 被控制（Driver Combo 中被 Break/Topple 等）

### 作用

- **影响自动技能触发频率**：Mood 高时触发更频繁，低时触发降低
- **影响主动性**：Mood 高时异刃更主动攻击、更积极保护主角；Mood 低时攻击迟疑
- **影响战斗表现**：
  - 高 Mood：攻击频率+10~20%，技能冷却缩短
  - 低 Mood：攻击频率-10~20%，可能拒绝使用某些技能
- **影响 Sync 累积速度**：Mood 高时 Sync 累积更快
- **影响表现和语音**（日后 UI 层）：不同的 Mood 状态有不同动画和反馈

### Mood 结构

不单纯是一个数值条：
- 高 Mood 区（70-100）：异刃状态良好，表现积极
- 中 Mood 区（40-70）：正常状态
- 低 Mood 区（0-40）：异刃消极，表现下降

Mood 上下限为 0-100，每次战斗重置到中性值（50），战斗中波动。

## 4. Sync（战斗默契）

Sync 是 Driver 与异刃在战斗中的即时配合度。它是短暂的，只反映当前战斗片段的配合质量。

### 来源

- 异刃攻击命中后，Driver 紧接着使用武技（Cancel 窗口内）
- Driver 破 RoutineOrb（削球）后，异刃立即追击命中
- 异刃护主后（挡下攻击），Driver 紧接着反击命中
- Driver 和异刃同时对同一目标造成伤害（短时间内）
- 特定技能组合触发（异刃标记目标后，Driver 武技命中该目标）

### 作用

- **触发协同技（Bond Assist）**：Sync 达到峰值时触发一次特殊的协同攻击
- **强化下一次 BladeAttack**：累积的 Sync 转化为下一次异刃攻击的伤害加成
- **增加 Special Gauge**：Sync 触发时额外增加 Driver 的 Special Gauge 充能
- **解锁瞬发窗口**：高 Sync 允许异刃在下一次攻击时跳过部分冷却时间
- **Sync 联动 Trust**：Trust 越高，Sync 累积上限越高，单次触发效果越强

### Sync 结构

- Sync 是一个战斗中累积的瞬时值（0-100）
- 每次触发来源会增加 Sync
- Sync 随时间自然衰减（不在配合时逐渐下降）
- 达到阈值（如 75）触发协同效果并重置
- Trust 等级决定 Sync 的上限和衰减速度

## 5. 三维度互动

Trust、Mood、Sync 之间不是孤立的：

- Trust 越高 → Mood 波动越小（关系稳固，小事不影响心情）
- Trust 越高 → Sync 累积上限越高（配合更有默契）
- Mood 越高 → Sync 累积速度越快（心情好配合更顺畅）
- Sync 触发成功 → Mood 短暂提升（配合成功让异刃兴奋）
- Mood 极低且持续时间长 → Trust 可能微幅下降（长期关系受损，罕见）

## 6. 羁绊事件接口（日后扩展）

预留羁绊事件类型（本阶段不实现代码）：

- BondTrustChanged：Trust 等级变化
- BondMoodChanged：Mood 变化
- BondSyncTriggered：Sync 达到阈值触发协同
- BondAssistActivated：协同技释放
- BondSkillUnlocked：羁绊等级解锁新技能
- BondSocketUnlocked：羁绊等级解锁新 socket
- BondMilestoneReached：达到关键羁绊里程碑

## 7. 与现有系统的关系

- BladeRuntime：读取 Bond 状态以调整攻击频率、协同触发、技能可用性
- LoadoutResolver：解析 Trust 等级以确定可用的技能和 socket
- CombatEventLog：记录羁绊相关事件
- UI（日后）：展示羁绊状态、心情图标、Trust 等级

## 8. 不做内容

- 不实现可消耗礼物/喂食系统（V5.2~V5.4 阶段不做）
- 不实现多异刃之间的好感竞争
- 不实现羁绊下降导致异刃离队
- 不实现复杂的好感度 UI / 动画
- Bond 数值不直接展示在普通 UI，只在 Debug UI 可见
