import { terrainColours } from '../engine/terrain.js'
import { wrap } from '../engine/utils.js'

export function drawViewport(ctx, map, player, tileSize, viewTiles, cursor, selected) {
  const radius = Math.floor(viewTiles / 2)

  // Determine what the viewport should centre on
  const centreX = selected?.type === 'player' ? player.x : cursor.x
  const centreY = selected?.type === 'player' ? player.y : cursor.y

  // --- Draw terrain tiles ---
  for (let vy = 0; vy < viewTiles; vy++) {
    for (let vx = 0; vx < viewTiles; vx++) {

      const worldX = wrap(centreX + (vx - radius), map[0].length)
      const worldY = wrap(centreY + (vy - radius), map.length)

      ctx.fillStyle = terrainColours[map[worldY][worldX]]
      ctx.fillRect(vx * tileSize, vy * tileSize, tileSize, tileSize)
    }
  }

  // --- Draw player ---
  const playerScreenX = (player.x - centreX + radius) * tileSize
  const playerScreenY = (player.y - centreY + radius) * tileSize

  ctx.fillStyle = 'white'
  ctx.fillRect(playerScreenX, playerScreenY, tileSize, tileSize)

  // --- Draw cursor highlight (when nothing selected) ---
  if (!selected) {
    const flash = (Date.now() % 600 < 300)
    ctx.strokeStyle = flash ? 'yellow' : 'orange'
    ctx.lineWidth = 3

    // Cursor is always centreed when unselected
    ctx.strokeRect(
      radius * tileSize,
      radius * tileSize,
      tileSize,
      tileSize
    )
  }

  // --- Draw selected highlight (player selected) ---
  if (selected?.type === 'player') {
    ctx.strokeStyle = 'orangered'
    ctx.lineWidth = 4

    ctx.strokeRect(
      radius * tileSize,
      radius * tileSize,
      tileSize,
      tileSize
    )
  }
}

