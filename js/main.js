import { CREATURES } from './creatures.js'
import { SPELLS } from './spellbook.js'

const MAP_WIDTH = 32
const MAP_HEIGHT = 32
const TILE_SIZE = 48
const VIEW_TILES = 15
const VIEW_RADIUS = Math.floor(VIEW_TILES / 2)

const terrainColours = {
  grass: '#3cb043',
  rough: '#8b5a2b',
  water: '#1e90ff'
}

console.log(CREATURES)
console.log(SPELLS)

const canvas = document.getElementById('map')
canvas.width = VIEW_TILES * TILE_SIZE
canvas.height = VIEW_TILES * TILE_SIZE
const ctx = canvas.getContext('2d')

function wrap(n, max) {
  return (n + max) % max;
}

const map = []
for (let y = 0; y < MAP_HEIGHT; y++) {
  map[y] = []
  for (let x = 0; x < MAP_WIDTH; x++) {
    const r = Math.random()
    if (r < 0.7) map[y][x] = 'grass'
    else if (r < 0.9) map[y][x] = 'rough'
    else map[y][x] = 'water'
  }
}

let playerX = Math.floor(MAP_WIDTH / 2)
let playerY = Math.floor(MAP_HEIGHT / 2)

function drawViewport() {
  for (let vy = 0; vy < VIEW_TILES; vy++) {
    for (let vx = 0; vx < VIEW_TILES; vx++) {
      const worldX = wrap(playerX + (vx - VIEW_RADIUS), MAP_WIDTH)
      const worldY = wrap(playerY + (vy - VIEW_RADIUS), MAP_HEIGHT)

      ctx.fillStyle = terrainColours[map[worldY][worldX]];
      ctx.fillRect(
        vx * TILE_SIZE,
        vy * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE
      )
    }
  }

  ctx.fillStyle = 'white'
  ctx.fillRect(
    VIEW_RADIUS * TILE_SIZE,
    VIEW_RADIUS * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE
  )
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') playerY = wrap(playerY - 1, MAP_HEIGHT)
  else if (e.key === 'ArrowDown') playerY = wrap(playerY + 1, MAP_HEIGHT)
  else if (e.key === 'ArrowLeft') playerX = wrap(playerX - 1, MAP_WIDTH)
  else if (e.key === 'ArrowRight') playerX = wrap(playerX + 1, MAP_WIDTH)
  else return

  drawViewport()
})

drawViewport()