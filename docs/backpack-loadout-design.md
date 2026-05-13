# Backpack Loadout Design（背包构筑设计）

本文定义 V5 的 Driver Backpack（驱动者背包）和 Loadout Resolver（构筑解析器）。本文只讨论外层 9×9 背包与物品占格，不讨论 Blade（异刃）的内部装备槽位；内部槽位见 `docs/blade-nested-socket-design.md`。

## 1. 设计目标

V5 的核心变化：Driver（驱动者）不再通过固定装备栏挂接 Blade（异刃），而是通过 9×9 Backpack（背包）进行战斗构筑。

```text
Driver（驱动者）
  ↓
Driver Backpack（9×9 驱动者背包）
  ↓
Placed Items（已放置物品）
  ↓
Loadout Resolver（构筑解析器）
  ↓
ResolvedLoadout（解析后构筑）
  ↓
CombatActor（战斗角色）
```

V5.1 的背包系统是数据驱动的，不做拖拽 UI。浏览器 UI 只做最小可观察显示。

## 2. Driver Backpack

第一版固定为 9×9：

```js
backpack = {
  width: 9,
  height: 9,
  items: []
}
```

背包内所有 item（物品）都必须有：

```js
placedItem = {
  instanceId: 'item_001',
  itemId: 'CrimsonBlade',
  type: 'Blade',
  x: 0,
  y: 0,
  width: 3,
  height: 3,
  rotation: 0
}
```

V5.1 不做 rotation（旋转），但保留字段以便后续扩展。

## 3. Item Definition（物品定义）

```js
itemDefinition = {
  id: 'CrimsonBlade',
  type: 'Blade',
  width: 3,
  height: 3,
  bladeRole: 'DPS'
}
```

MVP 物品类型：

| Type | 中文 | 用途 |
| --- | --- | --- |
| Blade | 异刃 | 战斗伙伴，占 2×2、3×2、3×3 等空间。 |
| Weapon | 武器 | 大物品，后续用于背包加成。 |
| Consumable | 消耗品 | 预留。 |
| Material | 材料 | 预留。 |

Blade Internal Equipment（异刃内部装备）不属于 Driver Backpack 中的普通物品。它属于 Blade 自己的内部界面。

## 4. Placement Rules（放置规则）

必须在边界内：

```js
x >= 0
y >= 0
x + width <= backpack.width
y + height <= backpack.height
```

普通物品不能重叠。

Blade footprint（异刃占地）是硬占用。如果 Blade 占 3×3，则这 9 个格子整体属于 Blade。其他 Driver Backpack 物品不能直接放入这 9 个格子。

例外：Blade 内部装备生成的 socket 可以在这个 footprint 内显示可插入空间，但这属于 Blade Nested Socket（异刃嵌套槽位）系统，不是普通背包重叠。

## 5. Loadout Resolver（构筑解析器）

Combat（战斗）不应每帧扫描 9×9 背包。

```text
Backpack data
  ↓
validatePlacement
  ↓
resolveLoadout
  ↓
ResolvedLoadout
  ↓
CombatActor 使用 activeBlades
```

解析结果示例：

```js
resolvedLoadout = {
  activeBlades: [
    {
      bladeInstanceId: 'blade_001',
      bladeId: 'CrimsonBlade',
      role: 'DPS',
      footprint: { x: 0, y: 0, width: 3, height: 3 },
      element: 'Fire',
      linkedSockets: ['socket_001']
    }
  ],
  errors: []
}
```

## 6. Active Blade Limit（激活异刃上限）

背包里可以放多个 Blade（异刃），但 V5.1 建议限制：

```text
最多激活 2 个 BladeRuntime（异刃战斗单位）
```

规则：

```text
按背包扫描顺序，从左上到右下，取前 2 个合法 Blade 作为 activeBlades。
```

后续可改为由 ActivationItem（激活器）或能量预算决定。

## 7. V5.1 最小验证

- 9×9 背包可创建。
- 3×3 Blade 可合法放置。
- 3×3 Blade 越界会失败。
- 两个 Blade 重叠会失败。
- 多个 Blade 时 resolver 只激活前 2 个。
- CombatActor 只读 ResolvedLoadout，不直接扫描 backpack。

## 8. 明确不做

V5.1 不做：

- 拖拽 UI。
- 旋转物品。
- 复杂多格形状。
- 背包排序。
- 多背包页。
- 背包商店 / 掉落。
- 复杂背包邻接加成。
