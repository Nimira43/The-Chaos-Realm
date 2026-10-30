import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { ENEMY_SPELLBOOK } from '../data/enemySpellbook.js'
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  IMPASSABLE_THRESHOLD,
  getMovementCost,
} from './terrain.js'
import { isSealedIn } from './enemyEscape.js'
import { wrap, wrappedChebyshevDistance } from './utils.js'
import { resolveAttack, ATTACK_AP_COST } from './combat.js'
import { findPathToNearestGoal, getAdjacentTiles } from './pathfinding.js'
import {
  canCarryItem,
  hasKey,
  removeFirstKey,
  isConsumedOnPickup,
} from './items.js'
import { ITEM_ACTION_AP_COST } from './useItemActions.js'
import { canTakeOffFrom, canLandOn } from './useMountActions.js'
import {
  canRide,
  canFly,
  isMounted,
  isMountCreature,
  isCurrentlyFlying,
  getMoverStats,
  getMoverAp,
  withMoverAp,
  withFlying,
  mountRider,
  RIDE_AP_COST,
  FLY_TOGGLE_AP_COST,
} from './mounts.js'
import {
  SIGHT_RANGE,
  chebyshevDist,
  findNearestPlayerTarget,
  walkPath,
} from './enemyAIShared.js'
import { scanThreat } from './enemyScans.js'
import { findWalkInLandings, isOnWalkInGround } from './enemyPortalRoute.js'
import { getThreatTier } from './enemyWizardSpells.js'

export const LOOT_SEARCH_RANGE = 15

const MAX_WIZARD_MOVE_LEGS = 4

const SEARCH_LIMIT = 3500

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

function isWantedItem(item) {
  if (isConsumedOnPickup(item)) return true
  return canCarryItem(ENEMY_WIZARD.carry_limit, ENEMY_WIZARD.inventory, item)
}

function findLootGoals(itemLayer, landable = null) {
  const goals = []

  for (let y = 0; y < itemLayer.length; y++) {
    for (let x = 0; x < itemLayer[y].length; x++) {
      const items = itemLayer[y][x]
      if (!items || !items.some(isWantedItem)) continue
      if (x === ENEMY_WIZARD.x && y === ENEMY_WIZARD.y) continue
      if (
        wrappedChebyshevDistance(
          ENEMY_WIZARD.x,
          ENEMY_WIZARD.y,
          x,
          y,
          MAP_WIDTH,
          MAP_HEIGHT,
        ) > LOOT_SEARCH_RANGE
      )
        continue
      if (
        landable &&
        !canLandOn(landable.terrainLayer[y][x], landable.stats, items)
      )
        continue
      goals.push({ x, y })
    }
  }

  return goals
}

function findAdjacentOwnMounts(objectLayer) {
  const found = []

  for (const tile of getAdjacentTiles(ENEMY_WIZARD.x, ENEMY_WIZARD.y)) {
    const cell = objectLayer[tile.y][tile.x]
    if (
      cell?.type === 'creature' &&
      cell.owner === 'enemy' &&
      isMountCreature(cell.stats) &&
      !cell.mount
    ) {
      found.push({ pos: tile, cell })
    }
  }

  return found
}

function findLiftOffStep(
  terrainLayer,
  objectLayer,
  effectLayer,
  itemLayer,
  wizardCell,
) {
  if (
    !isMounted(wizardCell) ||
    !canFly(wizardCell.mount.stats) ||
    wizardCell.mount.flying
  )
    return null
  if (canTakeOffFrom(terrainLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x])) return null
  if (!isSealedIn(terrainLayer, objectLayer, itemLayer)) return null

  const groundStats = { ...wizardCell.mount.stats, isFlyingNow: false }

  for (const tile of getAdjacentTiles(ENEMY_WIZARD.x, ENEMY_WIZARD.y)) {
    const terrain = terrainLayer[tile.y][tile.x]
    if (terrain === 'portal' || !canTakeOffFrom(terrain)) continue
    if (objectLayer[tile.y][tile.x] || effectLayer[tile.y][tile.x]) continue

    const cost = getMovementCost(terrain, groundStats)
    if (cost >= IMPASSABLE_THRESHOLD) continue
    if (wizardCell.mount.ap < cost + FLY_TOGGLE_AP_COST) continue

    return tile
  }

  return null
}

function pickBestFlyingMount(objectLayer) {
  return (
    findAdjacentOwnMounts(objectLayer)
      .filter((m) => canFly(m.cell.stats))
      .sort((a, b) => b.cell.stats.combat - a.cell.stats.combat)[0] || null
  )
}

function collect(item) {
  if (item.type === 'apple') {
    const potion = ENEMY_SPELLBOOK.find((s) => s.name === 'Healing Potion')
    if (potion) potion.currentSpellLevel += 1
  } else if (item.type === 'key' || item.type === 'weapon') {
    ENEMY_WIZARD.inventory = [...(ENEMY_WIZARD.inventory || []), item]
  }
}

function performItemActions(terrainLayer, itemLayer, flying) {
  let workingTerrain = terrainLayer
  let workingItems = itemLayer

  if (!ENEMY_WIZARD.use_options) return { terrainLayer, itemLayer }

  const setDoor = (door, state) => {
    workingTerrain = workingTerrain.map((row) => [...row])
    workingTerrain[door.y][door.x] = state
  }

  while (ENEMY_WIZARD.ap >= ITEM_ACTION_AP_COST) {
    const { x, y } = ENEMY_WIZARD
    const itemsHere = workingItems[y][x] || []
    const index = itemsHere.findIndex(isWantedItem)

    if (index !== -1) {
      const remaining = [...itemsHere]
      const [item] = remaining.splice(index, 1)
      workingItems = workingItems.map((row) => [...row])
      workingItems[y][x] = remaining.length > 0 ? remaining : null
      collect(item)
    } else if (
      !flying &&
      hasKey(ENEMY_WIZARD.inventory) &&
      findAdjacentDoorInState(workingTerrain, x, y, 'doorLocked')
    ) {
      setDoor(
        findAdjacentDoorInState(workingTerrain, x, y, 'doorLocked'),
        'doorUnlocked',
      )
      ENEMY_WIZARD.inventory = removeFirstKey(ENEMY_WIZARD.inventory)
    } else if (
      !flying &&
      findAdjacentDoorInState(workingTerrain, x, y, 'doorUnlocked')
    ) {
      setDoor(
        findAdjacentDoorInState(workingTerrain, x, y, 'doorUnlocked'),
        'doorOpen',
      )
    } else {
      break
    }

    ENEMY_WIZARD.ap -= ITEM_ACTION_AP_COST
  }

  return { terrainLayer: workingTerrain, itemLayer: workingItems }
}

function countKeys(inventory) {
  return (inventory || []).filter((i) => i.type === 'key').length
}

function findKeyAndDoorPath(
  pathArgs,
  terrainLayer,
  itemLayer,
  within = Infinity,
) {
  const doorStates = hasKey(ENEMY_WIZARD.inventory)
    ? ['doorLocked', 'doorUnlocked']
    : ['doorUnlocked']
  const doorGoals = findTerrainTiles(terrainLayer, doorStates)
    .filter(
      (door) =>
        wrappedChebyshevDistance(
          ENEMY_WIZARD.x,
          ENEMY_WIZARD.y,
          door.x,
          door.y,
          MAP_WIDTH,
          MAP_HEIGHT,
        ) <= within,
    )
    .flatMap((door) => getAdjacentTiles(door.x, door.y))

  if (doorGoals.length > 0) {
    const path = findPathToNearestGoal({ ...pathArgs, goals: doorGoals })
    if (path.length > 0) return path
  }

  const keyGoals = findLootGoals(itemLayer).filter((g) =>
    (itemLayer[g.y][g.x] || []).some((i) => i.type === 'key'),
  )
  if (keyGoals.length === 0) return []

  return findPathToNearestGoal({ ...pathArgs, goals: keyGoals })
}

function chooseTravel({
  terrainLayer,
  objectLayer,
  effectLayer,
  itemLayer,
  portalPosition,
  holding,
}) {
  const cell = objectLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
  const stats = getMoverStats(cell, ENEMY_WIZARD)
  const flying = stats.isFlyingNow

  const alreadyAtPortal =
    !flying &&
    portalPosition &&
    ENEMY_WIZARD.x === portalPosition.x &&
    ENEMY_WIZARD.y === portalPosition.y

  const pathArgs = {
    terrainLayer,
    objectLayer,
    effectLayer,
    start: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
    entity: stats,
    maxExplored: SEARCH_LIMIT,
  }

  const attempt = (goals, extra = {}) => {
    const path = findPathToNearestGoal({ ...pathArgs, goals, ...extra })
    if (path.length > 0) return { path }

    if (!isMounted(cell) && canRide(ENEMY_WIZARD)) {
      for (const m of findAdjacentOwnMounts(objectLayer)) {
        const mountStats = { ...m.cell.stats, isFlyingNow: false }
        const viaMount = findPathToNearestGoal({
          ...pathArgs,
          entity: mountStats,
          goals,
          ...extra,
        })
        if (viaMount.length > 0) return { path: [], rideMount: m.pos }
      }
    }

    return { path: [] }
  }

  if (portalPosition && !alreadyAtPortal && flying) {
    const landings = getAdjacentTiles(
      portalPosition.x,
      portalPosition.y,
    ).filter(
      (t) =>
        !objectLayer[t.y][t.x] &&
        canLandOn(terrainLayer[t.y][t.x], stats, itemLayer?.[t.y]?.[t.x]),
    )

    if (landings.length > 0) {
      const toLanding = attempt(landings)
      if (toLanding.path.length > 0) return toLanding
    }

    const walkIns = findWalkInLandings(
      terrainLayer,
      objectLayer,
      itemLayer,
      { ...stats, isFlyingNow: false },
      portalPosition,
      countKeys(ENEMY_WIZARD.inventory),
    )
    if (walkIns.length > 0) {
      const toWalkIn = attempt(walkIns)
      if (toWalkIn.path.length > 0) return toWalkIn
    }
  } else if (portalPosition && !alreadyAtPortal) {
    const toPortal = attempt([portalPosition])
    if (toPortal.path.length > 0 || toPortal.rideMount) return toPortal

    if (!flying) {
      const viaDoors = findKeyAndDoorPath(pathArgs, terrainLayer, itemLayer)
      if (viaDoors.length > 0) return { path: viaDoors }
    }
  }

  if (holding || alreadyAtPortal) return { path: [] }

  const { target, dist } = findNearestPlayerTarget(
    objectLayer,
    ENEMY_WIZARD.x,
    ENEMY_WIZARD.y,
  )
  if (dist <= SIGHT_RANGE) {
    const toPlayer = attempt(getAdjacentTiles(target.x, target.y))
    if (toPlayer.path.length > 0 || toPlayer.rideMount) return toPlayer
  }

  const lootGoals = findLootGoals(
    itemLayer,
    flying ? { terrainLayer, stats } : null,
  )
  if (lootGoals.length > 0) {
    const toLoot = attempt(lootGoals, { forbidLava: true })
    if (toLoot.path.length > 0 || toLoot.rideMount) return toLoot
  }

  if (!flying) {
    const viaDoors = findKeyAndDoorPath(
      pathArgs,
      terrainLayer,
      itemLayer,
      LOOT_SEARCH_RANGE,
    )
    if (viaDoors.length > 0) return { path: viaDoors }
  }

  if (target && dist > SIGHT_RANGE) {
    const advance = attempt(getAdjacentTiles(target.x, target.y))
    if (advance.path.length > 0 || advance.rideMount) return advance
  }

  return { path: [] }
}

function holdingThreat(objectLayer) {
  const { total, units } = scanThreat(
    objectLayer,
    ENEMY_WIZARD.x,
    ENEMY_WIZARD.y,
  )
  if (!isCurrentlyFlying(objectLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]))
    return total

  return units.reduce((sum, u) => {
    const cell = objectLayer[u.y][u.x]
    const airborne = !!(cell?.flying || cell?.mount?.flying)
    return airborne ? sum + u.combat : sum
  }, 0)
}

export function moveEnemyWizard(
  terrainLayer,
  objectLayer,
  portalPosition,
  effectLayer,
  itemLayer,
) {
  const { dist } = findNearestPlayerTarget(
    objectLayer,
    ENEMY_WIZARD.x,
    ENEMY_WIZARD.y,
  )
  const seekingPlayer = dist <= SIGHT_RANGE

  let currentLayer = objectLayer
  let workingTerrain = terrainLayer
  let workingItems = itemLayer
  let moved = false
  let lastPosition = null
  let selfDefeated = false
  const frames = []

  const runItemActions = () => {
    let wizardCell = currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]

    if (isCurrentlyFlying(wizardCell)) {
      const here = workingItems[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
      const worthLanding =
        !!wizardCell.mount &&
        wizardCell.mount.ap >= FLY_TOGGLE_AP_COST &&
        ENEMY_WIZARD.ap >= ITEM_ACTION_AP_COST &&
        !!here?.some(isWantedItem) &&
        canLandOn(
          workingTerrain[ENEMY_WIZARD.y][ENEMY_WIZARD.x],
          wizardCell.mount.stats,
          here,
        )

      if (!worthLanding) return

      currentLayer = currentLayer.map((row) => [...row])
      currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = withMoverAp(
        withFlying(wizardCell, false),
        wizardCell.mount.ap - FLY_TOGGLE_AP_COST,
      )
      frames.push(currentLayer)
    }

    const flying = false
    const result = performItemActions(workingTerrain, workingItems, flying)
    workingTerrain = result.terrainLayer
    workingItems = result.itemLayer
  }

  const rideMountAt = (pos) => {
    currentLayer = mountRider(
      currentLayer,
      { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
      pos,
    )
    ENEMY_WIZARD.ap -= RIDE_AP_COST
    frames.push(currentLayer)
  }

  for (let leg = 0; leg < MAX_WIZARD_MOVE_LEGS; leg++) {
    runItemActions()

    if (
      !isMounted(currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]) &&
      canRide(ENEMY_WIZARD) &&
      ENEMY_WIZARD.ap >= RIDE_AP_COST
    ) {
      const flier = pickBestFlyingMount(currentLayer)
      if (flier) rideMountAt(flier.pos)
    }

    let wizardCell = currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
    const besidePortal =
      portalPosition &&
      wrappedChebyshevDistance(
        ENEMY_WIZARD.x,
        ENEMY_WIZARD.y,
        portalPosition.x,
        portalPosition.y,
        MAP_WIDTH,
        MAP_HEIGHT,
      ) === 1

    if (
      besidePortal &&
      isCurrentlyFlying(wizardCell) &&
      wizardCell.mount &&
      wizardCell.mount.ap >= FLY_TOGGLE_AP_COST + 1 &&
      canLandOn(
        workingTerrain[ENEMY_WIZARD.y][ENEMY_WIZARD.x],
        wizardCell.mount.stats,
        workingItems[ENEMY_WIZARD.y][ENEMY_WIZARD.x],
      )
    ) {
      currentLayer = currentLayer.map((row) => [...row])
      currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = withMoverAp(
        withFlying(wizardCell, false),
        wizardCell.mount.ap - FLY_TOGGLE_AP_COST,
      )
      frames.push(currentLayer)
      wizardCell = currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
    }

    const groundStats = wizardCell.mount
      ? { ...wizardCell.mount.stats, isFlyingNow: false }
      : null
    let inWalkRegion = false
    const portalHasLanding =
      portalPosition &&
      groundStats &&
      getAdjacentTiles(portalPosition.x, portalPosition.y).some((t) =>
        canLandOn(workingTerrain[t.y][t.x], wizardCell.mount.stats, null),
      )
    if (portalPosition && groundStats && !besidePortal && !portalHasLanding) {
      inWalkRegion = isOnWalkInGround(
        workingTerrain,
        workingItems,
        groundStats,
        { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
        portalPosition,
        countKeys(ENEMY_WIZARD.inventory),
      )
    }
    if (
      inWalkRegion &&
      isCurrentlyFlying(wizardCell) &&
      wizardCell.mount.ap >= FLY_TOGGLE_AP_COST + 1 &&
      canLandOn(
        workingTerrain[ENEMY_WIZARD.y][ENEMY_WIZARD.x],
        wizardCell.mount.stats,
        workingItems[ENEMY_WIZARD.y][ENEMY_WIZARD.x],
      )
    ) {
      currentLayer = currentLayer.map((row) => [...row])
      currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = withMoverAp(
        withFlying(wizardCell, false),
        wizardCell.mount.ap - FLY_TOGGLE_AP_COST,
      )
      frames.push(currentLayer)
      wizardCell = currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
    }

    if (
      !besidePortal &&
      !inWalkRegion &&
      isMounted(wizardCell) &&
      canFly(wizardCell.mount.stats) &&
      !wizardCell.mount.flying &&
      wizardCell.mount.ap >= FLY_TOGGLE_AP_COST &&
      canTakeOffFrom(workingTerrain[ENEMY_WIZARD.y][ENEMY_WIZARD.x])
    ) {
      currentLayer = currentLayer.map((row) => [...row])
      currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = withMoverAp(
        withFlying(wizardCell, true),
        wizardCell.mount.ap - FLY_TOGGLE_AP_COST,
      )
      frames.push(currentLayer)
    }

    wizardCell = currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
    const mounted = isMounted(wizardCell)
    const moverStats = getMoverStats(wizardCell, ENEMY_WIZARD)

    const liftOffStep = findLiftOffStep(
      workingTerrain,
      currentLayer,
      effectLayer,
      workingItems,
      wizardCell,
    )

    const plan = liftOffStep
      ? { path: [liftOffStep] }
      : chooseTravel({
          terrainLayer: workingTerrain,
          objectLayer: currentLayer,
          effectLayer,
          itemLayer: workingItems,
          portalPosition,
          holding: getThreatTier(holdingThreat(currentLayer)) !== 'calm',
        })

    if (plan.rideMount) {
      if (ENEMY_WIZARD.ap < RIDE_AP_COST) break
      rideMountAt(plan.rideMount)
      continue
    }

    if (plan.path.length === 0) break

    const walkResult = walkPath({
      path: plan.path,
      ap: getMoverAp(wizardCell, ENEMY_WIZARD.ap),
      terrainLayer: workingTerrain,
      objectLayer: currentLayer,
      onStep: {
        entity: () => moverStats,
        move: (layer, step, remainingAp) => {
          const newLayer = layer.map((row) => [...row])
          const moving = newLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
          newLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = null
          ENEMY_WIZARD.x = step.x
          ENEMY_WIZARD.y = step.y
          const wizard = {
            type: 'enemyWizard',
            name: 'Enemy Wizard',
            owner: 'enemy',
            ref: ENEMY_WIZARD,
          }
          newLayer[step.y][step.x] = moving?.mount
            ? { ...wizard, mount: { ...moving.mount, ap: remainingAp } }
            : wizard
          return newLayer
        },
      },
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
    const { target: freshTarget } = findNearestPlayerTarget(
      currentLayer,
      ENEMY_WIZARD.x,
      ENEMY_WIZARD.y,
    )
    const adjacency = chebyshevDist(
      ENEMY_WIZARD.x,
      ENEMY_WIZARD.y,
      freshTarget.x,
      freshTarget.y,
    )
    const wizardCell = currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
    const attackAp = getMoverAp(wizardCell, ENEMY_WIZARD.ap)

    if (adjacency <= 1 && attackAp >= ATTACK_AP_COST) {
      const result = resolveAttack({
        objectLayer: currentLayer,
        terrainLayer: workingTerrain,
        attackerPos: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
        defenderPos: { x: freshTarget.x, y: freshTarget.y },
      })

      if (!result.blocked) {
        currentLayer = result.objectLayer

        if (isMounted(wizardCell)) {
          currentLayer = currentLayer.map((row) => [...row])
          currentLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = withMoverAp(
            wizardCell,
            attackAp - ATTACK_AP_COST,
          )
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
    frames,
  }
}
