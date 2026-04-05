import { PLAYER } from './player.js'

import { CREATURES } from './data.js'
console.log(CREATURES)

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

const terrainCost = {
  grass: 2,
  rough: 4,
  water: 999 // impassable for now
}

let round = 1
let isPlayerTurn = true

function updateTurnCounter() {
  document.getElementById('turn-counter').textContent = `Turn ${round} / 30`
}

const canvas = document.getElementById('map')
canvas.width = VIEW_TILES * TILE_SIZE
canvas.height = VIEW_TILES * TILE_SIZE
const ctx = canvas.getContext('2d')

function wrap(n, max) {
  return (n + max) % max
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

      ctx.fillStyle = terrainColours[map[worldY][worldX]]
      ctx.fillRect(
        vx * TILE_SIZE,
        vy * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE
      )
    }
  }

  // Draw player in centre
  ctx.fillStyle = 'white'
  ctx.fillRect(
    VIEW_RADIUS * TILE_SIZE,
    VIEW_RADIUS * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE
  )
}

window.addEventListener('keydown', (e) => {
  if (!isPlayerTurn) return

  let dx = 0
  let dy = 0

  if (e.key === 'ArrowUp') dy = -1
  else if (e.key === 'ArrowDown') dy = 1
  else if (e.key === 'ArrowLeft') dx = -1
  else if (e.key === 'ArrowRight') dx = 1
  else return

  const newX = wrap(playerX + dx, MAP_WIDTH)
  const newY = wrap(playerY + dy, MAP_HEIGHT)

  const terrain = map[newY][newX]
  const cost = terrainCost[terrain]

  if (PLAYER.ap < cost) {
    console.log('Not enough AP')
    return
  }

  PLAYER.ap -= cost
  document.getElementById('ap-display').textContent = `AP: ${PLAYER.ap}`

  playerX = newX
  playerY = newY

  drawViewport()
})

document.getElementById('end-turn-btn').addEventListener('click', () => {
  if (!isPlayerTurn) return

  isPlayerTurn = false

  alert('Enemy Wizard is moving...\nDone!')

  // Reset AP
  PLAYER.ap = PLAYER.max_ap
  document.getElementById('ap-display').textContent = `AP: ${PLAYER.ap}`

  // Next round
  round++
  updateTurnCounter()

  if (round > 30) {
    alert('Round 30 reached — game over!')
    return
  }

  isPlayerTurn = true
  drawViewport()
})

// Initialise UI
updateTurnCounter()
document.getElementById('ap-display').textContent = `AP: ${PLAYER.ap}`

drawViewport()
