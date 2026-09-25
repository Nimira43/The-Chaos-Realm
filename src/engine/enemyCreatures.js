import { resolveAttack, ATTACK_AP_COST } from './combat.js'
import { findPathToNearestGoal, getAdjacentTiles } from './pathfinding.js'
import { getMoverStats, getMoverAp, withMoverAp, RIDE_AP_COST } from './mounts.js'
import {
  SIGHT_RANGE,
  chebyshevDist,
  findNearestPlayerTarget,
  pickWanderTarget,
  walkPath,
  tryRideAdjacentMount
} from './enemyAIShared.js'

function moveCreatureToward(terrainLayer, objectLayer, startX, startY, effectLayer) {
  let creature = objectLayer[startY][startX]

  if (!creature) return {
    objectLayer, moved: false,
    defeatedTarget: null,
    selfDefeated: false,
    finalPosition: null,
    frames: []
  }

  const initialFrames = []

  const ridden = tryRideAdjacentMount(objectLayer, terrainLayer, startX, startY, creature.owner, creature.stats, creature.ap)
  if (ridden) {
    objectLayer = ridden.map(row => [...row])
    creature = { ...objectLayer[startY][startX], ap: creature.ap - RIDE_AP_COST }
    objectLayer[startY][startX] = creature
    initialFrames.push(objectLayer)
  }

  const moverStats = getMoverStats(creature, creature.stats)

  const { target, dist } = findNearestPlayerTarget(objectLayer, startX, startY)
  const seekingPlayer = dist <= SIGHT_RANGE

  let wanderTarget = creature.wanderTarget ?? null
  let path = []

  if (seekingPlayer) {
    wanderTarget = null
    path = findPathToNearestGoal({
      terrainLayer, objectLayer, effectLayer,
      start: { x: startX, y: startY },
      goals: getAdjacentTiles(target.x, target.y),
      entity: moverStats
    })
  }

  if (!seekingPlayer || path.length === 0) {
    const reached = wanderTarget && startX === wanderTarget.x && startY === wanderTarget.y

    if (!wanderTarget || reached) {
      wanderTarget = pickWanderTarget(startX, startY, terrainLayer, objectLayer, moverStats)
    }

    if (wanderTarget) {
      path = findPathToNearestGoal({
        terrainLayer, objectLayer, effectLayer,
        start: { x: startX, y: startY },
        goals: [wanderTarget],
        entity: moverStats,
        forbidLava: true
      })

      if (path.length === 0) wanderTarget = null
    }
  }

  let finalX = startX
  let finalY = startY

  const walkResult = walkPath({
    path,
    ap: getMoverAp(creature, creature.ap),
    terrainLayer,
    objectLayer,
    onStep: {
      entity: () => moverStats,
      move: (layer, step, remainingAp) => {
        const newLayer = layer.map(row => [...row])
        const moving = newLayer[finalY][finalX]
        newLayer[finalY][finalX] = null
        finalX = step.x
        finalY = step.y
        newLayer[finalY][finalX] = { ...withMoverAp(moving, remainingAp), x: finalX, y: finalY, wanderTarget }
        return newLayer
      }
    }
  })

  let workingLayer = walkResult.objectLayer
  let defeatedTarget = null
  const frames = [...initialFrames, ...walkResult.frames]

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
    const attackerBefore = workingLayer[finalY][finalX]
    const ap = attackerBefore ? getMoverAp(attackerBefore, attackerBefore.ap) : 0

    if (adjacency <= 1 && ap >= ATTACK_AP_COST) {
      const result = resolveAttack({
        objectLayer: workingLayer,
        attackerPos: { x: finalX, y: finalY },
        defenderPos: { x: freshTarget.x, y: freshTarget.y }
      })

      if (!result.blocked) {
        workingLayer = result.objectLayer

        const attackerCell = workingLayer[finalY] ? workingLayer[finalY][finalX] : null
        if (attackerCell) {
          workingLayer = workingLayer.map(row => [...row])
          workingLayer[finalY][finalX] = { ...withMoverAp(attackerCell, ap - ATTACK_AP_COST), wanderTarget }
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
    finalPosition: walkResult.selfDefeated ? null : { x: finalX, y: finalY },
    frames
  }
}

export function runEnemyCreaturesAI(terrainLayer, objectLayer, effectLayer) {
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

  const finishedAt = new Set()

  startingPositions.forEach(({ x, y }) => {
    if (finishedAt.has(`${x},${y}`)) return

    const result = moveCreatureToward(terrainLayer, workingLayer, x, y, effectLayer)
    workingLayer = result.objectLayer
    frames.push(...result.frames)
    if (result.defeatedTarget) defeatedTargets.push(result.defeatedTarget)
    if (result.finalPosition) finishedAt.add(`${result.finalPosition.x},${result.finalPosition.y}`)
  })

  return {
    objectLayer: workingLayer,
    defeatedTargets, frames
  }
}