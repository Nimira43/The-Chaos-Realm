import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap } from './utils.js'
import { NEIGHBOUR_OFFSETS } from './pathfinding.js'
import { applyFireDamage } from './combat.js'

export const FIRE_DURATION_TURNS = 4
export const FIRE_SPREAD_CHANCE = 0.4

const UNIGNITABLE_TERRAIN = ['rock', 'swamp', 'water', 'mountain', 'door', 'key', 'portal', 'wasteland']
const TERRAIN_IMMUNE_TO_SCARRING = ['lava']

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
      const fire = effectLayer[y][x]
      if (fire?.type !== 'fire') continue

      const occupant = workingObjects[y][x]
      if (occupant && occupant.owner === fire.owner) continue // friendly — immune

      const result = applyFireDamage(workingObjects, { x, y })
      workingObjects = result.objectLayer
      if (result.defeated && result.targetType) {
        defeatedTargets.push(result.targetType)
      }
    }
  }

  const spreadTargets = []

  for (let y = 0; y < effectLayer.length; y++) {
    for (let x = 0; x < effectLayer[0].length; x++) {
      const fire = effectLayer[y][x]
      if (fire?.type === 'fire' && Math.random() < FIRE_SPREAD_CHANCE) {
        const candidates = NEIGHBOUR_OFFSETS
          .map(offset => ({ x: wrap(x + offset.x, MAP_WIDTH), y: wrap(y + offset.y, MAP_HEIGHT) }))
          .filter(n => isTileIgnitable(terrainLayer, n.x, n.y) && effectLayer[n.y][n.x]?.type !== 'fire')

        if (candidates.length > 0) {
          const chosen = candidates[Math.floor(Math.random() * candidates.length)]
          spreadTargets.push({ ...chosen, owner: fire.owner })
        }
      }
    }
  }

  const newEffectLayer = effectLayer.map(row => [...row])

  spreadTargets.forEach(({ x, y, owner }) => {
    newEffectLayer[y][x] = { type: 'fire', turnsRemaining: FIRE_DURATION_TURNS, owner }
  })

  let newTerrainLayer = terrainLayer 

  for (let y = 0; y < newEffectLayer.length; y++) {
    for (let x = 0; x < newEffectLayer[0].length; x++) {
      if (effectLayer[y][x]?.type === 'fire') {
        const remaining = effectLayer[y][x].turnsRemaining - 1

        if (remaining > 0) {
          newEffectLayer[y][x] = { type: 'fire', turnsRemaining: remaining, owner: effectLayer[y][x].owner }
        } else {
          newEffectLayer[y][x] = null

          const currentTerrain = terrainLayer[y][x]
          if (!TERRAIN_IMMUNE_TO_SCARRING.includes(currentTerrain) && currentTerrain !== 'wasteland') {
            if (newTerrainLayer === terrainLayer) {
              newTerrainLayer = terrainLayer.map(row => [...row])
            }
            newTerrainLayer[y][x] = 'wasteland'
          }
        }
      }
    }
  }

  return {
    objectLayer: workingObjects,
    effectLayer: newEffectLayer,
    terrainLayer: newTerrainLayer,
    defeatedTargets
  }
}