import {
  MAP_WIDTH,
  MAP_HEIGHT,
  IMPASSABLE_THRESHOLD,
  getMovementCost,
} from './terrain.js'
import { wrap } from './utils.js'
import { canLandOn } from './useMountActions.js'

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

const CLOSED_DOORS = ['doorLocked', 'doorUnlocked']

function labelPieces(terrainLayer, groundStats) {
  const label = Array.from({ length: MAP_HEIGHT }, () =>
    Array(MAP_WIDTH).fill(-1),
  )
  let count = 0

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (label[y][x] !== -1 || !isWalkable(terrainLayer[y][x], groundStats))
        continue

      const queue = [{ x, y }]
      label[y][x] = count
      while (queue.length > 0) {
        const cur = queue.shift()
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = wrap(cur.x + dx, MAP_WIDTH)
          const ny = wrap(cur.y + dy, MAP_HEIGHT)
          if (
            label[ny][nx] !== -1 ||
            !isWalkable(terrainLayer[ny][nx], groundStats)
          )
            continue
          if (
            dx !== 0 &&
            dy !== 0 &&
            (getMovementCost(terrainLayer[cur.y][nx], groundStats) >=
              IMPASSABLE_THRESHOLD ||
              getMovementCost(terrainLayer[ny][cur.x], groundStats) >=
                IMPASSABLE_THRESHOLD)
          )
            continue
          label[ny][nx] = count
          queue.push({ x: nx, y: ny })
        }
      }
      count++
    }
  }

  return { label, count }
}

function isWalkable(terrain, groundStats) {
  if (terrain === 'lava' && !groundStats?.lava_type) return false
  if (CLOSED_DOORS.includes(terrain)) return false
  return getMovementCost(terrain, groundStats) < IMPASSABLE_THRESHOLD
}

function findDoors(terrainLayer) {
  const doors = []
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (CLOSED_DOORS.includes(terrainLayer[y][x]))
        doors.push({ x, y, locked: terrainLayer[y][x] === 'doorLocked' })
    }
  }
  return doors
}

function piecesBeside(label, x, y) {
  const ids = new Set()
  for (const [dx, dy] of NEIGHBOURS) {
    const id = label[wrap(y + dy, MAP_HEIGHT)][wrap(x + dx, MAP_WIDTH)]
    if (id !== -1) ids.add(id)
  }
  return ids
}

function keysInPiece(itemLayer, label, id) {
  let n = 0
  if (!itemLayer) return 0
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (label[y][x] !== id) continue
      n += (itemLayer[y][x] || []).filter((i) => i.type === 'key').length
    }
  }
  return n
}

function playForward(startId, portalId, label, doors, itemLayer, keysHeld) {
  const reached = new Set([startId])
  const counted = new Set()
  const opened = new Set()
  let keys = keysHeld

  for (let guard = 0; guard < 200; guard++) {
    if (reached.has(portalId)) return true

    for (const id of reached) {
      if (!counted.has(id)) {
        counted.add(id)
        keys += keysInPiece(itemLayer, label, id)
      }
    }

    let progressed = false
    for (let d = 0; d < doors.length; d++) {
      if (opened.has(d)) continue
      const door = doors[d]
      const beside = piecesBeside(label, door.x, door.y)
      if (![...beside].some((id) => reached.has(id))) continue
      if (door.locked) {
        if (keys <= 0) continue
        keys--
      }
      opened.add(d)
      beside.forEach((id) => reached.add(id))
      progressed = true
    }

    if (!progressed) return reached.has(portalId)
  }

  return false
}

export function findWalkInLandings(
  terrainLayer,
  objectLayer,
  itemLayer,
  groundStats,
  portal,
  keysHeld = 0,
) {
  const { label, count } = labelPieces(terrainLayer, groundStats)
  const portalId = label[portal.y][portal.x]
  if (portalId === -1) return []

  const doors = findDoors(terrainLayer)
  const good = new Array(count).fill(null)
  const isGood = (id) => {
    if (good[id] === null)
      good[id] = playForward(id, portalId, label, doors, itemLayer, keysHeld)
    return good[id]
  }

  const landings = []
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const id = label[y][x]
      if (id === -1 || (x === portal.x && y === portal.y)) continue
      if (objectLayer[y][x]) continue
      if (!canLandOn(terrainLayer[y][x], groundStats, itemLayer?.[y]?.[x]))
        continue
      if (isGood(id)) landings.push({ x, y })
    }
  }
  return landings
}

export function isOnWalkInGround(
  terrainLayer,
  itemLayer,
  groundStats,
  pos,
  portal,
  keysHeld = 0,
) {
  const { label } = labelPieces(terrainLayer, groundStats)
  const portalId = label[portal.y][portal.x]
  const id = label[pos.y][pos.x]
  if (portalId === -1 || id === -1) return false
  return playForward(
    id,
    portalId,
    label,
    findDoors(terrainLayer),
    itemLayer,
    keysHeld,
  )
}

export function findRouteDoors(terrainLayer, groundStats, from, portal) {
  const { label } = labelPieces(terrainLayer, groundStats)
  const startId = label[from.y][from.x]
  const portalId = label[portal.y][portal.x]
  if (startId === -1 || portalId === -1) return null
  if (startId === portalId) return []

  const doors = findDoors(terrainLayer)
  const beside = doors.map((d) => [...piecesBeside(label, d.x, d.y)])

  const best = new Map([[startId, 0]])
  const prev = new Map([[startId, null]])
  const done = new Set()

  for (;;) {
    let id = null
    for (const [pieceId, cost] of best) {
      if (done.has(pieceId)) continue
      if (id === null || cost < best.get(id)) id = pieceId
    }
    if (id === null || id === portalId) break
    done.add(id)

    doors.forEach((door, d) => {
      if (!beside[d].includes(id)) return
      const cost = best.get(id) + (door.locked ? 1 : 0.01)
      for (const other of beside[d]) {
        if (done.has(other)) continue
        if (!best.has(other) || cost < best.get(other)) {
          best.set(other, cost)
          prev.set(other, { from: id, door })
        }
      }
    })
  }

  if (!prev.has(portalId)) return null
  const route = []
  for (let id = portalId; prev.get(id); id = prev.get(id).from)
    route.unshift(prev.get(id).door)
  return route
}
