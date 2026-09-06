import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { ENEMY_SPELLBOOK } from '../data/enemySpellbook.js'
import { PLAYER } from '../data/player.js'
import { CREATURES } from '../data/creatures.js'
import { getMovementCost, MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap, wrappedManhattanDistance } from './utils.js'
import { castSpell } from './spellCaster.js'
import { resolveAttack, applyLavaDamage, ATTACK_AP_COST } from './combat.js'
import { findPathToNearestGoal, getAdjacentTiles } from './pathfinding.js'
import { FIRE_DURATION_TURNS, isTileIgnitable as checkTileIgnitable } from './environmentEffects.js'

const SIGHT_RANGE = 10
const WANDER_RADIUS = 10
const WANDER_ATTEMPTS = 10
const CAST_CHANCE = 0.5 

function chebyshevDist(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
}

function findNearestPlayerTarget(objectLayer, originX, originY) {
  let nearest = { x: PLAYER.x, y: PLAYER.y, type: 'player' }
  let bestDist = wrappedManhattanDistance(originX, originY, PLAYER.x, PLAYER.y, MAP_WIDTH, MAP_HEIGHT)

  for (let y = 0; y < objectLayer.length; y++) {
    for (let x = 0; x < objectLayer[y].length; x++) {
      const cell = objectLayer[y][x]
      if (cell && cell.type === 'creature' && cell.owner === 'player') {
        const dist = wrappedManhattanDistance(originX, originY, x, y, MAP_WIDTH, MAP_HEIGHT)
        if (dist < bestDist) {
          bestDist = dist
          nearest = { x, y, type: 'creature' }
        }
      }
    }
  }

  return { target: nearest, dist: bestDist }
}

function pickWanderTarget(originX, originY, terrainLayer, objectLayer, entity) {
  for (let i = 0; i < WANDER_ATTEMPTS; i++) {
    const dx = Math.floor(Math.random() * (WANDER_RADIUS * 2 + 1)) - WANDER_RADIUS
    const dy = Math.floor(Math.random() * (WANDER_RADIUS * 2 + 1)) - WANDER_RADIUS
    if (dx === 0 && dy === 0) continue

    const x = wrap(originX + dx, MAP_WIDTH)
    const y = wrap(originY + dy, MAP_HEIGHT)

    if (getMovementCost(terrainLayer[y][x], entity) < 999 && objectLayer[y][x] === null) {
      return { x, y }
    }
  }

  return null
}

function walkPath({ path, ap, terrainLayer, objectLayer, onStep }) {
  let currentLayer = objectLayer
  let remainingAp = ap
  let moved = false
  let lastPosition = null
  let selfDefeated = false
  const frames = []

  for (const step of path) {
    if (remainingAp <= 0) break

    const terrainType = terrainLayer[step.y][step.x]
    const cost = getMovementCost(terrainType, onStep.entity())

    if (cost > remainingAp) break
    if (currentLayer[step.y][step.x] !== null) break 

    remainingAp -= cost
    currentLayer = onStep.move(currentLayer, step, remainingAp)
    moved = true
    lastPosition = step
    frames.push(currentLayer)

    if (terrainType === 'lava') {
      const lavaResult = applyLavaDamage(currentLayer, step)
      currentLayer = lavaResult.objectLayer
      frames.push(currentLayer)
      if (lavaResult.defeated) {
        selfDefeated = true
        break
      }
    }
  }

  return {
    objectLayer: currentLayer,
    ap: remainingAp,
    moved, lastPosition,
    selfDefeated, frames
  }
}

function moveEnemyWizard(terrainLayer, objectLayer, portalPosition) {
  const { target, dist } = findNearestPlayerTarget(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
  const seekingPlayer = dist <= SIGHT_RANGE
  const adjacentToPlayerNow = seekingPlayer && chebyshevDist(ENEMY_WIZARD.x, ENEMY_WIZARD.y, target.x, target.y) <= 1
  const alreadyAtPortal = portalPosition && ENEMY_WIZARD.x === portalPosition.x && ENEMY_WIZARD.y === portalPosition.y

  let path = []

  if (portalPosition && !adjacentToPlayerNow && !alreadyAtPortal) {
    ENEMY_WIZARD.wanderTarget = null
    path = findPathToNearestGoal({
      terrainLayer,
      objectLayer,
      start: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
      goals: [portalPosition],
      entity: ENEMY_WIZARD
    })
  }

  if (path.length === 0 && !alreadyAtPortal && seekingPlayer) {
    ENEMY_WIZARD.wanderTarget = null
    path = findPathToNearestGoal({
      terrainLayer,
      objectLayer,
      start: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
      goals: getAdjacentTiles(target.x, target.y),
      entity: ENEMY_WIZARD
    })
  }

  if (path.length === 0 && !portalPosition && !alreadyAtPortal) {
    const reached =
      ENEMY_WIZARD.wanderTarget &&
      ENEMY_WIZARD.x === ENEMY_WIZARD.wanderTarget.x &&
      ENEMY_WIZARD.y === ENEMY_WIZARD.wanderTarget.y

    if (!ENEMY_WIZARD.wanderTarget || reached) {
      ENEMY_WIZARD.wanderTarget = pickWanderTarget(ENEMY_WIZARD.x, ENEMY_WIZARD.y, terrainLayer, objectLayer, ENEMY_WIZARD)
    }

    if (ENEMY_WIZARD.wanderTarget) {
      path = findPathToNearestGoal({
        terrainLayer,
        objectLayer,
        start: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
        goals: [ENEMY_WIZARD.wanderTarget],
        entity: ENEMY_WIZARD,
        forbidLava: true
      })

      if (path.length === 0) ENEMY_WIZARD.wanderTarget = null
    }
  }

  if (path.length > 0) {
    console.debug(
      '[enemy wizard] path:',
      path.map(p => `${p.x},${p.y} (${terrainLayer[p.y][p.x]})`).join(' -> ')
    )
  }

  const walkResult = walkPath({
    path,
    ap: ENEMY_WIZARD.ap,
    terrainLayer,
    objectLayer,
    onStep: {
      entity: () => ENEMY_WIZARD,
      move: (layer, step) => {
        const newLayer = layer.map(row => [...row])
        newLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = null
        ENEMY_WIZARD.x = step.x
        ENEMY_WIZARD.y = step.y
        newLayer[step.y][step.x] = {
          type: 'enemyWizard',
          name: 'Enemy Wizard',
          owner: 'enemy',
          ref: ENEMY_WIZARD
        }
        return newLayer
      }
    }
  })

  ENEMY_WIZARD.ap = walkResult.ap

  let currentLayer = walkResult.objectLayer
  let defeatedTarget = null
  const frames = [...walkResult.frames]

  if (!walkResult.selfDefeated && seekingPlayer) {
    const { target: freshTarget } = findNearestPlayerTarget(currentLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
    const adjacency = chebyshevDist(ENEMY_WIZARD.x, ENEMY_WIZARD.y, freshTarget.x, freshTarget.y)

    if (adjacency <= 1 && ENEMY_WIZARD.ap >= ATTACK_AP_COST) {
      const result = resolveAttack({
        objectLayer: currentLayer,
        attackerPos: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
        defenderPos: { x: freshTarget.x, y: freshTarget.y }
      })

      if (!result.blocked) {
        currentLayer = result.objectLayer
        ENEMY_WIZARD.ap -= ATTACK_AP_COST
        frames.push(currentLayer)
        if (result.defeated) defeatedTarget = result.defenderType
      }
    }
  }

  return {
    objectLayer: currentLayer,
    moved: walkResult.moved,
    position: walkResult.lastPosition,
    defeatedTarget,
    selfDefeated: walkResult.selfDefeated,
    frames
  }
}

function isTileFreeForCast(terrainLayer, objectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false

  const terrain = terrainLayer[y][x]
  const blockedTerrain = ['wall', 'water', 'door', 'mountain', 'lava']
  if (blockedTerrain.includes(terrain)) return false

  if (objectLayer[y][x] !== null) return false

  return true
}

function castEnemyWizardSpell(terrainLayer, objectLayer, effectLayer) {
  const { dist } = findNearestPlayerTarget(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
  if (dist > SIGHT_RANGE) return { objectLayer, effectLayer, cast: false }
  if (Math.random() > CAST_CHANCE) return { objectLayer, effectLayer, cast: false }

  const usableSpells = ENEMY_SPELLBOOK.filter(spell =>
    spell.currentSpellLevel > 0 &&
    ENEMY_WIZARD.current_mana >= spell.manaCost * spell.currentSpellLevel
  )

  if (usableSpells.length === 0) return { objectLayer, effectLayer, cast: false }

  const spell = usableSpells[Math.floor(Math.random() * usableSpells.length)]

  let workingLayer = objectLayer
  let workingEffectLayer = effectLayer

  const isTileFree = (tile) => isTileFreeForCast(terrainLayer, workingLayer, tile.x, tile.y)
  const isTileIgnitable = (tile) => checkTileIgnitable(terrainLayer, tile.x, tile.y)

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
      stats: creatureData,
      wanderTarget: null
    }
  }

  const igniteTile = (tile) => {
    workingEffectLayer = workingEffectLayer.map(row => [...row])
    workingEffectLayer[tile.y][tile.x] = { type: 'fire', turnsRemaining: FIRE_DURATION_TURNS }
  }

  castSpell({
    spell,
    casterPos: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
    isTileFree,
    spawnCreature,
    isTileIgnitable,
    igniteTile
  })

  const cost = spell.manaCost * spell.currentSpellLevel
  ENEMY_WIZARD.current_mana -= cost
  spell.currentSpellLevel = Math.max(0, spell.currentSpellLevel - 1)

  return {
    objectLayer: workingLayer,
    effectLayer: workingEffectLayer,
    cast: true
  }
}

export function runEnemyWizardAI(terrainLayer, objectLayer, portalPosition, effectLayer) {
  const moveResult = moveEnemyWizard(terrainLayer, objectLayer, portalPosition)

  if (moveResult.selfDefeated) {
    return {
      objectLayer: moveResult.objectLayer,
      effectLayer,
      moved: moveResult.moved,
      position: moveResult.position,
      defeatedTarget: moveResult.defeatedTarget,
      selfDefeated: true,
      frames: moveResult.frames
    }
  }

  const castResult = castEnemyWizardSpell(terrainLayer, moveResult.objectLayer, effectLayer)
  const frames = castResult.cast ? [...moveResult.frames, castResult.objectLayer] : moveResult.frames

  return {
    objectLayer: castResult.objectLayer,
    effectLayer: castResult.effectLayer,
    moved: moveResult.moved,
    position: moveResult.position,
    defeatedTarget: moveResult.defeatedTarget,
    selfDefeated: false,
    frames
  }
}

function moveCreatureToward(terrainLayer, objectLayer, startX, startY) {
  const creature = objectLayer[startY][startX]
  if (!creature) return { objectLayer, moved: false, defeatedTarget: null, selfDefeated: false, frames: [] }

  const { target, dist } = findNearestPlayerTarget(objectLayer, startX, startY)
  const seekingPlayer = dist <= SIGHT_RANGE

  let wanderTarget = creature.wanderTarget ?? null
  let path = []

  if (seekingPlayer) {
    wanderTarget = null
    path = findPathToNearestGoal({
      terrainLayer,
      objectLayer,
      start: { x: startX, y: startY },
      goals: getAdjacentTiles(target.x, target.y),
      entity: creature.stats
    })
  }

  if (!seekingPlayer || path.length === 0) {
    const reached = wanderTarget && startX === wanderTarget.x && startY === wanderTarget.y

    if (!wanderTarget || reached) {
      wanderTarget = pickWanderTarget(startX, startY, terrainLayer, objectLayer, creature.stats)
    }

    if (wanderTarget) {
      path = findPathToNearestGoal({
        terrainLayer,
        objectLayer,
        start: { x: startX, y: startY },
        goals: [wanderTarget],
        entity: creature.stats,
        forbidLava: true
      })

      if (path.length === 0) wanderTarget = null
    }
  }

  let finalX = startX
  let finalY = startY

  const walkResult = walkPath({
    path,
    ap: creature.ap,
    terrainLayer,
    objectLayer,
    onStep: {
      entity: () => creature.stats,
      move: (layer, step, remainingAp) => {
        const newLayer = layer.map(row => [...row])
        const moving = newLayer[finalY][finalX]
        newLayer[finalY][finalX] = null
        finalX = step.x
        finalY = step.y
        newLayer[finalY][finalX] = { ...moving, x: finalX, y: finalY, ap: remainingAp, wanderTarget }
        return newLayer
      }
    }
  })

  let workingLayer = walkResult.objectLayer
  let ap = walkResult.ap
  let defeatedTarget = null
  const frames = [...walkResult.frames]

  if (!walkResult.moved) {
    const currentCell = workingLayer[finalY][finalX]
    if (currentCell) {
      workingLayer = workingLayer.map(row => [...row])
      workingLayer[finalY][finalX] = { ...currentCell, wanderTarget }
    }
  }

  if (!walkResult.selfDefeated && seekingPlayer) {
    const { target: freshTarget } = findNearestPlayerTarget(workingLayer, finalX, finalY)
    const adjacency = chebyshevDist(finalX, finalY, freshTarget.x, freshTarget.y)

    if (adjacency <= 1 && ap >= ATTACK_AP_COST) {
      const result = resolveAttack({
        objectLayer: workingLayer,
        attackerPos: { x: finalX, y: finalY },
        defenderPos: { x: freshTarget.x, y: freshTarget.y }
      })

      if (!result.blocked) {
        workingLayer = result.objectLayer
        ap -= ATTACK_AP_COST

        const attackerCell = workingLayer[finalY] ? workingLayer[finalY][finalX] : null
        if (attackerCell) {
          workingLayer = workingLayer.map(row => [...row])
          workingLayer[finalY][finalX] = { ...attackerCell, ap, wanderTarget }
        }

        frames.push(workingLayer)
        if (result.defeated) defeatedTarget = result.defenderType
      }
    }
  }

  return {
    objectLayer: workingLayer,
    moved: walkResult.moved,
    defeatedTarget,
    selfDefeated: walkResult.selfDefeated,
    frames
  }
}

export function runEnemyCreaturesAI(terrainLayer, objectLayer) {
  let workingLayer = objectLayer
  const defeatedTargets = []
  const frames = []

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
    frames.push(...result.frames)
    if (result.defeatedTarget) defeatedTargets.push(result.defeatedTarget)
  })

  return {
    objectLayer: workingLayer,
    defeatedTargets, frames
  }
}




// import { ENEMY_WIZARD } from '../data/enemyWizard.js'
// import { ENEMY_SPELLBOOK } from '../data/enemySpellbook.js'
// import { PLAYER } from '../data/player.js'
// import { CREATURES } from '../data/creatures.js'
// import { getMovementCost, MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
// import { wrap, wrappedManhattanDistance } from './utils.js'
// import { castSpell } from './spellCaster.js'
// import { resolveAttack, applyLavaDamage, ATTACK_AP_COST } from './combat.js'
// import { findPathToNearestGoal, getAdjacentTiles } from './pathfinding.js'

// const SIGHT_RANGE = 10
// const WANDER_RADIUS = 10
// const WANDER_ATTEMPTS = 10
// const CAST_CHANCE = 0.5

// function chebyshevDist(ax, ay, bx, by) {
//   return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
// }

// function findNearestPlayerTarget(objectLayer, originX, originY) {
//   let nearest = { x: PLAYER.x, y: PLAYER.y, type: 'player' }
//   let bestDist = wrappedManhattanDistance(originX, originY, PLAYER.x, PLAYER.y, MAP_WIDTH, MAP_HEIGHT)

//   for (let y = 0; y < objectLayer.length; y++) {
//     for (let x = 0; x < objectLayer[y].length; x++) {
//       const cell = objectLayer[y][x]
//       if (cell && cell.type === 'creature' && cell.owner === 'player') {
//         const dist = wrappedManhattanDistance(originX, originY, x, y, MAP_WIDTH, MAP_HEIGHT)
//         if (dist < bestDist) {
//           bestDist = dist
//           nearest = { x, y, type: 'creature' }
//         }
//       }
//     }
//   }

//   return {
//     target: nearest,
//     dist: bestDist
//   }
// }

// function pickWanderTarget(originX, originY, terrainLayer, objectLayer, entity) {
//   for (let i = 0; i < WANDER_ATTEMPTS; i++) {
//     const dx = Math.floor(Math.random() * (WANDER_RADIUS * 2 + 1)) - WANDER_RADIUS
//     const dy = Math.floor(Math.random() * (WANDER_RADIUS * 2 + 1)) - WANDER_RADIUS
//     if (dx === 0 && dy === 0) continue

//     const x = wrap(originX + dx, MAP_WIDTH)
//     const y = wrap(originY + dy, MAP_HEIGHT)

//     if (getMovementCost(terrainLayer[y][x], entity) < 999 && objectLayer[y][x] === null) {
//       return { x, y }
//     }
//   }

//   return null
// }

// function walkPath({ path, ap, terrainLayer, objectLayer, onStep }) {
//   let currentLayer = objectLayer
//   let remainingAp = ap
//   let moved = false
//   let lastPosition = null
//   let selfDefeated = false
//   const frames = []

//   for (const step of path) {
//     if (remainingAp <= 0) break

//     const terrainType = terrainLayer[step.y][step.x]
//     const cost = getMovementCost(terrainType, onStep.entity())

//     if (cost > remainingAp) break
//     if (currentLayer[step.y][step.x] !== null) break 

//     remainingAp -= cost
//     currentLayer = onStep.move(currentLayer, step, remainingAp)
//     moved = true
//     lastPosition = step
//     frames.push(currentLayer)

//     if (terrainType === 'lava') {
//       const lavaResult = applyLavaDamage(currentLayer, step)
//       currentLayer = lavaResult.objectLayer
//       frames.push(currentLayer)
//       if (lavaResult.defeated) {
//         selfDefeated = true
//         break
//       }
//     }
//   }

//   return {
//     objectLayer: currentLayer,
//     ap: remainingAp,
//     moved,
//     lastPosition,
//     selfDefeated,
//     frames
//   }
// }

// function moveEnemyWizard(terrainLayer, objectLayer, portalPosition) {
//   const { target, dist } = findNearestPlayerTarget(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
//   const seekingPlayer = dist <= SIGHT_RANGE
//   const adjacentToPlayerNow = seekingPlayer && chebyshevDist(ENEMY_WIZARD.x, ENEMY_WIZARD.y, target.x, target.y) <= 1
//   const alreadyAtPortal = portalPosition && ENEMY_WIZARD.x === portalPosition.x && ENEMY_WIZARD.y === portalPosition.y

//   let path = []

//   if (portalPosition && !adjacentToPlayerNow && !alreadyAtPortal) {
//     ENEMY_WIZARD.wanderTarget = null
//     path = findPathToNearestGoal({
//       terrainLayer,
//       objectLayer,
//       start: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
//       goals: [portalPosition],
//       entity: ENEMY_WIZARD
//     })
//   }

//   if (path.length === 0 && !alreadyAtPortal && seekingPlayer) {
//     ENEMY_WIZARD.wanderTarget = null
//     path = findPathToNearestGoal({
//       terrainLayer,
//       objectLayer,
//       start: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
//       goals: getAdjacentTiles(target.x, target.y),
//       entity: ENEMY_WIZARD
//     })
//   }

//   if (path.length === 0 && !portalPosition && !alreadyAtPortal) {
//     const reached =
//       ENEMY_WIZARD.wanderTarget &&
//       ENEMY_WIZARD.x === ENEMY_WIZARD.wanderTarget.x &&
//       ENEMY_WIZARD.y === ENEMY_WIZARD.wanderTarget.y

//     if (!ENEMY_WIZARD.wanderTarget || reached) {
//       ENEMY_WIZARD.wanderTarget = pickWanderTarget(ENEMY_WIZARD.x, ENEMY_WIZARD.y, terrainLayer, objectLayer, ENEMY_WIZARD)
//     }

//     if (ENEMY_WIZARD.wanderTarget) {
//       path = findPathToNearestGoal({
//         terrainLayer,
//         objectLayer,
//         start: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
//         goals: [ENEMY_WIZARD.wanderTarget],
//         entity: ENEMY_WIZARD,
//         forbidLava: true
//       })

//       if (path.length === 0) ENEMY_WIZARD.wanderTarget = null
//     }
//   }

//   if (path.length > 0) {
//     console.debug(
//       '[enemy wizard] path:',
//       path.map(p => `${p.x},${p.y} (${terrainLayer[p.y][p.x]})`).join(' -> ')
//     )
//   }

//   const walkResult = walkPath({
//     path,
//     ap: ENEMY_WIZARD.ap,
//     terrainLayer,
//     objectLayer,
//     onStep: {
//       entity: () => ENEMY_WIZARD,
//       move: (layer, step) => {
//         const newLayer = layer.map(row => [...row])
//         newLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = null
//         ENEMY_WIZARD.x = step.x
//         ENEMY_WIZARD.y = step.y
//         newLayer[step.y][step.x] = {
//           type: 'enemyWizard',
//           name: 'Enemy Wizard',
//           owner: 'enemy',
//           ref: ENEMY_WIZARD
//         }
//         return newLayer
//       }
//     }
//   })

//   ENEMY_WIZARD.ap = walkResult.ap

//   let currentLayer = walkResult.objectLayer
//   let defeatedTarget = null
//   const frames = [...walkResult.frames]

//   if (!walkResult.selfDefeated && seekingPlayer) {
//     const { target: freshTarget } = findNearestPlayerTarget(currentLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
//     const adjacency = chebyshevDist(ENEMY_WIZARD.x, ENEMY_WIZARD.y, freshTarget.x, freshTarget.y)

//     if (adjacency <= 1 && ENEMY_WIZARD.ap >= ATTACK_AP_COST) {
//       const result = resolveAttack({
//         objectLayer: currentLayer,
//         attackerPos: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
//         defenderPos: { x: freshTarget.x, y: freshTarget.y }
//       })

//       if (!result.blocked) {
//         currentLayer = result.objectLayer
//         ENEMY_WIZARD.ap -= ATTACK_AP_COST
//         frames.push(currentLayer)
//         if (result.defeated) defeatedTarget = result.defenderType
//       }
//     }
//   }

//   return {
//     objectLayer: currentLayer,
//     moved: walkResult.moved,
//     position: walkResult.lastPosition,
//     defeatedTarget,
//     selfDefeated: walkResult.selfDefeated,
//     frames
//   }
// }

// function isTileFreeForCast(terrainLayer, objectLayer, x, y) {
//   if (y < 0 || y >= terrainLayer.length) return false
//   if (x < 0 || x >= terrainLayer[0].length) return false

//   const terrain = terrainLayer[y][x]
//   const blockedTerrain = ['wall', 'water', 'door', 'mountain', 'lava']
//   if (blockedTerrain.includes(terrain)) return false

//   if (objectLayer[y][x] !== null) return false

//   return true
// }

// function castEnemyWizardSpell(terrainLayer, objectLayer) {
//   const { dist } = findNearestPlayerTarget(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
//   if (dist > SIGHT_RANGE) return { objectLayer, cast: false }
//   if (Math.random() > CAST_CHANCE) return { objectLayer, cast: false }

//   const usableSpells = ENEMY_SPELLBOOK.filter(spell =>
//     spell.currentSpellLevel > 0 &&
//     ENEMY_WIZARD.current_mana >= spell.manaCost * spell.currentSpellLevel
//   )

//   if (usableSpells.length === 0) return { objectLayer, cast: false }

//   const spell = usableSpells[Math.floor(Math.random() * usableSpells.length)]

//   let workingLayer = objectLayer

//   const isTileFree = (tile) => isTileFreeForCast(terrainLayer, workingLayer, tile.x, tile.y)

//   const spawnCreature = (creatureName, tile) => {
//     const creatureData = CREATURES.find(c => c.name === creatureName)
//     workingLayer = workingLayer.map(row => [...row])
//     workingLayer[tile.y][tile.x] = {
//       type: 'creature',
//       owner: 'enemy',
//       name: creatureName,
//       x: tile.x,
//       y: tile.y,
//       ap: creatureData.action_points_ground,
//       current_health: creatureData.constitution,
//       stats: creatureData,
//       wanderTarget: null
//     }
//   }

//   castSpell({
//     spell,
//     casterPos: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
//     isTileFree,
//     spawnCreature
//   })

//   const cost = spell.manaCost * spell.currentSpellLevel
//   ENEMY_WIZARD.current_mana -= cost
//   spell.currentSpellLevel = Math.max(0, spell.currentSpellLevel - 1)

//   return {
//     objectLayer: workingLayer,
//     cast: true
//   }
// }

// export function runEnemyWizardAI(terrainLayer, objectLayer, portalPosition) {
//   const moveResult = moveEnemyWizard(terrainLayer, objectLayer, portalPosition)

//   if (moveResult.selfDefeated) {
//     return {
//       objectLayer: moveResult.objectLayer,
//       moved: moveResult.moved,
//       position: moveResult.position,
//       defeatedTarget: moveResult.defeatedTarget,
//       selfDefeated: true,
//       frames: moveResult.frames
//     }
//   }

//   const castResult = castEnemyWizardSpell(terrainLayer, moveResult.objectLayer)
//   const frames = castResult.cast ? [...moveResult.frames, castResult.objectLayer] : moveResult.frames

//   return {
//     objectLayer: castResult.objectLayer,
//     moved: moveResult.moved,
//     position: moveResult.position,
//     defeatedTarget: moveResult.defeatedTarget,
//     selfDefeated: false,
//     frames
//   }
// }

// function moveCreatureToward(terrainLayer, objectLayer, startX, startY) {
//   const creature = objectLayer[startY][startX]
  
//   if (!creature) return {
//     objectLayer, moved: false,
//     defeatedTarget: null,
//     selfDefeated: false, frames: []
//   }

//   const { target, dist } = findNearestPlayerTarget(objectLayer, startX, startY)
//   const seekingPlayer = dist <= SIGHT_RANGE

//   let wanderTarget = creature.wanderTarget ?? null
//   let path = []

//   if (seekingPlayer) {
//     wanderTarget = null
//     path = findPathToNearestGoal({
//       terrainLayer,
//       objectLayer,
//       start: { x: startX, y: startY },
//       goals: getAdjacentTiles(target.x, target.y),
//       entity: creature.stats
//     })
//   }

//   if (!seekingPlayer || path.length === 0) {
//     const reached = wanderTarget && startX === wanderTarget.x && startY === wanderTarget.y

//     if (!wanderTarget || reached) {
//       wanderTarget = pickWanderTarget(startX, startY, terrainLayer, objectLayer, creature.stats)
//     }

//     if (wanderTarget) {
//       path = findPathToNearestGoal({
//         terrainLayer,
//         objectLayer,
//         start: { x: startX, y: startY },
//         goals: [wanderTarget],
//         entity: creature.stats,
//         forbidLava: true
//       })

//       if (path.length === 0) wanderTarget = null
//     }
//   }

//   let finalX = startX
//   let finalY = startY

//   const walkResult = walkPath({
//     path,
//     ap: creature.ap,
//     terrainLayer,
//     objectLayer,
//     onStep: {
//       entity: () => creature.stats,
//       move: (layer, step, remainingAp) => {
//         const newLayer = layer.map(row => [...row])
//         const moving = newLayer[finalY][finalX]
//         newLayer[finalY][finalX] = null
//         finalX = step.x
//         finalY = step.y
//         newLayer[finalY][finalX] = {
//           ...moving,
//           x: finalX,
//           y: finalY,
//           ap: remainingAp,
//           wanderTarget
//         }
//         return newLayer
//       }
//     }
//   })

//   let workingLayer = walkResult.objectLayer
//   let ap = walkResult.ap
//   let defeatedTarget = null
//   const frames = [...walkResult.frames]

//   if (!walkResult.moved) {
//     const currentCell = workingLayer[finalY][finalX]
//     if (currentCell) {
//       workingLayer = workingLayer.map(row => [...row])
//       workingLayer[finalY][finalX] = { ...currentCell, wanderTarget }
//     }
//   }

//   if (!walkResult.selfDefeated && seekingPlayer) {
//     const { target: freshTarget } = findNearestPlayerTarget(workingLayer, finalX, finalY)
//     const adjacency = chebyshevDist(finalX, finalY, freshTarget.x, freshTarget.y)

//     if (adjacency <= 1 && ap >= ATTACK_AP_COST) {
//       const result = resolveAttack({
//         objectLayer: workingLayer,
//         attackerPos: { x: finalX, y: finalY },
//         defenderPos: { x: freshTarget.x, y: freshTarget.y }
//       })

//       if (!result.blocked) {
//         workingLayer = result.objectLayer
//         ap -= ATTACK_AP_COST

//         const attackerCell = workingLayer[finalY] ? workingLayer[finalY][finalX] : null
//         if (attackerCell) {
//           workingLayer = workingLayer.map(row => [...row])
//           workingLayer[finalY][finalX] = { ...attackerCell, ap, wanderTarget }
//         }

//         frames.push(workingLayer)
//         if (result.defeated) defeatedTarget = result.defenderType
//       }
//     }
//   }

//   return {
//     objectLayer: workingLayer,
//     moved: walkResult.moved,
//     defeatedTarget,
//     selfDefeated: walkResult.selfDefeated,
//     frames
//   }
// }

// export function runEnemyCreaturesAI(terrainLayer, objectLayer) {
//   let workingLayer = objectLayer
//   const defeatedTargets = []
//   const frames = []

//   const startingPositions = []
//   for (let y = 0; y < workingLayer.length; y++) {
//     for (let x = 0; x < workingLayer[y].length; x++) {
//       const cell = workingLayer[y][x]
//       if (cell && cell.type === 'creature' && cell.owner === 'enemy') {
//         startingPositions.push({ x, y })
//       }
//     }
//   }

//   startingPositions.forEach(({ x, y }) => {
//     const result = moveCreatureToward(terrainLayer, workingLayer, x, y)
//     workingLayer = result.objectLayer
//     frames.push(...result.frames)
//     if (result.defeatedTarget) defeatedTargets.push(result.defeatedTarget)
//   })

//   return {
//     objectLayer: workingLayer,
//     defeatedTargets, frames
//   }
// }