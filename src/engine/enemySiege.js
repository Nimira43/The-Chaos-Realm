import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { PLAYER } from '../data/player.js'
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  IMPASSABLE_THRESHOLD,
  terrainCost,
} from './terrain.js'
import { wrap, wrappedChebyshevDistance } from './utils.js'
import { canFly } from './mounts.js'

export const SIEGE = {
  START_TURN: 5,
  TRIGGER_TURNS: 2,
  COMMIT_TURN: 18,
  STAGE_TILES: 12,
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

export function resetSiege() {
  sealedTurns = 0
  blockedTurns = 0
  triggered = false
}

const NO_SIEGE = {
  active: false,
  mode: null,
  goal: null,
  commit: false,
  stage: null,
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
    if (objectLayer[y][x]) continue
    tiles.push({ x, y, d: dist({ x, y }, goal) })
  }
  tiles.sort((a, b) => a.d - b.d)
  return new Set(
    tiles.slice(0, SIEGE.STAGE_TILES).map((t) => `${t.x},${t.y}`),
  )
}

export function updateSiege({ terrainLayer, objectLayer, portalTile, round }) {
  if (round <= 2) resetSiege()
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

  const commit = triggered && round >= SIEGE.COMMIT_TURN

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
      }
  }

  if (commit) {
    const target = holder || wizard
    const goal =
      tileBeside(terrainLayer, objectLayer, target) ??
      nearestInside(terrainLayer, objectLayer, target, region)
    if (goal)
      return {
        active: true,
        mode: 'commit',
        goal,
        commit,
        stage: stagingTiles(terrainLayer, objectLayer, wizard),
      }
  }

  if (triggered)
    return {
      active: true,
      mode: 'standoff',
      goal: null,
      commit,
      stage: stagingTiles(terrainLayer, objectLayer, wizard),
    }
  return NO_SIEGE
}
