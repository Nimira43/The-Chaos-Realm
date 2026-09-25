import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { getMovementCost, MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap } from './utils.js'
import { resolveAttack, ATTACK_AP_COST } from './combat.js'
import { findPathToNearestGoal, getAdjacentTiles } from './pathfinding.js'
import { canCarryItem, hasKey, removeFirstKey } from './items.js'
import { ITEM_ACTION_AP_COST } from './useItemActions.js'
import { isMounted, getMoverStats, getMoverAp, withMoverAp, RIDE_AP_COST } from './mounts.js'
import {
  SIGHT_RANGE,
  chebyshevDist,
  findNearestPlayerTarget,
  pickWanderTarget,
  walkPath,
  tryRideAdjacentMount
} from './enemyAIShared.js'

const MAX_WIZARD_MOVE_LEGS = 4

function findItemTiles(itemLayer, predicate) {
  const tiles = []
  for (let y = 0; y < itemLayer.length; y++) {
    for (let x = 0; x < itemLayer[y].length; x++) {
      if ((itemLayer[y][x] || []).some(predicate)) tiles.push({ x, y })
    }
  }
  return tiles
}

function findTerrainTiles(terrainLayer, states) {
  const tiles = []
  for (let y = 0; y < terrainLayer.length; y++) {
    for (let x = 0; x < terrainLayer[y].length; x++) {
      if (states.includes(terrainLayer[y][x])) tiles.push({ x, y })
    }
  }
  return tiles
}

function findAdjacentDoorInState(terrainLayer, x, y, state) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = wrap(x + dx, terrainLayer[0].length)
      const ny = wrap(y + dy, terrainLayer.length)
      if (terrainLayer[ny][nx] === state) return { x: nx, y: ny }
    }
  }
  return null
}

function isCarryableKey(item) {
  return item.type === 'key' && canCarryItem(ENEMY_WIZARD.carry_limit, ENEMY_WIZARD.inventory, item)
}

function performEnemyWizardItemActions(terrainLayer, itemLayer) {
  let workingTerrain = terrainLayer
  let workingItems = itemLayer
  let acted = false

  if (!ENEMY_WIZARD.use_options) return { terrainLayer, itemLayer, acted }

  const setDoor = (door, state) => {
    workingTerrain = workingTerrain.map(row => [...row])
    workingTerrain[door.y][door.x] = state
  }

  while (ENEMY_WIZARD.ap >= ITEM_ACTION_AP_COST) {
    const { x, y } = ENEMY_WIZARD
    const itemsHere = workingItems[y][x] || []
    const keyIndex = itemsHere.findIndex(isCarryableKey)

    if (keyIndex !== -1) {
      const remaining = [...itemsHere]
      const [key] = remaining.splice(keyIndex, 1)
      workingItems = workingItems.map(row => [...row])
      workingItems[y][x] = remaining.length > 0 ? remaining : null
      ENEMY_WIZARD.inventory = [...(ENEMY_WIZARD.inventory || []), key]
      console.debug('[enemy wizard] picked up a key')
    } else if (hasKey(ENEMY_WIZARD.inventory) && findAdjacentDoorInState(workingTerrain, x, y, 'doorLocked')) {
      setDoor(findAdjacentDoorInState(workingTerrain, x, y, 'doorLocked'), 'doorUnlocked')
      ENEMY_WIZARD.inventory = removeFirstKey(ENEMY_WIZARD.inventory)
      console.debug('[enemy wizard] unlocked a door')
    } else if (findAdjacentDoorInState(workingTerrain, x, y, 'doorUnlocked')) {
      setDoor(findAdjacentDoorInState(workingTerrain, x, y, 'doorUnlocked'), 'doorOpen')
      console.debug('[enemy wizard] opened a door')
    } else {
      break
    }

    ENEMY_WIZARD.ap -= ITEM_ACTION_AP_COST
    acted = true
  }

  return { terrainLayer: workingTerrain, itemLayer: workingItems, acted }
}

function findKeyAndDoorPath(pathArgs, terrainLayer, itemLayer) {
  const doorStates = hasKey(ENEMY_WIZARD.inventory) ? ['doorLocked', 'doorUnlocked'] : ['doorUnlocked']
  const doorGoals = findTerrainTiles(terrainLayer, doorStates).flatMap(door => getAdjacentTiles(door.x, door.y))

  if (doorGoals.length > 0) {
    const path = findPathToNearestGoal({ ...pathArgs, goals: doorGoals })
    if (path.length > 0) return path
  }

  const keyGoals = findItemTiles(itemLayer, isCarryableKey)
  if (keyGoals.length === 0) return []

  return findPathToNearestGoal({ ...pathArgs, goals: keyGoals })
}

function findNearbyKeyPath(pathArgs, itemLayer) {
  const keyGoals = findItemTiles(itemLayer, isCarryableKey).filter(tile =>
    chebyshevDist(ENEMY_WIZARD.x, ENEMY_WIZARD.y, tile.x, tile.y) <= SIGHT_RANGE
  )
  if (keyGoals.length === 0) return []

  return findPathToNearestGoal({ ...pathArgs, goals: keyGoals, forbidLava: true })
}

function chooseEnemyWizardPath({ terrainLayer, objectLayer, effectLayer, itemLayer, portalPosition, moverStats }) {
  const { target, dist } = findNearestPlayerTarget(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
  const seekingPlayer = dist <= SIGHT_RANGE
  const adjacentToPlayerNow = seekingPlayer && chebyshevDist(ENEMY_WIZARD.x, ENEMY_WIZARD.y, target.x, target.y) <= 1
  const alreadyAtPortal = portalPosition && ENEMY_WIZARD.x === portalPosition.x && ENEMY_WIZARD.y === portalPosition.y

  const pathArgs = {
    terrainLayer, objectLayer, effectLayer,
    start: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
    entity: moverStats
  }

  let path = []

  if (portalPosition && !adjacentToPlayerNow && !alreadyAtPortal) {
    ENEMY_WIZARD.wanderTarget = null
    path = findPathToNearestGoal({ ...pathArgs, goals: [portalPosition] })

    if (path.length === 0) {
      path = findKeyAndDoorPath(pathArgs, terrainLayer, itemLayer)
    }
  }

  if (path.length === 0 && !alreadyAtPortal && seekingPlayer) {
    ENEMY_WIZARD.wanderTarget = null
    path = findPathToNearestGoal({ ...pathArgs, goals: getAdjacentTiles(target.x, target.y) })
  }

  if (path.length === 0 && !portalPosition && !alreadyAtPortal) {
    path = findNearbyKeyPath(pathArgs, itemLayer)
    if (path.length > 0) ENEMY_WIZARD.wanderTarget = null
  }

  if (path.length === 0 && !portalPosition && !alreadyAtPortal) {
    const reached =
      ENEMY_WIZARD.wanderTarget &&
      ENEMY_WIZARD.x === ENEMY_WIZARD.wanderTarget.x &&
      ENEMY_WIZARD.y === ENEMY_WIZARD.wanderTarget.y

    if (!ENEMY_WIZARD.wanderTarget || reached) {
      ENEMY_WIZARD.wanderTarget = pickWanderTarget(ENEMY_WIZARD.x, ENEMY_WIZARD.y, terrainLayer, objectLayer, moverStats)
    }

    if (ENEMY_WIZARD.wanderTarget) {
      path = findPathToNearestGoal({ ...pathArgs, goals: [ENEMY_WIZARD.wanderTarget], forbidLava: true })

      if (path.length === 0) ENEMY_WIZARD.wanderTarget = null
    }
  }

  return path
}

export function moveEnemyWizard(terrainLayer, objectLayer, portalPosition, effectLayer, itemLayer) {
  const { dist } = findNearestPlayerTarget(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
  const seekingPlayer = dist <= SIGHT_RANGE

  let currentLayer = objectLayer
  let workingTerrain = terrainLayer
  let workingItems = itemLayer
  let moved = false
  let lastPosition = null
  let selfDefeated = false
  const frames = []

  const ridden = tryRideAdjacentMount(currentLayer, workingTerrain, ENEMY_WIZARD.x, ENEMY_WIZARD.y, 'enemy', ENEMY_WIZARD, ENEMY_WIZARD.ap)
  if (ridden) {
    currentLayer = ridden
    ENEMY_WIZARD.ap -= RIDE_AP_COST
    frames.push(currentLayer)
    console.debug('[enemy wizard] mounted', currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x].mount.name)
  }

  const runItemActions = () => {
    const itemResult = performEnemyWizardItemActions(workingTerrain, workingItems)
    workingTerrain = itemResult.terrainLayer
    workingItems = itemResult.itemLayer
  }

  for (let leg = 0; leg < MAX_WIZARD_MOVE_LEGS; leg++) {
    runItemActions()

    const wizardCell = currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
    const mounted = isMounted(wizardCell)
    const moverStats = getMoverStats(wizardCell, ENEMY_WIZARD)

    const path = chooseEnemyWizardPath({
      terrainLayer: workingTerrain,
      objectLayer: currentLayer,
      effectLayer,
      itemLayer: workingItems,
      portalPosition,
      moverStats
    })

    if (path.length === 0) break

    console.debug(
      '[enemy wizard] path:',
      path.map(p => `${p.x},${p.y} (${workingTerrain[p.y][p.x]})`).join(' -> ')
    )

    const walkResult = walkPath({
      path,
      ap: getMoverAp(wizardCell, ENEMY_WIZARD.ap),
      terrainLayer: workingTerrain,
      objectLayer: currentLayer,
      onStep: {
        entity: () => moverStats,
        move: (layer, step, remainingAp) => {
          const newLayer = layer.map(row => [...row])
          const moving = newLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
          newLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = null
          ENEMY_WIZARD.x = step.x
          ENEMY_WIZARD.y = step.y
          const wizard = {
            type: 'enemyWizard',
            name: 'Enemy Wizard',
            owner: 'enemy',
            ref: ENEMY_WIZARD
          }
          newLayer[step.y][step.x] = moving?.mount ? { ...wizard, mount: { ...moving.mount, ap: remainingAp } } : wizard
          return newLayer
        }
      }
    })

    currentLayer = walkResult.objectLayer
    frames.push(...walkResult.frames)

    if (!mounted) ENEMY_WIZARD.ap = walkResult.ap

    if (walkResult.moved) {
      moved = true
      lastPosition = walkResult.lastPosition
    }

    if (walkResult.selfDefeated) {
      selfDefeated = true
      break
    }

    if (!walkResult.moved) break
  }

  if (!selfDefeated) runItemActions()

  let defeatedTarget = null

  if (!selfDefeated && seekingPlayer) {
    const { target: freshTarget } = findNearestPlayerTarget(currentLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
    const adjacency = chebyshevDist(ENEMY_WIZARD.x, ENEMY_WIZARD.y, freshTarget.x, freshTarget.y)
    const wizardCell = currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
    const attackAp = getMoverAp(wizardCell, ENEMY_WIZARD.ap)

    if (adjacency <= 1 && attackAp >= ATTACK_AP_COST) {
      const result = resolveAttack({
        objectLayer: currentLayer,
        attackerPos: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
        defenderPos: { x: freshTarget.x, y: freshTarget.y }
      })

      if (!result.blocked) {
        currentLayer = result.objectLayer

        if (isMounted(wizardCell)) {
          currentLayer = currentLayer.map(row => [...row])
          currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = withMoverAp(wizardCell, attackAp - ATTACK_AP_COST)
        } else {
          ENEMY_WIZARD.ap -= ATTACK_AP_COST
        }

        frames.push(currentLayer)
        if (result.defeated) defeatedTarget = result.defenderType
      }
    }
  }

  return {
    objectLayer: currentLayer,
    terrainLayer: workingTerrain,
    itemLayer: workingItems,
    moved,
    position: lastPosition,
    defeatedTarget,
    selfDefeated,
    frames
  }
}