import { PLAYER } from './player.js'

import { CREATURES } from './data.js'
console.log(CREATURES)

const MAP_WIDTH = 32
const MAP_HEIGHT = 32
const TILE_SIZE = 48
const VIEW_TILES = 15
const VIEW_RADIUS = Math.floor(VIEW_TILES / 2)

const terrainColours = {
  grass:  '#3cb043',
  rough:  '#8b5a2b',
  rock:   '#777777',
  swamp:  '#6b8e23',
  water:  '#1e90ff',
  forest: '#0b6623'
}

const terrainCost = {
  grass: 2,
  rough: 4,
  rock:  5,
  swamp: 6,
  water: 999, // impassable for now
  forest: 4
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

function createEmptyMap() {
  const m = []
  for (let y = 0; y < MAP_HEIGHT; y++) {
    m[y] = []
    for (let x = 0; x < MAP_WIDTH; x++) {
      m[y][x] = 'grass'
    }
  }
  return m
}

function addBlob(map, terrain, centerX, centerY, radius) {
  // Main blob (with jitter)
  for (let y = centerY - radius; y <= centerY + radius; y++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      const dx = x - centerX
      const dy = y - centerY
      const jitter = Math.random() * 1.5 - 0.75

      if (dx * dx + dy * dy <= (radius + jitter) * (radius + jitter)) {
        const wx = wrap(x, MAP_WIDTH)
        const wy = wrap(y, MAP_HEIGHT)
        map[wy][wx] = terrain
      }
    }
  }

  // --- Level 3: Satellite blobs ---
  const satellites = 1 + Math.floor(Math.random() * 3) // 1–3 satellites

  for (let i = 0; i < satellites; i++) {
    const offsetX = centerX + Math.floor(Math.random() * 6 - 3)
    const offsetY = centerY + Math.floor(Math.random() * 6 - 3)
    const smallRadius = Math.max(1, radius - 1 - Math.floor(Math.random() * 2))

    // Draw the satellite blob
    for (let y = offsetY - smallRadius; y <= offsetY + smallRadius; y++) {
      for (let x = offsetX - smallRadius; x <= offsetX + smallRadius; x++) {
        const dx = x - offsetX
        const dy = y - offsetY
        const jitter = Math.random() * 1.2 - 0.6

        if (dx * dx + dy * dy <= (smallRadius + jitter) * (smallRadius + jitter)) {
          const wx = wrap(x, MAP_WIDTH)
          const wy = wrap(y, MAP_HEIGHT)
          map[wy][wx] = terrain
        }
      }
    }
  }
}
function applyBiomeRules(map) {
  const newMap = JSON.parse(JSON.stringify(map))

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {

      const tile = map[y][x]

      // Count neighbours
      let waterN = 0
      let forestN = 0
      let rockN = 0

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = wrap(x + dx, MAP_WIDTH)
          const ny = wrap(y + dy, MAP_HEIGHT)
          const nTile = map[ny][nx]

          if (nTile === 'water') waterN++
          if (nTile === 'forest') forestN++
          if (nTile === 'rock') rockN++
        }
      }

      // --- BIOME RULES ---

      // Swamp forms near water
      if (tile === 'grass' && waterN >= 3) {
        newMap[y][x] = 'swamp'
      }

      // Forest spreads near water or other forest
      if (tile === 'grass' && (forestN >= 3 || waterN >= 2)) {
        newMap[y][x] = 'forest'
      }

      // Rock avoids water (turns to rough)
      if (tile === 'rock' && waterN >= 2) {
        newMap[y][x] = 'rough'
      }

      // Rough transitions into rock if surrounded
      if (tile === 'rough' && rockN >= 4) {
        newMap[y][x] = 'rock'
      }

      // Grass fills isolated tiles
      if (tile !== 'grass' && waterN === 0 && forestN === 0 && rockN === 0) {
        if (Math.random() < 0.05) newMap[y][x] = 'grass'
      }
    }
  }

  return newMap
}

function generateProceduralMap() {
  let m = createEmptyMap()

  // Rough patches
  for (let i = 0; i < 8; i++) {
    const cx = Math.floor(Math.random() * MAP_WIDTH)
    const cy = Math.floor(Math.random() * MAP_HEIGHT)
    const r  = 2 + Math.floor(Math.random() * 3)
    addBlob(m, 'rough', cx, cy, r)
  }

  // Rock clusters
  for (let i = 0; i < 6; i++) {
    const cx = Math.floor(Math.random() * MAP_WIDTH)
    const cy = Math.floor(Math.random() * MAP_HEIGHT)
    const r  = 2 + Math.floor(Math.random() * 3)
    addBlob(m, 'rock', cx, cy, r)
  }

  // Swamp pools
  for (let i = 0; i < 5; i++) {
    const cx = Math.floor(Math.random() * MAP_WIDTH)
    const cy = Math.floor(Math.random() * MAP_HEIGHT)
    const r  = 2 + Math.floor(Math.random() * 3)
    addBlob(m, 'swamp', cx, cy, r)
  }

  // Lakes
  for (let i = 0; i < 4; i++) {
    const cx = Math.floor(Math.random() * MAP_WIDTH)
    const cy = Math.floor(Math.random() * MAP_HEIGHT)
    const r  = 2 + Math.floor(Math.random() * 4)
    addBlob(m, 'water', cx, cy, r)
  }

  // Forests
  for (let i = 0; i < 7; i++) {
    const cx = Math.floor(Math.random() * MAP_WIDTH)
    const cy = Math.floor(Math.random() * MAP_HEIGHT)
    const r  = 2 + Math.floor(Math.random() * 4)
    addBlob(m, 'forest', cx, cy, r)
  }

  m = applyBiomeRules(m)
return m
}

const map = generateProceduralMap()


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
