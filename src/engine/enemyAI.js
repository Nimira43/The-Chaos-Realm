import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { ENEMY_SPELLBOOK } from '../data/enemySpellbook.js'
import { PLAYER } from '../data/player.js'
import { CREATURES } from '../data/creatures.js'
import { getMovementCost, MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap } from './utils.js'
import { castSpell } from './spellCaster.js'
import { resolveAttack, applyLavaDamage, ATTACK_AP_COST } from './combat.js'

const SIGHT_RANGE = 6
const CAST_CHANCE = 0.5

function chebyshevDist(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
}

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

function moveEnemyWizard(terrainLayer, objectLayer) {
  let currentLayer = objectLayer
  let moved = false
  let lastPosition = null
  let defeatedTarget = null
  let selfDefeated = false

  while (ENEMY_WIZARD.ap > 0) {
    const { target } = findNearestPlayerTarget(currentLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)

    const adjacency = chebyshevDist(ENEMY_WIZARD.x, ENEMY_WIZARD.y, target.x, target.y)

    if (adjacency <= 1) {
      if (ENEMY_WIZARD.ap >= ATTACK_AP_COST) {
        const result = resolveAttack({
          objectLayer: currentLayer,
          attackerPos: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
          defenderPos: { x: target.x, y: target.y }
        })

        currentLayer = result.objectLayer
        ENEMY_WIZARD.ap -= ATTACK_AP_COST

        if (result.defeated) defeatedTarget = result.defenderType
      }
      break
    }

    const dx = target.x - ENEMY_WIZARD.x
    const dy = target.y - ENEMY_WIZARD.y

    const stepX = wrap(ENEMY_WIZARD.x + Math.sign(dx), MAP_WIDTH)
    const stepY = wrap(ENEMY_WIZARD.y + Math.sign(dy), MAP_HEIGHT)

    const terrainType = terrainLayer[stepY][stepX]
    const cost = getMovementCost(terrainType, ENEMY_WIZARD)

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

    if (terrainType === 'lava') {
      const lavaResult = applyLavaDamage(currentLayer, { x: stepX, y: stepY })
      currentLayer = lavaResult.objectLayer

      if (lavaResult.defeated) {
        selfDefeated = true
        break
      }
    }
  }

  return { objectLayer: currentLayer, moved, position: lastPosition, defeatedTarget, selfDefeated }
}

function isTileFreeForCast(terrainLayer, objectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false

  const terrain = terrainLayer[y][x]
  const blockedTerrain = ['wall', 'water', 'door', 'mountain']
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
      current_health: creatureData.constitution,
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

export function runEnemyWizardAI(terrainLayer, objectLayer) {
  const { dist: initialDist } = findNearestPlayerTarget(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)

  if (initialDist > SIGHT_RANGE) {
    return { objectLayer, moved: false, position: null, defeatedTarget: null, selfDefeated: false }
  }

  const moveResult = moveEnemyWizard(terrainLayer, objectLayer)

  if (moveResult.selfDefeated) {
    return {
      objectLayer: moveResult.objectLayer,
      moved: moveResult.moved,
      position: moveResult.position,
      defeatedTarget: moveResult.defeatedTarget,
      selfDefeated: true
    }
  }

  const castResult = castEnemyWizardSpell(terrainLayer, moveResult.objectLayer)

  return {
    objectLayer: castResult.objectLayer,
    moved: moveResult.moved,
    position: moveResult.position,
    defeatedTarget: moveResult.defeatedTarget,
    selfDefeated: false
  }
}

function moveCreatureToward(terrainLayer, objectLayer, startX, startY) {
  let x = startX
  let y = startY
  let workingLayer = objectLayer
  let moved = false
  let defeatedTarget = null
  let selfDefeated = false

  let creature = workingLayer[y][x]
  if (!creature) return { objectLayer: workingLayer, moved, defeatedTarget, selfDefeated }

  let ap = creature.ap

  while (ap > 0) {
    const { target, dist } = findNearestPlayerTarget(workingLayer, x, y)
    if (dist > SIGHT_RANGE) break

    const adjacency = chebyshevDist(x, y, target.x, target.y)

    if (adjacency <= 1) {
      if (ap >= ATTACK_AP_COST) {
        const result = resolveAttack({
          objectLayer: workingLayer,
          attackerPos: { x, y },
          defenderPos: { x: target.x, y: target.y }
        })

        workingLayer = result.objectLayer
        ap -= ATTACK_AP_COST

        const attackerCell = workingLayer[y][x]
        if (attackerCell) {
          workingLayer = workingLayer.map(row => [...row])
          workingLayer[y][x] = { ...attackerCell, ap }
        }

        if (result.defeated) defeatedTarget = result.defenderType
      }
      break
    }

    const dx = target.x - x
    const dy = target.y - y

    const stepX = wrap(x + Math.sign(dx), MAP_WIDTH)
    const stepY = wrap(y + Math.sign(dy), MAP_HEIGHT)

    const terrainType = terrainLayer[stepY][stepX]
    const cost = getMovementCost(terrainType, creature.stats)

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

    if (terrainType === 'lava') {
      const lavaResult = applyLavaDamage(workingLayer, { x, y })
      workingLayer = lavaResult.objectLayer

      if (lavaResult.defeated) {
        selfDefeated = true
        break
      }
    }
  }

  return { objectLayer: workingLayer, moved, defeatedTarget, selfDefeated }
}

export function runEnemyCreaturesAI(terrainLayer, objectLayer) {
  let workingLayer = objectLayer
  const defeatedTargets = []
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
    if (result.defeatedTarget) defeatedTargets.push(result.defeatedTarget)
  })

  return { objectLayer: workingLayer, defeatedTargets }
}
