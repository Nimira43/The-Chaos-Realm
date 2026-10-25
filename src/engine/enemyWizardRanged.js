import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap, wrappedChebyshevDistance } from './utils.js'
import {
  resolveAttack,
  resolveThrownWeaponAttack,
  getCellCombatValue,
} from './combat.js'
import { isCurrentlyFlying } from './mounts.js'
import { ITEM_ACTION_AP_COST } from './useItemActions.js'
import { isPlayerSide } from './enemyScans.js'

export const ENEMY_THROW_RANGE = 2
export const MAX_RANGED_ACTIONS_PER_TURN = 3

function getBow(inventory) {
  return (
    (inventory || [])
      .filter((i) => i.type === 'weapon' && i.ranged > 0)
      .sort((a, b) => b.ranged - a.ranged)[0] || null
  )
}

function getThrowable(inventory) {
  return (
    (inventory || [])
      .filter((i) => i.type === 'weapon' && i.thrown > 0)
      .sort((a, b) => b.thrown - a.thrown)[0] || null
  )
}

function listTargets(objectLayer, radius) {
  const targets = []

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue

      const x = wrap(ENEMY_WIZARD.x + dx, MAP_WIDTH)
      const y = wrap(ENEMY_WIZARD.y + dy, MAP_HEIGHT)
      const cell = objectLayer[y][x]
      if (!isPlayerSide(cell)) continue

      targets.push({
        x,
        y,
        isWizard: cell.type === 'player',
        combat: getCellCombatValue(cell),
        distance: wrappedChebyshevDistance(
          ENEMY_WIZARD.x,
          ENEMY_WIZARD.y,
          x,
          y,
          MAP_WIDTH,
          MAP_HEIGHT,
        ),
      })
    }
  }

  return targets.sort(
    (a, b) =>
      Number(b.isWizard) - Number(a.isWizard) ||
      b.combat - a.combat ||
      a.distance - b.distance,
  )
}

export function runEnemyWizardRanged(terrainLayer, objectLayer, itemLayer) {
  let layer = objectLayer
  let items = itemLayer
  const frames = []
  let defeatedTarget = null
  let actions = 0

  while (actions < MAX_RANGED_ACTIONS_PER_TURN) {
    const wizardCell = layer[ENEMY_WIZARD.y]?.[ENEMY_WIZARD.x]
    if (!wizardCell || isCurrentlyFlying(wizardCell)) break
    if (ENEMY_WIZARD.ap < ITEM_ACTION_AP_COST) break

    const bow = getBow(ENEMY_WIZARD.inventory)
    const throwable = getThrowable(ENEMY_WIZARD.inventory)
    if (!bow && !throwable) break

    const reach = Math.max(
      bow ? bow.ranged : 0,
      throwable ? ENEMY_THROW_RANGE : 0,
    )
    let acted = false

    for (const t of listTargets(layer, reach)) {
      if (bow && t.distance <= bow.ranged) {
        const result = resolveAttack({
          objectLayer: layer,
          terrainLayer,
          attackerPos: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
          defenderPos: { x: t.x, y: t.y },
        })
        if (result.blocked) continue

        layer = result.objectLayer
        if (result.defeated) defeatedTarget = result.defenderType
        acted = true
      } else if (
        throwable &&
        t.distance >= 2 &&
        t.distance <= ENEMY_THROW_RANGE
      ) {
        const result = resolveThrownWeaponAttack({
          objectLayer: layer,
          terrainLayer,
          defenderPos: { x: t.x, y: t.y },
          throwerCombat: ENEMY_WIZARD.combat,
          thrownCombat: throwable.thrown,
          bypassUndead: throwable.attackUndead,
        })
        if (result.blocked) continue

        layer = result.objectLayer
        ENEMY_WIZARD.inventory = ENEMY_WIZARD.inventory.filter(
          (i) => i.id !== throwable.id,
        )

        items = items.map((row) => [...row])
        items[t.y][t.x] = [...(items[t.y][t.x] || []), throwable]

        if (result.defeated) defeatedTarget = result.defenderType
        acted = true
      } else {
        continue
      }

      ENEMY_WIZARD.ap -= ITEM_ACTION_AP_COST
      actions++
      frames.push(layer)
      break
    }

    if (!acted || defeatedTarget === 'player') break
  }

  return {
    objectLayer: layer,
    itemLayer: items,
    frames,
    defeatedTarget,
    actions,
  }
}
