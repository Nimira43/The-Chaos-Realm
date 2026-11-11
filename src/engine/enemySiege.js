import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { PLAYER } from '../data/player.js'
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  IMPASSABLE_THRESHOLD,
  terrainCost,
} from './terrain.js'
import { wrap, wrappedChebyshevDistance } from './utils.js'
import {
  canFly,
  isMounted,
  isCurrentlyFlying,
  getMoverStats,
  getMoverAp,
  withMoverAp,
} from './mounts.js'
import { hasBreachSpell } from './enemyBreach.js'
import { getMovementCost } from './terrain.js'
import { findPathToNearestGoal } from './pathfinding.js'

export const SIEGE = {
  START_TURN: 5,
  TRIGGER_TURNS: 2,
  COMMIT_TURN: 18,
  STAGE_TILES: 12,
  WAIT_CLEARANCE: 4,
  STUCK_TURNS: 2,
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

let sealedTurns = 0
let blockedTurns = 0
let triggered = false
let ewLast = null
let stationary = 0
let waitSpot = null

export function resetSiege() {
  sealedTurns = 0
  blockedTurns = 0
  triggered = false
  ewLast = null
  stationary = 0
  waitSpot = null
}

const NO_SIEGE = {
  active: false,
  mode: null,
  goal: null,
  commit: false,
  stage: null,
  assist: null,
  breach: false,
}

function isOpen(terrainLayer, x, y) {
  return (terrainCost[terrainLayer[y][x]] ?? 999) < IMPASSABLE_THRESHOLD
}

function floodFrom(terrainLayer, start) {
  const seen = new Set([`${start.x},${start.y}`])
  const queue = [start]
  while (queue.length > 0) {
    const cur = queue.shift()
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = wrap(cur.x + dx, MAP_WIDTH)
      const ny = wrap(cur.y + dy, MAP_HEIGHT)
      const key = `${nx},${ny}`
      if (seen.has(key) || !isOpen(terrainLayer, nx, ny)) continue
      if (
        dx !== 0 &&
        dy !== 0 &&
        (!isOpen(terrainLayer, nx, cur.y) || !isOpen(terrainLayer, cur.x, ny))
      )
        continue
      seen.add(key)
      queue.push({ x: nx, y: ny })
    }
  }
  return seen
}

function findPlayerWizard(objectLayer) {
  const at = objectLayer[PLAYER.y]?.[PLAYER.x]
  if (at?.type === 'player') return { x: PLAYER.x, y: PLAYER.y }
  for (let y = 0; y < objectLayer.length; y++)
    for (let x = 0; x < objectLayer[y].length; x++)
      if (objectLayer[y][x]?.type === 'player') return { x, y }
  return null
}

function isPlayerSide(cell) {
  return cell && (cell.type === 'player' || cell.owner === 'player')
}

const dist = (a, b) =>
  wrappedChebyshevDistance(a.x, a.y, b.x, b.y, MAP_WIDTH, MAP_HEIGHT)

function tileBeside(terrainLayer, objectLayer, target, region = null) {
  const from = { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y }
  let best = null
  for (const [dx, dy] of NEIGHBOURS) {
    const x = wrap(target.x + dx, MAP_WIDTH)
    const y = wrap(target.y + dy, MAP_HEIGHT)
    if (objectLayer[y][x] || !isOpen(terrainLayer, x, y)) continue
    if (terrainLayer[y][x].startsWith('door')) continue
    if (region && !region.has(`${x},${y}`)) continue
    const d = dist(from, { x, y })
    if (!best || d < best.d) best = { x, y, d }
  }
  return best ? { x: best.x, y: best.y } : null
}

function nearestInside(terrainLayer, objectLayer, from, region) {
  let best = null
  for (const key of region) {
    const [x, y] = key.split(',').map(Number)
    if (terrainLayer[y][x].startsWith('door')) continue
    const taken = objectLayer[y][x] ? 1 : 0
    const d = dist(from, { x, y })
    if (!best || taken < best.taken || (taken === best.taken && d < best.d))
      best = { x, y, d, taken }
  }
  return best ? { x: best.x, y: best.y } : null
}

function stagingTiles(terrainLayer, objectLayer, goal) {
  const mine = floodFrom(terrainLayer, {
    x: ENEMY_WIZARD.x,
    y: ENEMY_WIZARD.y,
  })
  const tiles = []
  for (const key of mine) {
    const [x, y] = key.split(',').map(Number)
    if (terrainLayer[y][x].startsWith('door')) continue
    const here = objectLayer[y][x]

    if (here && !(here.type === 'creature' && here.owner === 'enemy')) continue
    tiles.push({ x, y, d: dist({ x, y }, goal) })
  }
  tiles.sort((a, b) => a.d - b.d)
  return new Set(tiles.slice(0, SIEGE.STAGE_TILES).map((t) => `${t.x},${t.y}`))
}

function playerUnits(objectLayer) {
  const out = []
  for (let y = 0; y < objectLayer.length; y++)
    for (let x = 0; x < objectLayer[y].length; x++)
      if (isPlayerSide(objectLayer[y][x])) out.push({ x, y })
  return out
}

function pickWaitSpot(terrainLayer, objectLayer, portalTile) {
  const me = { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y }
  const units = playerUnits(objectLayer)
  const clear = (t) => units.every((u) => dist(u, t) >= SIEGE.WAIT_CLEARANCE)
  const usable = (x, y) => {
    const here = objectLayer[y][x]
    if (here && !(x === me.x && y === me.y)) return false
    const t = terrainLayer[y][x]
    return (
      isOpen(terrainLayer, x, y) && !t.startsWith('door') && t !== 'portal'
    )
  }

  if (waitSpot && usable(waitSpot.x, waitSpot.y) && clear(waitSpot))
    return waitSpot

  const region = floodFrom(terrainLayer, me)
  let best = null
  for (const key of region) {
    const [x, y] = key.split(',').map(Number)
    if (!usable(x, y)) continue
    const tile = { x, y }
    if (!clear(tile)) continue
    const dp = dist(tile, portalTile)
    if (dp < 2) continue
    const de = dist(tile, me)
    if (!best || dp < best.dp || (dp === best.dp && de < best.de))
      best = { x, y, dp, de }
  }
  waitSpot = best ? { x: best.x, y: best.y } : null
  return waitSpot
}

const isSwappable = (cell) =>
  cell?.type === 'creature' &&
  cell.owner === 'enemy' &&
  !isCurrentlyFlying(cell)

export function assistWizard({ terrainLayer, objectLayer, assist }) {
  if (!assist || assist.goals.length === 0) return null
  if (stationary < SIEGE.STUCK_TURNS) return null
  if (`${ENEMY_WIZARD.x},${ENEMY_WIZARD.y}` !== ewLast) return null

  const start = { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y }
  const cell = objectLayer[start.y][start.x]
  if (!cell || cell.type !== 'enemyWizard' || isCurrentlyFlying(cell))
    return null
  if (assist.goals.some((g) => g.x === start.x && g.y === start.y)) return null

  const pathLayer = objectLayer.map((row) =>
    row.map((c) => (isSwappable(c) ? null : c)),
  )
  const goals = assist.goals.filter((g) => !pathLayer[g.y][g.x])
  if (goals.length === 0) return null

  const path = findPathToNearestGoal({
    terrainLayer,
    objectLayer: pathLayer,
    effectLayer: Array.from({ length: MAP_HEIGHT }, () =>
      Array(MAP_WIDTH).fill(null),
    ),
    start,
    entity: { ...getMoverStats(cell, ENEMY_WIZARD), isFlyingNow: false },
    goals,
    forbidLava: true,
    maxExplored: 3500,
  })
  if (path.length === 0) return null

  let layer = objectLayer.map((row) => [...row])
  let me = layer[start.y][start.x]
  let ap = getMoverAp(me, ENEMY_WIZARD.ap)
  const frames = []
  let moved = false
  let pos = start
  for (const step of path) {
    const occupant = layer[step.y][step.x]
    if (occupant && !isSwappable(occupant)) break
    const cost = getMovementCost(terrainLayer[step.y][step.x], {
      ...getMoverStats(me, ENEMY_WIZARD),
      isFlyingNow: false,
    })
    if (cost > ap) break
    ap -= cost
    layer = layer.map((row) => [...row])
    layer[pos.y][pos.x] = occupant ? { ...occupant, x: pos.x, y: pos.y } : null
    me = withMoverAp(me, ap)
    layer[step.y][step.x] = me
    pos = { x: step.x, y: step.y }
    ENEMY_WIZARD.x = pos.x
    ENEMY_WIZARD.y = pos.y
    moved = true
    frames.push(layer)
  }
  if (!moved) return null
  if (!isMounted(me)) ENEMY_WIZARD.ap = ap
  console.info(
    `[siege] assist: walked him ${start.x},${start.y} -> ${pos.x},${pos.y}`,
  )
  return { objectLayer: layer, frames, position: pos }
}

export function updateSiege(args) {
  const r = decideSiege(args)
  const wz = args.objectLayer[ENEMY_WIZARD.y]?.[ENEMY_WIZARD.x]
  const pt = args.portalTile
  const occ = pt ? args.objectLayer[pt.y]?.[pt.x] : null
  console.info(
    `[siege] turn ${args.round}: mode=${r.mode ?? 'off'} goal=${
      r.goal ? `${r.goal.x},${r.goal.y}` : '-'
    } commit=${r.commit} sealed=${sealedTurns} blocked=${blockedTurns} triggered=${triggered} wizard=${ENEMY_WIZARD.x},${ENEMY_WIZARD.y} on=${
      args.terrainLayer[ENEMY_WIZARD.y]?.[ENEMY_WIZARD.x]
    } mount=${wz?.mount ? `${wz.mount.stats?.name}${wz.mount.flying ? '(flying)' : ''}` : 'none'} portal=${
      pt ? `${pt.x},${pt.y}` : '-'
    } holder=${occ ? `${occ.owner}:${occ.name ?? occ.type}` : 'free'} still=${stationary} assist=${r.assist ? 'yes' : 'no'} breach=${r.breach ? 'yes' : 'no'}`,
  )
  return r
}

function decideSiege({
  terrainLayer,
  objectLayer,
  portalTile,
  portalOpen = false,
  round,
}) {
  if (round <= 2) resetSiege()
  const ewNow = `${ENEMY_WIZARD.x},${ENEMY_WIZARD.y}`
  stationary = ewNow === ewLast ? stationary + 1 : 0
  ewLast = ewNow
  if (ENEMY_WIZARD.current_health <= 0) return NO_SIEGE

  const wizard = findPlayerWizard(objectLayer)
  if (!wizard) return NO_SIEGE

  const region = floodFrom(terrainLayer, wizard)
  let sealed = !region.has(`${ENEMY_WIZARD.x},${ENEMY_WIZARD.y}`)
  if (sealed) {
    outer: for (let y = 0; y < objectLayer.length; y++)
      for (let x = 0; x < objectLayer[y].length; x++) {
        const cell = objectLayer[y][x]

        if (
          cell?.type === 'creature' &&
          cell.owner === 'enemy' &&
          !canFly(cell.stats)
        ) {
          if (region.has(`${x},${y}`)) {
            sealed = false
            break outer
          }
        }
      }
  }

  const holder =
    portalTile && isPlayerSide(objectLayer[portalTile.y][portalTile.x])
      ? portalTile
      : null

  sealedTurns = sealed ? sealedTurns + 1 : 0
  blockedTurns = holder ? blockedTurns + 1 : 0
  if (
    round >= SIEGE.START_TURN &&
    (sealedTurns >= SIEGE.TRIGGER_TURNS || blockedTurns >= SIEGE.TRIGGER_TURNS)
  )
    triggered = true

  const commit = triggered && round >= SIEGE.COMMIT_TURN && !!holder
  const breach = hasBreachSpell()

  if (sealedTurns >= SIEGE.TRIGGER_TURNS && round >= SIEGE.START_TURN) {
    const goal =
      tileBeside(terrainLayer, objectLayer, wizard, region) ??
      nearestInside(terrainLayer, objectLayer, wizard, region)
    if (goal)
      return {
        active: true,
        mode: 'sealed',
        goal,
        commit,
        stage: stagingTiles(terrainLayer, objectLayer, goal),
        assist: { goals: [goal] },
        breach,
      }
  }

  if (commit) {
    const beside = dist({ x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y }, holder) <= 1
    const goal = beside
      ? { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y }
      : (tileBeside(terrainLayer, objectLayer, holder) ??
        nearestInside(terrainLayer, objectLayer, holder, region))
    if (goal)
      return {
        active: true,
        mode: 'commit',
        goal,
        commit,
        stage: stagingTiles(terrainLayer, objectLayer, wizard),
        assist: { goals: [goal] },
        breach,
      }
  }

  if (triggered) {
    const stage = stagingTiles(terrainLayer, objectLayer, wizard)
    if (holder) {
      if (breach)
        return {
          active: true,
          mode: 'breach',
          goal: null,
          commit,
          stage,
          assist: null,
          breach: true,
        }
      const spot = pickWaitSpot(terrainLayer, objectLayer, holder)
      if (spot)
        return {
          active: true,
          mode: 'wait',
          goal: spot,
          commit,
          stage,
          assist: { goals: [spot] },
          breach: false,
        }
    }

    const free = portalOpen && portalTile && !holder
    return {
      active: true,
      mode: 'standoff',
      goal: null,
      commit,
      stage,
      assist: free ? { goals: [portalTile] } : null,
      breach: false,
    }
  }
  return NO_SIEGE
}
