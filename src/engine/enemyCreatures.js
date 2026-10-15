import { ENEMY_SPELLBOOK } from '../data/enemySpellbook.js'
import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap, wrappedChebyshevDistance } from './utils.js'
import { resolveAttack, getAttackBlockReason, ATTACK_AP_COST } from './combat.js'
import { findPathToNearestGoal, getAdjacentTiles } from './pathfinding.js'
import { canCarryItem, hasKey, removeFirstKey, isConsumedOnPickup } from './items.js'
import { ITEM_ACTION_AP_COST } from './useItemActions.js'
import { canLandOn, canTakeOffFrom } from './useMountActions.js'
import {
  canFly,
  isCurrentlyFlying,
  getMoverStats,
  getMoverAp,
  withMoverAp,
  withFlying,
  RIDE_AP_COST,
  FLY_TOGGLE_AP_COST
} from './mounts.js'
import {
  SIGHT_RANGE,
  chebyshevDist,
  listPlayerTargets,
  pickWanderTarget,
  walkPath,
  tryRideAdjacentMount
} from './enemyAIShared.js'

export const CREATURE_LOOT_RANGE = 15

const SEARCH_LIMIT = 3500
const MAX_LEGS = 3

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

function findDoors(terrainLayer, states) {
  const doors = []
  for (let y = 0; y < terrainLayer.length; y++) {
    for (let x = 0; x < terrainLayer[y].length; x++) {
      if (states.includes(terrainLayer[y][x])) doors.push({ x, y })
    }
  }
  return doors
}

function isWantedItem(cell, item) {
  if (isConsumedOnPickup(item)) return true
  return canCarryItem(cell.stats.carry_limit, cell.inventory, item)
}

function findLootGoals(itemLayer, cell, x, y, landable) {
  const goals = []

  for (let gy = 0; gy < itemLayer.length; gy++) {
    for (let gx = 0; gx < itemLayer[gy].length; gx++) {
      const items = itemLayer[gy][gx]
      if (!items || !items.some(item => isWantedItem(cell, item))) continue
      if (gx === x && gy === y) continue
      if (wrappedChebyshevDistance(x, y, gx, gy, MAP_WIDTH, MAP_HEIGHT) > CREATURE_LOOT_RANGE) continue
      if (landable && !canLandOn(landable.terrainLayer[gy][gx], landable.stats, items)) continue
      goals.push({ x: gx, y: gy })
    }
  }

  return goals
}

function runCreatureTurn(state, startX, startY, portalPosition) {
  let { terrainLayer, objectLayer, itemLayer, effectLayer } = state
  const frames = []
  let defeatedTarget = null

  let x = startX
  let y = startY

  const cellNow = () => objectLayer[y][x]
  const apNow = () => getMoverAp(cellNow(), cellNow().ap)
  const setCell = (cell) => {
    objectLayer = objectLayer.map(row => [...row])
    objectLayer[y][x] = cell
  }
  const setMoverAp = (ap) => setCell(withMoverAp(cellNow(), ap))

  const result = (extra = {}) => ({
    terrainLayer, objectLayer, itemLayer, frames, defeatedTarget,
    moved: x !== startX || y !== startY,
    selfDefeated: false,
    finalPosition: { x, y },
    ...extra
  })

  if (!cellNow()) return result({ finalPosition: null })

  {
    const creature = cellNow()
    const ridden = tryRideAdjacentMount(objectLayer, terrainLayer, x, y, creature.owner, creature.stats, creature.ap)
    if (ridden) {
      objectLayer = ridden.map(row => [...row])
      objectLayer[y][x] = { ...objectLayer[y][x], ap: creature.ap - RIDE_AP_COST }
      frames.push(objectLayer)
    }
  }

  const useOptions = !!cellNow().stats.use_options
  const onPortal = (px, py) => portalPosition && px === portalPosition.x && py === portalPosition.y

  const landIfUseful = () => {
    const cell = cellNow()
    if (!useOptions || !isCurrentlyFlying(cell)) return
    if (apNow() < FLY_TOGGLE_AP_COST) return
    if (!canLandOn(terrainLayer[y][x], getMoverStats(cell, cell.stats), itemLayer[y][x])) return

    const here = itemLayer[y][x] || []
    const lootHere = here.some(item => isWantedItem(cell, item))
    const doorNear = findAdjacentDoorInState(terrainLayer, x, y, 'doorUnlocked') ||
      (hasKey(cell.inventory) && findAdjacentDoorInState(terrainLayer, x, y, 'doorLocked'))
    if (!lootHere && !doorNear) return
    if (apNow() < FLY_TOGGLE_AP_COST + ITEM_ACTION_AP_COST) return

    setCell(withMoverAp(withFlying(cell, false), apNow() - FLY_TOGGLE_AP_COST))
    frames.push(objectLayer)
  }

  const doActions = () => {
    if (!useOptions) return
    landIfUseful()

    while (cellNow() && !isCurrentlyFlying(cellNow()) && apNow() >= ITEM_ACTION_AP_COST) {
      const cell = cellNow()
      const itemsHere = itemLayer[y][x] || []
      const index = itemsHere.findIndex(item => isWantedItem(cell, item))

      if (index !== -1) {
        const remaining = [...itemsHere]
        const [item] = remaining.splice(index, 1)
        itemLayer = itemLayer.map(row => [...row])
        itemLayer[y][x] = remaining.length > 0 ? remaining : null

        if (item.type === 'apple') {
          const potion = ENEMY_SPELLBOOK.find(s => s.name === 'Healing Potion')
          if (potion) potion.currentSpellLevel += 1
        } else if (item.type === 'key' || item.type === 'weapon') {
          setCell({ ...cell, inventory: [...(cell.inventory || []), item] })
        }
      } else if (hasKey(cell.inventory) && findAdjacentDoorInState(terrainLayer, x, y, 'doorLocked')) {
        const door = findAdjacentDoorInState(terrainLayer, x, y, 'doorLocked')
        terrainLayer = terrainLayer.map(row => [...row])
        terrainLayer[door.y][door.x] = 'doorUnlocked'
        setCell({ ...cell, inventory: removeFirstKey(cell.inventory) })
      } else if (findAdjacentDoorInState(terrainLayer, x, y, 'doorUnlocked')) {
        const door = findAdjacentDoorInState(terrainLayer, x, y, 'doorUnlocked')
        terrainLayer = terrainLayer.map(row => [...row])
        terrainLayer[door.y][door.x] = 'doorOpen'
      } else {
        break
      }

      setMoverAp(apNow() - ITEM_ACTION_AP_COST)
      frames.push(objectLayer)
    }
  }

  const tryAttack = () => {
    if (!cellNow() || apNow() < ATTACK_AP_COST) return false

    const adjacent = listPlayerTargets(objectLayer, x, y)
      .filter(t => chebyshevDist(x, y, t.x, t.y) <= 1)
      .filter(t => !getAttackBlockReason({ objectLayer, terrainLayer, attackerPos: { x, y }, defenderPos: { x: t.x, y: t.y } }))

    adjacent.sort((a, b) =>
      (onPortal(b.x, b.y) - onPortal(a.x, a.y)) ||
      ((b.type === 'player') - (a.type === 'player')))

    const target = adjacent[0]
    if (!target) return false

    const ap = apNow()
    const attack = resolveAttack({
      objectLayer, terrainLayer,
      attackerPos: { x, y },
      defenderPos: { x: target.x, y: target.y }
    })
    if (attack.blocked) return false

    objectLayer = attack.objectLayer
    if (objectLayer[y][x]) setMoverAp(ap - ATTACK_AP_COST)
    frames.push(objectLayer)
    if (attack.defeated) defeatedTarget = attack.defenderType
    return true
  }

  const struckFirst = tryAttack()

  const planMove = () => {
    const cell = cellNow()
    if (!cell) return { path: [], reason: 'none' }

    const moverStats = getMoverStats(cell, cell.stats)
    const flying = moverStats.isFlyingNow
    const pathArgs = {
      terrainLayer, objectLayer, effectLayer,
      start: { x, y },
      entity: moverStats,
      maxExplored: SEARCH_LIMIT
    }

    const targets = listPlayerTargets(objectLayer, x, y)
    const hittable = targets.filter(t => !getAttackBlockReason({ objectLayer, terrainLayer, attackerPos: { x, y }, defenderPos: { x: t.x, y: t.y } }))

    if (portalPosition && onPortal(x, y)) {
      const off = getAdjacentTiles(x, y).filter(t => !onPortal(t.x, t.y))
      const path = findPathToNearestGoal({ ...pathArgs, goals: off })
      if (path.length > 0) return { path, reason: 'clear-portal' }
    }
    if (portalPosition) {
      const blocker = hittable.find(t => onPortal(t.x, t.y))
      if (blocker) {
        const path = findPathToNearestGoal({ ...pathArgs, goals: getAdjacentTiles(blocker.x, blocker.y).filter(t => !onPortal(t.x, t.y)) })
        if (path.length > 0) return { path, reason: 'fight' }
      }
    }

    const inSight = hittable.filter(t => t.dist <= SIGHT_RANGE)
    for (const t of inSight) {
      const path = findPathToNearestGoal({ ...pathArgs, goals: getAdjacentTiles(t.x, t.y) })
      if (path.length > 0) return { path, reason: 'fight', target: t }
    }

    if (useOptions) {
      const lootGoals = findLootGoals(itemLayer, cell, x, y, flying ? { terrainLayer, stats: moverStats } : null)
      if (lootGoals.length > 0) {
        const path = findPathToNearestGoal({ ...pathArgs, goals: lootGoals })
        if (path.length > 0) return { path, reason: 'loot' }
      }

      const doorStates = hasKey(cell.inventory) ? ['doorLocked', 'doorUnlocked'] : ['doorUnlocked']
      const doorGoals = findDoors(terrainLayer, doorStates)
        .filter(d => wrappedChebyshevDistance(x, y, d.x, d.y, MAP_WIDTH, MAP_HEIGHT) <= CREATURE_LOOT_RANGE)
        .flatMap(d => getAdjacentTiles(d.x, d.y))
        .filter(t => !flying || canLandOn(terrainLayer[t.y][t.x], moverStats, itemLayer[t.y][t.x]))
      const alreadyBeside = findAdjacentDoorInState(terrainLayer, x, y, 'doorUnlocked') ||
        (hasKey(cell.inventory) && findAdjacentDoorInState(terrainLayer, x, y, 'doorLocked'))
      if (doorGoals.length > 0 && !alreadyBeside) {
        const path = findPathToNearestGoal({ ...pathArgs, goals: doorGoals })
        if (path.length > 0) return { path, reason: 'door' }
      }
    }

    for (const t of hittable.filter(t => t.dist > SIGHT_RANGE)) {
      const path = findPathToNearestGoal({ ...pathArgs, goals: getAdjacentTiles(t.x, t.y) })
      if (path.length > 0) return { path, reason: 'advance' }
    }

    let wanderTarget = cell.wanderTarget ?? null
    if (!wanderTarget || (wanderTarget.x === x && wanderTarget.y === y)) {
      wanderTarget = pickWanderTarget(x, y, terrainLayer, objectLayer, moverStats)
    }
    if (wanderTarget) {
      const path = findPathToNearestGoal({ ...pathArgs, goals: [wanderTarget], forbidLava: true })
      if (path.length > 0) return { path, reason: 'wander', wanderTarget }
    }

    return { path: [], reason: 'none' }
  }

  const maybeTakeOff = (reason) => {
    const cell = cellNow()
    if (!cell || isCurrentlyFlying(cell)) return
    if (reason !== 'fight' && reason !== 'advance' && reason !== 'clear-portal') return
    const stats = getMoverStats(cell, cell.stats)
    if (!canFly(stats)) return
    if (apNow() < FLY_TOGGLE_AP_COST + 2) return
    if (!canTakeOffFrom(terrainLayer[y][x])) return

    setCell(withMoverAp(withFlying(cell, true), apNow() - FLY_TOGGLE_AP_COST))
    frames.push(objectLayer)
  }

  let plan = struckFirst ? { path: [], reason: 'none' } : planMove()

  let moved = false

  for (let leg = 0; leg < MAX_LEGS; leg++) {
    if (leg > 0) {
      if (!cellNow() || apNow() < 2) break
      plan = planMove()
      if (plan.reason === 'none' || plan.reason === 'wander') break
    }
    if (plan.reason !== 'none') maybeTakeOff(plan.reason)
    if (!struckFirst && cellNow() && isCurrentlyFlying(cellNow()) && plan.reason !== 'none') plan = planMove()

    let path = plan.path
    const portalStep = path.findIndex(step => onPortal(step.x, step.y))
    if (portalStep !== -1) path = path.slice(0, portalStep)

    let selfDefeated = false

    if (path.length > 0 && cellNow()) {
      const cell = cellNow()
      const moverStats = getMoverStats(cell, cell.stats)

      const walk = walkPath({
        path,
        ap: getMoverAp(cell, cell.ap),
        terrainLayer,
        objectLayer,
        onStep: {
          entity: () => moverStats,
          move: (layer, step, remainingAp) => {
            const newLayer = layer.map(row => [...row])
            const moving = newLayer[y][x]
            newLayer[y][x] = null
            x = step.x
            y = step.y
            newLayer[y][x] = { ...withMoverAp(moving, remainingAp), x, y }
            return newLayer
          }
        }
      })

      objectLayer = walk.objectLayer
      frames.push(...walk.frames)
      moved = moved || walk.moved
      selfDefeated = walk.selfDefeated
    }

    if (selfDefeated) return result({ moved, selfDefeated: true, finalPosition: null })

    if (cellNow() && plan.reason === 'wander') {
      setCell({ ...cellNow(), wanderTarget: plan.wanderTarget ?? null })
    } else if (cellNow() && cellNow().wanderTarget) {
      setCell({ ...cellNow(), wanderTarget: null })
    }

    doActions()
    if (!struckFirst) tryAttack()
  }

  return result({ moved })
}

export function runEnemyCreaturesAI(terrainLayer, objectLayer, effectLayer, itemLayer = null, portalPosition = null) {
  let state = {
    terrainLayer,
    objectLayer,
    effectLayer,
    itemLayer: itemLayer ?? objectLayer.map(row => row.map(() => null))
  }
  const defeatedTargets = []
  const frames = []

  const startingPositions = []
  for (let y = 0; y < objectLayer.length; y++) {
    for (let x = 0; x < objectLayer[y].length; x++) {
      const cell = objectLayer[y][x]
      if (cell && cell.type === 'creature' && cell.owner === 'enemy') startingPositions.push({ x, y })
    }
  }

  startingPositions.sort((a, b) =>
    (objectLayer[b.y][b.x].stats?.combat ?? 0) - (objectLayer[a.y][a.x].stats?.combat ?? 0))

  const finishedAt = new Set()

  startingPositions.forEach(({ x, y }) => {
    if (finishedAt.has(`${x},${y}`)) return
    const cell = state.objectLayer[y][x]
    if (!cell || cell.type !== 'creature' || cell.owner !== 'enemy') return

    const turn = runCreatureTurn(state, x, y, portalPosition)
    state = { ...state, terrainLayer: turn.terrainLayer, objectLayer: turn.objectLayer, itemLayer: turn.itemLayer }
    frames.push(...turn.frames)
    if (turn.defeatedTarget) defeatedTargets.push(turn.defeatedTarget)
    if (turn.finalPosition) finishedAt.add(`${turn.finalPosition.x},${turn.finalPosition.y}`)
  })

  return {
    objectLayer: state.objectLayer,
    terrainLayer: state.terrainLayer,
    itemLayer: state.itemLayer,
    defeatedTargets,
    frames
  }
}