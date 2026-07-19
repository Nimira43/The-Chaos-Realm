import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { ENEMY_SPELLBOOK } from '../data/enemySpellbook.js'
import { PLAYER } from '../data/player.js'
import { CREATURES } from '../data/creatures.js'
import { terrainCost, MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap } from './utils.js'
import { castSpell } from './spellCaster.js'

const SIGHT_RANGE = 6
const CAST_CHANCE = 0.5 // tweak this to make the enemy wizard more/less trigger-happy

function chebyshevDist(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
}

// Finds the nearest player wizard or player-owned creature to a given origin.
// Reusable for the enemy wizard AND every individual enemy creature.
function findNearestPlayerTarget(objectLayer, originX, originY) {
  let nearest = {
    x: PLAYER.x,
    y: PLAYER.y,
    type: 'player'
  }

  let bestDist = Math.abs(PLAYER.x - originX) + Math.abs(PLAYER.y - originY)

  for (let y = 0; y < objectLayer.length; y++) {
    for (let x = 0; x < objectLayer[y].length; x++) {
      const cell = objectLayer[y][x]
      if (cell && cell.type === 'creature' && cell.owner === 'player') {
        const dist = Math.abs(x - originX) + Math.abs(y - originY)
        if (dist < bestDist) {
          bestDist = dist
          nearest = { x, y, type: 'creature' }
        }
      }
    }
  }

  return { target: nearest, dist: bestDist }
}

// Enemy wizard — movement

function moveEnemyWizard(terrainLayer, objectLayer) {
  let currentLayer = objectLayer
  let moved = false
  let lastPosition = null

  while (ENEMY_WIZARD.ap > 0) {
    const { target } = findNearestPlayerTarget(currentLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)

    const adjacency = chebyshevDist(ENEMY_WIZARD.x, ENEMY_WIZARD.y, target.x, target.y)
    if (adjacency <= 1) break

    const dx = target.x - ENEMY_WIZARD.x
    const dy = target.y - ENEMY_WIZARD.y

    const stepX = wrap(ENEMY_WIZARD.x + Math.sign(dx), MAP_WIDTH)
    const stepY = wrap(ENEMY_WIZARD.y + Math.sign(dy), MAP_HEIGHT)

    const cost = terrainCost[terrainLayer[stepY][stepX]] ?? 999

    if (cost >= 999) break
    if (cost > ENEMY_WIZARD.ap) break
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

  return { objectLayer: currentLayer, moved, position: lastPosition }
}

// Enemy wizard — spellcasting

function isTileFreeForCast(terrainLayer, objectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false

  const terrain = terrainLayer[y][x]
  const blockedTerrain = ['wall', 'water', 'door']
  if (blockedTerrain.includes(terrain)) return false

  if (objectLayer[y][x] !== null) return false

  return true
}

function castEnemyWizardSpell(terrainLayer, objectLayer) {
  const { dist } = findNearestPlayerTarget(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
  if (dist > SIGHT_RANGE) return { objectLayer, cast: false }
  if (Math.random() > CAST_CHANCE) return { objectLayer, cast: false }

  const usableSpells = ENEMY_SPELLBOOK.filter(spell =>
    spell.currentSpellLevel > 0 &&
    ENEMY_WIZARD.current_mana >= spell.manaCost * spell.currentSpellLevel
  )

  if (usableSpells.length === 0) return { objectLayer, cast: false }

  const spell = usableSpells[Math.floor(Math.random() * usableSpells.length)]

  let workingLayer = objectLayer

  const isTileFree = (tile) => isTileFreeForCast(terrainLayer, workingLayer, tile.x, tile.y)

  const spawnCreature = (creatureName, tile) => {
    const creatureData = CREATURES.find(c => c.name === creatureName)
    workingLayer = workingLayer.map(row => [...row])
    workingLayer[tile.y][tile.x] = {
      type: 'creature',
      owner: 'enemy',
      name: creatureName,
      x: tile.x,
      y: tile.y,
      ap: creatureData.action_points_ground,
      stats: creatureData
    }
  }

  castSpell({
    spell,
    casterPos: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
    isTileFree,
    spawnCreature
  })

  const cost = spell.manaCost * spell.currentSpellLevel
  ENEMY_WIZARD.current_mana -= cost
  spell.currentSpellLevel = Math.max(0, spell.currentSpellLevel - 1)

  return { objectLayer: workingLayer, cast: true }
}

// Enemy wizard — combined turn (movement, then a chance to cast)

export function runEnemyWizardAI(terrainLayer, objectLayer) {
  const { dist: initialDist } = findNearestPlayerTarget(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)

  if (initialDist > SIGHT_RANGE) {
    return { objectLayer, moved: false, position: null }
  }

  const moveResult = moveEnemyWizard(terrainLayer, objectLayer)
  const castResult = castEnemyWizardSpell(terrainLayer, moveResult.objectLayer)

  return {
    objectLayer: castResult.objectLayer,
    moved: moveResult.moved,
    position: moveResult.position
  }
}

// Enemy creatures — each summoned creature chases the nearest player target

function moveCreatureToward(terrainLayer, objectLayer, startX, startY) {
  let x = startX
  let y = startY
  let workingLayer = objectLayer
  let moved = false

  let creature = workingLayer[y][x]
  if (!creature) return { objectLayer: workingLayer, moved }

  let ap = creature.ap

  while (ap > 0) {
    const { target, dist } = findNearestPlayerTarget(workingLayer, x, y)
    if (dist > SIGHT_RANGE) break

    const adjacency = chebyshevDist(x, y, target.x, target.y)
    if (adjacency <= 1) break

    const dx = target.x - x
    const dy = target.y - y

    const stepX = wrap(x + Math.sign(dx), MAP_WIDTH)
    const stepY = wrap(y + Math.sign(dy), MAP_HEIGHT)

    const cost = terrainCost[terrainLayer[stepY][stepX]] ?? 999

    if (cost >= 999) break
    if (cost > ap) break
    if (workingLayer[stepY][stepX] !== null) break

    const newLayer = workingLayer.map(row => [...row])
    const movingCreature = newLayer[y][x]
    newLayer[y][x] = null

    ap -= cost
    x = stepX
    y = stepY

    newLayer[y][x] = {
      ...movingCreature,
      x,
      y,
      ap
    }

    workingLayer = newLayer
    moved = true
  }

  return { objectLayer: workingLayer, moved }
}

export function runEnemyCreaturesAI(terrainLayer, objectLayer) {
  let workingLayer = objectLayer

  // Snapshot starting positions first, so each creature moves exactly once
  // this turn using its position at the START of the enemy turn.
  const startingPositions = []
  for (let y = 0; y < workingLayer.length; y++) {
    for (let x = 0; x < workingLayer[y].length; x++) {
      const cell = workingLayer[y][x]
      if (cell && cell.type === 'creature' && cell.owner === 'enemy') {
        startingPositions.push({ x, y })
      }
    }
  }

  startingPositions.forEach(({ x, y }) => {
    const result = moveCreatureToward(terrainLayer, workingLayer, x, y)
    workingLayer = result.objectLayer
  })

  return { objectLayer: workingLayer }
}
