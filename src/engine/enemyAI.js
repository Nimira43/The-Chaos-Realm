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

export function runEnemyWizardAI(terrainLayer, objectLayer) {
  // Aware of the player wizard AND any player-owned creatures.
  // Moves 1 step toward whichever is nearest, if within range.
  const { target, dist } = findNearestTarget(objectLayer)

  if (dist > 6) {
    return { moved: false, objectLayer }
  }

  const dx = target.x - ENEMY_WIZARD.x
  const dy = target.y - ENEMY_WIZARD.y

  const stepX = wrap(ENEMY_WIZARD.x + Math.sign(dx), MAP_WIDTH)
  const stepY = wrap(ENEMY_WIZARD.y + Math.sign(dy), MAP_HEIGHT)

  const cost = terrainCost[terrainLayer[stepY][stepX]] ?? 999
  if (cost >= 999) {
    return { moved: false, objectLayer }
  }

  // Don't walk onto an occupied tile — no combat yet
  if (objectLayer[stepY][stepX] !== null) {
    return { moved: false, objectLayer }
  }

  const newLayer = objectLayer.map(row => [...row])
  newLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = null

  ENEMY_WIZARD.x = stepX
  ENEMY_WIZARD.y = stepY

  newLayer[stepY][stepX] = {
    type: 'enemyWizard',
    name: 'Enemy Wizard',
    owner: 'enemy',
    ref: ENEMY_WIZARD
  }

  return {
    moved: true,
    objectLayer: newLayer,
    position: { x: stepX, y: stepY }
  }
}