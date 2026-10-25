import { wrap } from './utils.js'
import { getMovementCost } from './terrain.js'
import { isCurrentlyFlying } from './mounts.js'

export function tryMove(player, dx, dy, map) {
  const newX = wrap(player.x + dx, map[0].length)
  const newY = wrap(player.y + dy, map.length)

  const terrain = map[newY][newX]
  const cost = getMovementCost(terrain, player)

  if (player.ap < cost) return false

  player.ap -= cost
  player.x = newX
  player.y = newY
  return true
}

export function findFlyOverPath(
  objectLayer,
  startX,
  startY,
  dx,
  dy,
  maxTiles = 4,
) {
  const height = objectLayer.length
  const width = objectLayer[0].length
  const tiles = []

  for (let i = 1; i <= maxTiles; i++) {
    const x = wrap(startX + dx * i, width)
    const y = wrap(startY + dy * i, height)
    const cell = objectLayer[y][x]

    tiles.push({ x, y })
    if (!cell) return tiles
    if (isCurrentlyFlying(cell)) return null
  }

  return null
}
