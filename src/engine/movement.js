import { wrap } from './utils.js'
import { getMovementCost } from './terrain.js'

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
