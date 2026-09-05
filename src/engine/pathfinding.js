import { getMovementCost, MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap } from './utils.js'

const NEIGHBOUR_OFFSETS = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
]

const LAVA_AVOIDANCE_PENALTY = 500

export function getAdjacentTiles(x, y) {
  return NEIGHBOUR_OFFSETS.map(offset => ({
    x: wrap(x + offset.x, MAP_WIDTH),
    y: wrap(y + offset.y, MAP_HEIGHT)
  }))
}

export function findPathToNearestGoal({ terrainLayer, objectLayer, start, goals, entity, maxExplored = 1500, forbidLava = false }) {
  const goalSet = new Set(goals.map(g => `${g.x},${g.y}`))
  if (goalSet.size === 0) return []

  const startKey = `${start.x},${start.y}`
  if (goalSet.has(startKey)) return []

  const prev = new Map()
  const bestCost = new Map([[startKey, 0]])
  const visited = new Set()
  const frontier = [{ x: start.x, y: start.y, cost: 0 }]

  while (frontier.length > 0) {
    let bestIndex = 0
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].cost < frontier[bestIndex].cost) bestIndex = i
    }
    const current = frontier.splice(bestIndex, 1)[0]
    const currentKey = `${current.x},${current.y}`

    if (visited.has(currentKey)) continue
    visited.add(currentKey)

    if (goalSet.has(currentKey)) {
      const path = []
      let key = currentKey
      while (key !== startKey) {
        const [x, y] = key.split(',').map(Number)
        path.unshift({ x, y })
        key = prev.get(key)
      }
      return path
    }

    if (visited.size > maxExplored) break

    for (const offset of NEIGHBOUR_OFFSETS) {
      const nx = wrap(current.x + offset.x, MAP_WIDTH)
      const ny = wrap(current.y + offset.y, MAP_HEIGHT)
      const nKey = `${nx},${ny}`

      if (visited.has(nKey)) continue
      if (objectLayer[ny][nx] !== null) continue

      const terrainType = terrainLayer[ny][nx]
      const cost = getMovementCost(terrainType, entity)
      if (cost >= 999) continue

      if (offset.x !== 0 && offset.y !== 0) {
        const flankACost = getMovementCost(terrainLayer[current.y][nx], entity)
        const flankBCost = getMovementCost(terrainLayer[ny][current.x], entity)

        if (flankACost >= 999 || flankBCost >= 999) continue
      }

      const isLava = terrainType === 'lava'
      const lavaIsHazardHere = isLava && !entity?.lava_type

      if (lavaIsHazardHere && forbidLava) continue

      const pathCost = lavaIsHazardHere ? cost + LAVA_AVOIDANCE_PENALTY : cost

      const newCost = current.cost + pathCost
      const known = bestCost.get(nKey)

      if (known === undefined || newCost < known) {
        bestCost.set(nKey, newCost)
        prev.set(nKey, currentKey)
        frontier.push({ x: nx, y: ny, cost: newCost })
      }
    }
  }

  return [] 
}
