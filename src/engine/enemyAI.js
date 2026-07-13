import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { PLAYER } from '../data/player.js'
import { terrainCost, MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap } from './utils.js'

function findNearestTarget(objectLayer) {

  let nearest = {
    x: PLAYER.x,
    y: PLAYER.y,
    type: 'player'
  }

  let bestDist = Math.abs(PLAYER.x - ENEMY_WIZARD.x) + Math.abs(PLAYER.y - ENEMY_WIZARD.y)

  for (let y = 0; y < objectLayer.length; y++) {
    for (let x = 0; x < objectLayer[y].length; x++) {
      const cell = objectLayer[y][x]
      if (cell && cell.type === 'creature' && cell.owner === 'player') {
        const dist = Math.abs(x - ENEMY_WIZARD.x) + Math.abs(y - ENEMY_WIZARD.y)
        if (dist < bestDist) {
          bestDist = dist
          nearest = { x, y, type: 'creature' }
        }
      }
    }
  }

  return { target: nearest, dist: bestDist }
}

function chebyshevDist(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
}

export function runEnemyWizardAI(terrainLayer, objectLayer) {
  // Aware of the player wizard AND any player-owned creatures.
  // Spends its AP for the turn stepping toward whichever is nearest,
  // one tile at a time, until it runs out of AP, gets blocked, or
  // becomes adjacent to its target.
  const { dist: initialDist } = findNearestTarget(objectLayer)

  if (initialDist > 6) {
    return { moved: false, objectLayer }
  }

  let currentLayer = objectLayer
  let moved = false
  let lastPosition = null

  while (ENEMY_WIZARD.ap > 0) {
    const { target, dist } = findNearestTarget(currentLayer)

    // Stop once genuinely adjacent — don't walk into their tile, combat isn't wired up yet
    const adjacency = chebyshevDist(ENEMY_WIZARD.x, ENEMY_WIZARD.y, target.x, target.y)
    if (adjacency <= 1) break

    const dx = target.x - ENEMY_WIZARD.x
    const dy = target.y - ENEMY_WIZARD.y

    const stepX = wrap(ENEMY_WIZARD.x + Math.sign(dx), MAP_WIDTH)
    const stepY = wrap(ENEMY_WIZARD.y + Math.sign(dy), MAP_HEIGHT)

    const cost = terrainCost[terrainLayer[stepY][stepX]] ?? 999

    if (cost >= 999) break
    if (cost > ENEMY_WIZARD.ap) break

    // Don't walk onto an occupied tile — no combat yet
    if (currentLayer[stepY][stepX] !== null) break

    const newLayer = currentLayer.map(row => [...row])
    newLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = null

    ENEMY_WIZARD.x = stepX
    ENEMY_WIZARD.y = stepY
    ENEMY_WIZARD.ap -= cost

    newLayer[stepY][stepX] = {
      type: 'enemyWizard',
      name: 'Enemy Wizard',
      owner: 'enemy',
      ref: ENEMY_WIZARD
    }

    currentLayer = newLayer
    moved = true
    lastPosition = { x: stepX, y: stepY }
  }

  return {
    moved,
    objectLayer: currentLayer,
    position: lastPosition
  }
}