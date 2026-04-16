import { PLAYER } from './data/player.js'
import { generateProceduralMap } from './engine/map.js'
import { tryMove } from './engine/movement.js'
import { drawViewport } from './ui/viewport.js'

const TILE_SIZE = 48
const VIEW_TILES = 15

const canvas = document.getElementById('map')
canvas.width = VIEW_TILES * TILE_SIZE
canvas.height = VIEW_TILES * TILE_SIZE
const ctx = canvas.getContext('2d')

let round = 1
let isPlayerTurn = true

const map = generateProceduralMap()

function updateTurnCounter() {
  document.getElementById('turn-counter').textContent = `Turn ${round} / 30`
}

drawViewport(ctx, map, PLAYER, TILE_SIZE, VIEW_TILES)
updateTurnCounter()
document.getElementById('ap-display').textContent = `AP: ${PLAYER.ap}`

window.addEventListener('keydown', (e) => {
  if (!isPlayerTurn) return

  let dx = 0
  let dy = 0

  if (e.key === 'ArrowUp') dy = -1
  else if (e.key === 'ArrowDown') dy = 1
  else if (e.key === 'ArrowLeft') dx = -1
  else if (e.key === 'ArrowRight') dx = 1
  else return

  if (tryMove(PLAYER, dx, dy, map)) {
    document.getElementById('ap-display').textContent = `AP: ${PLAYER.ap}`
    drawViewport(ctx, map, PLAYER, TILE_SIZE, VIEW_TILES)
  }
})

document.getElementById('end-turn-btn').addEventListener('click', () => {
  if (!isPlayerTurn) return

  isPlayerTurn = false

  alert('Enemy Wizard is moving...\nDone!')

  PLAYER.ap = PLAYER.max_ap
  document.getElementById('ap-display').textContent = `AP: ${PLAYER.ap}`

  round++
  updateTurnCounter()

  if (round > 30) {
    alert('Round 30 reached — game over!')
    return
  }

  isPlayerTurn = true
  drawViewport(ctx, map, PLAYER, TILE_SIZE, VIEW_TILES)
})
