# Blade Nested Socket Design（异刃嵌套槽位设计）

> 本文定义 Blade（异刃）如何作为 Driver Backpack（驱动者背包）中的大物品，同时拥有自己的 Internal Equipment（内部装备界面），并通过内部装备在 Blade footprint（异刃占地）内生成 Socket（嵌入槽位）。

## 1. 设计目标

Blade（异刃）在 V5 中不是普通装备槽里的装备，而是一个可放进 Driver Backpack（驱动者背包）的占格物品。

同时，Blade 自己有内部装备界面：

```text
Blade Item（异刃物品，占 Driver 背包格子）
  ↓
Blade Internal Equipment（异刃内部装备）
  ↓
Slot Module（槽位扩展装备）
  ↓
Generated Socket（在异刃占地内生成插槽）
  ↓
Socket Item（插入核心/符文）
```

Blade 内部装备不直接占 Driver Backpack 格子。

## 2. Blade Item（异刃物品）

Blade Item 放在 Driver Backpack 中，拥有 footprint（占地）。

示例：

```js
bladeItem: {
  id: 'CrimsonBlade',
  type: 'Blade',
  role: 'DPS',
  footprint: { width: 3, height: 3 },
  internalEquipment: {
    slotModule: 'SmallSocketModule',
    weapon: null,
    core: null
  }
}
```

V5.1 只需要：

- DPS Blade（输出异刃）。
- Tank Blade（肉异刃）。
- 2×2、3×2、3×3 等矩形 footprint。

## 3. Blade Internal Equipment（异刃内部装备）

Blade 内部装备是 Blade 自己界面里的装备，不占 Driver Backpack 格子。

第一版只设计：

```text
SlotModule（槽位扩展装备）
```

未来可扩展：

- BladeWeapon（异刃武器）。
- BladeArmor（异刃防具）。
- BladeCore（异刃核心）。
- BladeCharm（异刃挂件）。

但 V5.1 不需要实现全部。

## 4. Slot Module（槽位扩展装备）

Slot Module 是 Blade 内部装备，它会在 Blade footprint 内生成 sockets。

示例：

```js
slotModule: {
  id: 'SmallSocketModule',
  generatedSockets: [
    {
      socketId: 'socket_1',
      x: 1,
      y: 1,
      width: 1,
      height: 1,
      accepts: ['ElementCore']
    }
  ]
}
```

其中 x/y 是相对于 Blade footprint 左上角的局部坐标。

## 5. Generated Socket（生成插槽）规则

### 5.1 Socket 必须在 Blade footprint 内

如果 Blade 是 3×3，则 socket 必须满足：

```js
socket.x >= 0
socket.y >= 0
socket.x + socket.width <= blade.width
socket.y + socket.height <= blade.height
```

合法：

```text
Blade 3×3, socket 1×1 at (1,1)
```

非法：

```text
Blade 3×3, socket 2×2 at (2,2)
```

因为 x+width=4，超出 3。

### 5.2 Socket 尺寸不能大于 Blade footprint

Socket 可以是：

- 1×1
- 1×2
- 2×1
- 2×2

但不能超出 Blade 自己的 footprint。

V5.1 只实现 1×1 socket。

### 5.3 Socket 有 accepts（接受类型）

示例：

```js
accepts: ['ElementCore']
```

这意味着只有 ElementCore（元素核心）可以插入。

## 6. Socket Item（插槽物品）

Socket Item 是插入 Generated Socket 的小物品。

V5.1 只做一种：

```js
elementCore: {
  id: 'FireCore',
  type: 'ElementCore',
  element: 'Fire',
  damageBonus: 0.1
}
```

规则：

- Blade 本体不自带 Element（属性）。
- 如果 Blade 的 socket 插了 FireCore，则 Blade Runtime 的 element = Fire。
- 如果未插 ElementCore，则 element = Neutral（中性）。

## 7. Global Socket Position（全局槽位位置）

Blade 放在背包中的位置：

```js
placedBlade: { x: 2, y: 3, width: 3, height: 3 }
```

Socket 局部位置：

```js
socket: { x: 1, y: 1, width: 1, height: 1 }
```

则全局位置：

```js
globalX = placedBlade.x + socket.x
globalY = placedBlade.y + socket.y
```

即：

```text
(3, 4)
```

该位置在 UI 上可显示为 Blade 内部可插入格。

## 8. Resolved Blade（解析后的异刃）

LoadoutResolver（构筑解析器）应输出：

```js
resolvedBlade: {
  bladeInstanceId: 'blade_001',
  bladeId: 'CrimsonBlade',
  role: 'DPS',
  footprint: { x: 0, y: 0, width: 3, height: 3 },
  sockets: [
    {
      socketId: 'socket_1',
      globalX: 1,
      globalY: 1,
      itemId: 'FireCore',
      itemType: 'ElementCore'
    }
  ],
  element: 'Fire',
  damageBonus: 0.1
}
```

战斗系统只使用 resolvedBlade，不直接读取 Blade internal equipment。

## 9. Blade Role（异刃定位）

V5.1 只支持两种：

| Role | 中文 | MVP 行为 |
| --- | --- | --- |
| Tank | 肉 | 预留承伤/减伤。V5.1 可只解析 role，不实现减伤。 |
| DPS | 输出 | Blade 自动攻击造成较高伤害。 |

V5.2 再实现更强 role 差异：

- Tank Blade 降低玩家受到的伤害。
- DPS Blade 提高输出。

## 10. Blade Combat（异刃战斗）关系

V5.1 中，Blade Runtime（异刃战斗单位）应从 resolvedBlade 创建。

最低目标：

```text
resolvedBlade.element = Fire
  ↓
BladeAttackHit element=Fire
  ↓
DamageApplied target=Dummy source=Blade
```

## 11. 明确不做

V5.1 不做：

- Blade 独立寻路。
- Blade 手动技能释放。
- Blade 自己挂 RoutineOrb（套路球）。
- 多 socket 复杂形状。
- Blade 内部装备 UI。
- 背包拖拽 UI。
- 装备成长/强化。

> V5.1 已实现。核心文件: `src/core/backpack-items.js`、`src/core/loadout-resolver.js`、`src/core/blade-runtime.js`。
