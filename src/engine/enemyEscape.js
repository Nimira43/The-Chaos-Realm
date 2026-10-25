import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  IMPASSABLE_THRESHOLD,
  getMovementCost,
} from './terrain.js'
import { wrap } from './utils.js'
import { hasKey } from './items.js'
import { getMoverStats } from './mounts.js'

export const ESCAPE_REGION_SIZE = 100

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

function floodRegion(terrainLayer, stats, lockedPassable, limit) {
  const start = `${ENEMY_WIZARD.x},${ENEMY_WIZARD.y}`
  const seen = new Set([start])
  const queue = [{ x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y }]

  while (queue.length > 0 && seen.size < limit) {
    const { x, y } = queue.shift()

    for (const [dx, dy] of NEIGHBOURS) {
      const nx = wrap(x + dx, MAP_WIDTH)
      const ny = wrap(y + dy, MAP_HEIGHT)
      const key = `${nx},${ny}`
      if (seen.has(key)) continue

      const terrain = terrainLayer[ny][nx]
      let passable
      if (terrain === 'doorUnlocked' || terrain === 'doorOpen') passable = true
      else if (terrain === 'doorLocked') passable = lockedPassable
      else passable = getMovementCost(terrain, stats) < IMPASSABLE_THRESHOLD

      if (!passable) continue
      seen.add(key)
      queue.push({ x: nx, y: ny })
    }
  }

  return seen
}

export function isSealedIn(terrainLayer, objectLayer, itemLayer) {
  const cell = objectLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
  const stats = { ...getMoverStats(cell, ENEMY_WIZARD), isFlyingNow: false }

  const closed = floodRegion(terrainLayer, stats, false, ESCAPE_REGION_SIZE)
  if (closed.size >= ESCAPE_REGION_SIZE) return false

  const keyInRoom =
    hasKey(ENEMY_WIZARD.inventory) ||
    [...closed].some((k) => {
      const [x, y] = k.split(',').map(Number)
      return (itemLayer?.[y]?.[x] || []).some((item) => item.type === 'key')
    })
  if (!keyInRoom) return true

  return (
    floodRegion(terrainLayer, stats, true, ESCAPE_REGION_SIZE).size <
    ESCAPE_REGION_SIZE
  )
}
