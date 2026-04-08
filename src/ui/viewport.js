import { terrainColours } from '../engine/terrain.js'
import { wrap } from '../engine/utils.js'

export function drawViewport(ctx, map, player, tileSize, viewTiles) {
  const radius = Math.floor(viewTiles / 2)

  for (let vy = 0; vy < viewTiles; vy++) {
    for (let vx = 0; vx < viewTiles; vx++) {
      const worldX = wrap(player.x + (vx - radius), map[0].length)
      const worldY = wrap(player.y + (vy - radius), map.length)

      ctx.fillStyle = terrainColours[map[worldY][worldX]]
      ctx.fillRect(vx * tileSize, vy * tileSize, tileSize, tileSize)
    }
  }

  ctx.fillStyle = 'white'
  ctx.fillRect(radius * tileSize, radius * tileSize, tileSize, tileSize)
}

