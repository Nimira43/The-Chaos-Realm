import { terrainColours } from '../engine/terrain.js'
import { wrap, wrappedDelta } from '../engine/utils.js'
import { CREATURES } from '../data/creatures.js'

function getCreatureCode(name) {
  const creature = CREATURES.find(c => c.name === name)
  if (creature?.code) return creature.code

  return name
    .replace(/[^A-Z]/gi, '')
    .substring(0, 3)
    .toUpperCase()
}

function drawFireTile(ctx, screenX, screenY, tileSize) {
  const flicker = (Date.now() % 400 < 200)
  const pad = tileSize * 0.12
  const left = screenX + pad
  const right = screenX + tileSize - pad
  const top = screenY + pad
  const bottom = screenY + tileSize - pad
  const midX = screenX + tileSize / 2

  ctx.fillStyle = flicker ? '#ff7b00' : '#ff9500'
  ctx.beginPath()
  ctx.moveTo(midX, top)
  ctx.lineTo(left, bottom)
  ctx.lineTo(right, bottom)
  ctx.closePath()
  ctx.fill()

  const innerPad = tileSize * 0.28
  const innerLeft = screenX + innerPad
  const innerRight = screenX + tileSize - innerPad
  const innerTop = screenY + pad + tileSize * 0.12
  const innerBottom = screenY + tileSize - pad

  ctx.fillStyle = '#fff173'
  ctx.beginPath()
  ctx.moveTo(midX, innerTop)
  ctx.lineTo(innerLeft, innerBottom)
  ctx.lineTo(innerRight, innerBottom)
  ctx.closePath()
  ctx.fill()
}

export function drawViewport(
  ctx,
  map,
  player,
  tileSize,
  viewTiles,
  cursor,
  selected,
  objectLayer,
  effectLayer
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

  if (effectLayer) {
    for (let vy = 0; vy < viewTiles; vy++) {
      for (let vx = 0; vx < viewTiles; vx++) {

        const worldX = wrap(centreX + (vx - radius), map[0].length)
        const worldY = wrap(centreY + (vy - radius), map.length)

        if (effectLayer[worldY][worldX]?.type === 'fire') {
          drawFireTile(ctx, vx * tileSize, vy * tileSize, tileSize)
        }
      }
    }
  }

  for (let vy = 0; vy < viewTiles; vy++) {
    for (let vx = 0; vx < viewTiles; vx++) {

      const worldX = wrap(centreX + (vx - radius), map[0].length)
      const worldY = wrap(centreY + (vy - radius), map.length)

      const obj = objectLayer[worldY][worldX]

      if (obj && obj.type === 'creature') {
        ctx.fillStyle = obj.owner === 'enemy' ? '#ff0e0e' : 'blue'
        ctx.fillRect(
          vx * tileSize + 6,
          vy * tileSize + 6,
          tileSize - 12,
          tileSize - 12
        )

        const code = getCreatureCode(obj.name)

        ctx.fillStyle = 'white'
        ctx.font = 'bold 14px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          code,
          vx * tileSize + tileSize / 2,
          vy * tileSize + tileSize / 2
        )
      }

      if (obj && obj.type === 'enemyWizard') {
        ctx.fillStyle = '#ff0e0e'
        ctx.fillRect(
          vx * tileSize + 4,
          vy * tileSize + 4,
          tileSize - 8,
          tileSize - 8
        )

        ctx.fillStyle = 'white'
        ctx.font = 'bold 14px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          'EW',
          vx * tileSize + tileSize / 2,
          vy * tileSize + tileSize / 2
        )
      }

    }
  }

  const dx = wrappedDelta(player.x - centreX, map[0].length)
  const dy = wrappedDelta(player.y - centreY, map.length)
  const playerScreenX = (dx + radius) * tileSize
  const playerScreenY = (dy + radius) * tileSize

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