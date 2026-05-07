import { terrainColours } from '../engine/terrain.js'
import { wrap } from '../engine/utils.js'

export function drawViewport(
  ctx,
  map,
  player,
  tileSize,
  viewTiles,
  cursor,
  selected,
  objectLayer
) {
  const radius = Math.floor(viewTiles / 2)
  const centreX = selected?.type === 'player' ? player.x : cursor.x
  const centreY = selected?.type === 'player' ? player.y : cursor.y

  for (let vy = 0; vy < viewTiles; vy++) {
    for (let vx = 0; vx < viewTiles; vx++) {

      const worldX = wrap(centreX + (vx - radius), map[0].length)
      const worldY = wrap(centreY + (vy - radius), map.length)

      ctx.fillStyle = terrainColours[map[worldY][worldX]]
      ctx.fillRect(vx * tileSize, vy * tileSize, tileSize, tileSize)
    }
  }

  for (let vy = 0; vy < viewTiles; vy++) {
    for (let vx = 0; vx < viewTiles; vx++) {

      const worldX = wrap(centreX + (vx - radius), map[0].length)
      const worldY = wrap(centreY + (vy - radius), map.length)

      const obj = objectLayer[worldY][worldX]

      if (obj) {
        ctx.fillStyle = 'blue'
        ctx.fillRect(
          vx * tileSize + 6,
          vy * tileSize + 6,
          tileSize - 12,
          tileSize - 12
        )
      }
    }
  }

  const playerScreenX = (player.x - centreX + radius) * tileSize
  const playerScreenY = (player.y - centreY + radius) * tileSize

  ctx.fillStyle = 'white'
  ctx.fillRect(playerScreenX, playerScreenY, tileSize, tileSize)

  if (!selected) {
    const flash = (Date.now() % 600 < 300)
    ctx.strokeStyle = flash ? 'yellow' : 'orange'
    ctx.lineWidth = 3

    ctx.strokeRect(
      radius * tileSize,
      radius * tileSize,
      tileSize,
      tileSize
    )
  }

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
