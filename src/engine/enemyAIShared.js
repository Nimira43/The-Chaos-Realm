import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { PLAYER } from '../data/player.js'
import { getMovementCost, MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap, wrappedManhattanDistance } from './utils.js'
import { applyLavaDamage } from './combat.js'
import { canRide, isMounted, mountRider, RIDE_AP_COST } from './mounts.js'
import { findAdjacentMount } from './useMountActions.js'

export const SIGHT_RANGE = 10
const WANDER_RADIUS = 10
const WANDER_ATTEMPTS = 10

export function chebyshevDist(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
}

export function findNearestPlayerTarget(objectLayer, originX, originY) {
  let nearest = { x: PLAYER.x, y: PLAYER.y, type: 'player' }
  let bestDist = wrappedManhattanDistance(originX, originY, PLAYER.x, PLAYER.y, MAP_WIDTH, MAP_HEIGHT)

  for (let y = 0; y < objectLayer.length; y++) {
    for (let x = 0; x < objectLayer[y].length; x++) {
      const cell = objectLayer[y][x]
      if (cell && cell.type === 'creature' && cell.owner === 'player') {
        const dist = wrappedManhattanDistance(originX, originY, x, y, MAP_WIDTH, MAP_HEIGHT)
        if (dist < bestDist) {
          bestDist = dist
          nearest = { x, y, type: 'creature' }
        }
      }
    }
  }

  return {
    target: nearest,
    dist: bestDist
  }
}

export function pickWanderTarget(originX, originY, terrainLayer, objectLayer, entity) {
  for (let i = 0; i < WANDER_ATTEMPTS; i++) {
    const dx = Math.floor(Math.random() * (WANDER_RADIUS * 2 + 1)) - WANDER_RADIUS
    const dy = Math.floor(Math.random() * (WANDER_RADIUS * 2 + 1)) - WANDER_RADIUS
    if (dx === 0 && dy === 0) continue

    const x = wrap(originX + dx, MAP_WIDTH)
    const y = wrap(originY + dy, MAP_HEIGHT)

    if (getMovementCost(terrainLayer[y][x], entity) < 999 && objectLayer[y][x] === null) {
      return { x, y }
    }
  }

  return null
}

export function walkPath({ path, ap, terrainLayer, objectLayer, onStep }) {
  let currentLayer = objectLayer
  let remainingAp = ap
  let moved = false
  let lastPosition = null
  let selfDefeated = false
  const frames = []

  for (const step of path) {
    if (remainingAp <= 0) break

    const terrainType = terrainLayer[step.y][step.x]
    const cost = getMovementCost(terrainType, onStep.entity())

    if (cost > remainingAp) break
    if (currentLayer[step.y][step.x] !== null) break

    remainingAp -= cost
    currentLayer = onStep.move(currentLayer, step, remainingAp)
    moved = true
    lastPosition = step
    frames.push(currentLayer)

    if (terrainType === 'lava') {
      const wasMounted = isMounted(currentLayer[step.y][step.x])
      const lavaResult = applyLavaDamage(currentLayer, step)
      currentLayer = lavaResult.objectLayer
      frames.push(currentLayer)
      if (lavaResult.defeated) {
        selfDefeated = true
        break
      }

      if (wasMounted && !isMounted(currentLayer[step.y][step.x])) break
    }
  }

  return {
    objectLayer: currentLayer,
    ap: remainingAp,
    moved,
    lastPosition,
    selfDefeated, frames
  }
}

export function tryRideAdjacentMount(objectLayer, terrainLayer, x, y, owner, riderStats, riderAp) {
  const riderCell = objectLayer[y][x]
  if (!canRide(riderStats) || isMounted(riderCell) || riderAp < RIDE_AP_COST) return null

  const found = findAdjacentMount(objectLayer, terrainLayer, x, y, owner)
  if (!found) return null

  return mountRider(objectLayer, { x, y }, found.pos)
}