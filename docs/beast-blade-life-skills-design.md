# 兽型异刃生活技能设计（Beast Blade Life Skills Design）

## 1. 设计目标

异刃不仅是战斗伙伴，也是野外探索的帮手。生活技能（Life Skills）代表异刃在非战斗场景中的特长能力。

**本阶段（V5.2）只做接口设计（LifeSkillTag + LifeSkillLevel），不实现完整的采集/狩猎/挖矿/资源/地图系统。**

后续 V5.5 Life Skill Hook 阶段只实现：

- LifeSkillTag 枚举
- LifeSkillLevel 数值
- resolvedLoadout.activeLifeSkills
- 不做完整采集 UI / 资源系统 / 地图系统

## 2. LifeSkillTag（技能标签）

定义 15 种生活技能标签。每项技能有 Lv1~Lv5 等级。以下是完整列表：

### Mining（挖矿）

- 描述：识别和采集矿物资源的能力
- 等级效果：Lv1 可采基础矿石 → Lv5 可采稀有矿石
- 倾向物种：Bear

### Hunting（打猎）

- 描述：追踪和猎杀野生动物的能力
- 等级效果：Lv1 可猎杀小型动物 → Lv5 可猎杀大型/稀有动物
- 倾向物种：Tiger、Wolf

### Tracking（追踪）

- 描述：发现和跟踪生物足迹/痕迹的能力
- 等级效果：Lv1 可见近期足迹 → Lv5 可见较旧足迹并识别目标状态
- 倾向物种：Wolf、Eagle

### Foraging（采集）

- 描述：识别和采集可食用/可用植物的能力
- 等级效果：Lv1 可采集基础植物 → Lv5 可采集稀有药材
- 倾向物种：通用

### Fishing（捕鱼）

- 描述：在水域中捕鱼的能力
- 等级效果：Lv1 可捕获小鱼 → Lv5 可捕获稀有鱼类
- 倾向物种：Turtle

### Logging（伐木）

- 描述：砍伐树木获取木材的能力
- 等级效果：Lv1 可砍伐小树 → Lv5 可砍伐稀有古木
- 倾向物种：Bear

### Scouting（侦查）

- 描述：远距离发现敌人/资源/地形的能力
- 等级效果：Lv1 扩大少量视野 → Lv5 显著扩大视野并标注资源点
- 倾向物种：Eagle、Tiger

### TreasureSense（寻宝）

- 描述：感知附近隐藏宝箱或贵重物品的能力
- 等级效果：Lv1 在近距离感知 → Lv5 在较大范围精确定位
- 倾向物种：Eagle

### Herbalism（采药）

- 描述：识别和采集药用植物的能力
- 等级效果：Lv1 可采集基础草药 → Lv5 可采集稀有药材并识别毒性
- 倾向物种：Snake

### NightVision（夜视）

- 描述：在黑暗环境中保持视野的能力
- 等级效果：Lv1 微光下可视 → Lv5 完全黑暗中保持大部分视野
- 倾向物种：Wolf

### Swimming（水域探索）

- 描述：在水中移动和探索的能力
- 等级效果：Lv1 可涉浅水 → Lv5 可潜入深水区探索
- 倾向物种：Turtle

### Climbing（攀爬）

- 描述：攀爬悬崖/树木/建筑的能力
- 等级效果：Lv1 可攀爬低矮障碍 → Lv5 可攀爬悬崖绝壁
- 倾向物种：Snake

### Carrying（搬运）

- 描述：携带额外负重的能力
- 等级效果：Lv1 额外负重+10% → Lv5 额外负重+50%
- 倾向物种：Bear、Turtle

### Guarding（护卫）

- 描述：在非战斗状态保护主角免受环境威胁的能力
- 等级效果：Lv1 可警戒低级威胁 → Lv5 可提前警告并抵御大部分环境威胁
- 倾向物种：Bear、Tiger、Turtle

### PoisonSense（毒物识别）

- 描述：识别毒物、毒气和有毒环境的能力
- 等级效果：Lv1 可识别常见毒物 → Lv5 可识别所有毒物并提供抗性
- 倾向物种：Snake

## 3. 物种与生活技能倾向映射

不同物种天生擅长不同生活技能。下表为默认倾向：

### Bear（熊）

- 主倾向：Mining、Carrying、Guarding
- 副倾向：Logging、Foraging
- 说明：熊力大无穷，适合矿工/搬运/护卫角色

### Tiger（虎）

- 主倾向：Hunting、Scouting、Guarding
- 副倾向：Tracking、Climbing
- 说明：虎是顶级猎手，兼具侦查与护卫能力

### Wolf（狼）

- 主倾向：Tracking、Hunting、NightVision
- 副倾向：Scouting、Foraging
- 说明：狼擅长追踪猎杀和夜间活动

### Turtle（龟）

- 主倾向：Swimming、Guarding、Carrying
- 副倾向：Fishing、Herbalism
- 说明：龟稳如磐石，水中活动自如，擅长防守与负重

### Eagle（鹰）

- 主倾向：Scouting、TreasureSense、Tracking
- 副倾向：Hunting、Climbing
- 说明：鹰翱翔天空，侦察寻宝能力无人能及

### Snake（蛇）

- 主倾向：Herbalism、PoisonSense、Climbing
- 副倾向：Tracking、Foraging
- 说明：蛇精于毒物与药草，攀爬无碍

不同品系可能有调整（如 SnowWolf 的 NightVision 天生等级高于 GreyWolf）。

## 4. LifeSkillLevel（技能等级）

每项生活技能分 5 级：

- Lv1：基础（初始等级，大多数异刃天生拥有的基础技能从此开始）
- Lv2：熟练（有明显效果提升）
- Lv3：精通（效果显著，是该物种的标志性能力）
- Lv4：专家（远超同类）
- Lv5：大师（领域内登峰造极）

初始等级由物种/品系/稀有度决定：

- Common 异刃：主倾向 Lv1~2，副倾向 Lv1
- Uncommon 异刃：主倾向 Lv2，副倾向 Lv1~2
- Rare 异刃：主倾向 Lv2~3，副倾向 Lv2
- Legendary 异刃：主倾向 Lv3，副倾向 Lv2~3

## 5. 成长机制

**Life Skills 可以随 Trust 成长：**

- Trust Lv2：所有生活技能 +1 级（但不超过物种上限）
- Trust Lv3：主倾向技能可额外 +1 级
- Trust Lv4：副倾向技能可额外 +1 级
- Trust Lv5：一项主倾向技能突破上限到 Lv5

成长规则：

- 生活技能等级不能超过 Lv5
- 不是所有异刃的所有技能都能达到 Lv5
- Legendary 异刃的成长空间更大

## 6. 后续接口预留

本阶段定义数据结构接口（不实现代码）：

```
// 概念接口（仅供参考，V5.5 实现）
LifeSkillTag: Mining|Hunting|Tracking|Foraging|Fishing|Logging|Scouting|TreasureSense|Herbalism|NightVision|Swimming|Climbing|Carrying|Guarding|PoisonSense

LifeSkillEntry: { tag, level: 1-5 }

BeastBladeLifeSkills: LifeSkillEntry[]

// resolvedLoadout 中新增：
activeLifeSkills: LifeSkillEntry[]
```

## 7. 与现有系统的关系

- Beast Blade Archetype：物种/品系决定初始 LifeSkills
- Bond System (Trust)：Trust 成长驱动 LifeSkill 升级
- LoadoutResolver：解析 activeLifeSkills 到 resolvedLoadout
- UI（日后）：在异刃详情面板中展示生活技能标签和等级
- 采集/狩猎/挖矿系统（V5.5+）：读取 activeLifeSkills 影响野外行为

## 8. 不做内容

- 不实现采集 UI
- 不实现资源/背包/物品系统
- 不实现地图系统
- 不实现野外场景/遭遇系统
- 不实现狩猎/挖矿/捕鱼等玩法逻辑
- V5.5 只做 LifeSkillTag + LifeSkillLevel + resolvedLoadout.activeLifeSkills 三个接口
