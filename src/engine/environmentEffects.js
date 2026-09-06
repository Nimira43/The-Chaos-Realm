import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap } from './utils.js'
import { NEIGHBOUR_OFFSETS } from './pathfinding.js'
import { applyFireDamage } from './combat.js'

export const FIRE_DURATION_TURNS = 4
export const FIRE_SPREAD_CHANCE = 0.4

const UNIGNITABLE_TERRAIN = ['wall', 'water', 'door', 'mountain']

export function isTileIgnitable(terrainLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false

  return !UNIGNITABLE_TERRAIN.includes(terrainLayer[y][x])
}

export function tickFireEffects(terrainLayer, objectLayer, effectLayer) {
  let workingObjects = objectLayer
  const defeatedTargets = []

  for (let y = 0; y < effectLayer.length; y++) {
    for (let x = 0; x < effectLayer[0].length; x++) {
      if (effectLayer[y][x]?.type === 'fire') {
        const result = applyFireDamage(workingObjects, { x, y })
        workingObjects = result.objectLayer
        if (result.defeated && result.targetType) {
          defeatedTargets.push(result.targetType)
        }
      }
    }
  }

  const spreadTargets = []

  for (let y = 0; y < effectLayer.length; y++) {
    for (let x = 0; x < effectLayer[0].length; x++) {
      if (effectLayer[y][x]?.type === 'fire' && Math.random() < FIRE_SPREAD_CHANCE) {
        const candidates = NEIGHBOUR_OFFSETS
          .map(offset => ({ x: wrap(x + offset.x, MAP_WIDTH), y: wrap(y + offset.y, MAP_HEIGHT) }))
          .filter(n => isTileIgnitable(terrainLayer, n.x, n.y) && effectLayer[n.y][n.x]?.type !== 'fire')

        if (candidates.length > 0) {
          spreadTargets.push(candidates[Math.floor(Math.random() * candidates.length)])
        }
      }
    }
  }

  const newEffectLayer = effectLayer.map(row => [...row])

  spreadTargets.forEach(({ x, y }) => {
    newEffectLayer[y][x] = { type: 'fire', turnsRemaining: FIRE_DURATION_TURNS }
  })

  for (let y = 0; y < newEffectLayer.length; y++) {
    for (let x = 0; x < newEffectLayer[0].length; x++) {
      if (effectLayer[y][x]?.type === 'fire') {
        const remaining = effectLayer[y][x].turnsRemaining - 1
        newEffectLayer[y][x] = remaining > 0 ? { type: 'fire', turnsRemaining: remaining } : null
      }
    }
  }

  return {
    objectLayer: workingObjects,
    effectLayer: newEffectLayer,
    defeatedTargets
  }
}