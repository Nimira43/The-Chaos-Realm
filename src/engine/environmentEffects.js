import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap } from './utils.js'
import { NEIGHBOUR_OFFSETS } from './pathfinding.js'
import { applyFireDamage, applyGooeyBlobDamage, GOOEY_BLOB_HEALTH } from './combat.js'

export const FIRE_DURATION_TURNS = 4
export const FIRE_SPREAD_CHANCE = 0.4
export const GOOEY_DURATION_TURNS = 4 
export const GOOEY_SPREAD_CHANCE = 0.4

export function createFireEffect(owner) {
  return {
    type: 'fire',
    turnsRemaining: FIRE_DURATION_TURNS,
    owner
  }
}

export function createBlobEffect(owner) {
  return {
    type: 'blob',
    turnsRemaining: GOOEY_DURATION_TURNS,
    health: GOOEY_BLOB_HEALTH,
    owner
  }
}

const FIRE_UNIGNITABLE_TERRAIN = ['rock', 'swamp', 'water', 'mountain', 'key', 'portal', 'wasteland']
const FIRE_DESTROYS_TERRAIN = ['grass', 'rough', 'forest', 'floor', 'road', 'wall', 'door']
const GOOEY_UNSPREADABLE_TERRAIN = ['mountain', 'key', 'portal', 'wasteland']
const GOOEY_DESTROYS_TERRAIN = ['swamp', 'water', 'forest', 'rough', 'grass', 'floor', 'road', 'wall', 'door', 'rock']
const FIRE_RESPECTS_FACTION = true
const GOOEY_RESPECTS_FACTION = true

export function isTileIgnitable(terrainLayer, effectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false
  if (effectLayer[y][x] !== null) return false

  return !FIRE_UNIGNITABLE_TERRAIN.includes(terrainLayer[y][x])
}

export function isTileSpreadableForBlob(terrainLayer, effectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false
  if (effectLayer[y][x] !== null) return false

  return !GOOEY_UNSPREADABLE_TERRAIN.includes(terrainLayer[y][x])
}

export function isFireBlocking(effectLayer, x, y) {
  return effectLayer[y]?.[x]?.type === 'fire'
}

function scarTileToWasteland(terrainLayer, x, y, destroysList) {
  const current = terrainLayer[y][x]
  if (current === 'wasteland') return terrainLayer
  if (!destroysList.includes(current)) return terrainLayer

  const newLayer = terrainLayer.map(row => [...row])
  newLayer[y][x] = 'wasteland'
  return newLayer
}

export function scarGooeyDestroyedTile(terrainLayer, x, y) {
  return scarTileToWasteland(terrainLayer, x, y, GOOEY_DESTROYS_TERRAIN)
}

export function tickEnvironmentEffects(terrainLayer, objectLayer, effectLayer) {
  let workingObjects = objectLayer
  const defeatedTargets = []

  for (let y = 0; y < effectLayer.length; y++) {
    for (let x = 0; x < effectLayer[0].length; x++) {
      const effect = effectLayer[y][x]
      if (!effect) continue

      const occupant = workingObjects[y][x]
      const respectsFaction = effect.type === 'fire' ? FIRE_RESPECTS_FACTION : GOOEY_RESPECTS_FACTION
      if (respectsFaction && occupant && occupant.owner === effect.owner) continue

      const damageFn = effect.type === 'fire' ? applyFireDamage : applyGooeyBlobDamage
      const result = damageFn(workingObjects, { x, y })
      workingObjects = result.objectLayer
      if (result.defeated && result.targetType) defeatedTargets.push(result.targetType)
    }
  }

  const fireSpreadTargets = []
  const blobSpreadTargets = []

  for (let y = 0; y < effectLayer.length; y++) {
    for (let x = 0; x < effectLayer[0].length; x++) {
      const effect = effectLayer[y][x]
      if (!effect) continue

      const spreadChance = effect.type === 'fire' ? FIRE_SPREAD_CHANCE : GOOEY_SPREAD_CHANCE
      if (Math.random() >= spreadChance) continue

      const isEligible = effect.type === 'fire'
        ? (n) => isTileIgnitable(terrainLayer, effectLayer, n.x, n.y)
        : (n) => isTileSpreadableForBlob(terrainLayer, effectLayer, n.x, n.y)

      const candidates = NEIGHBOUR_OFFSETS
        .map(offset => ({ x: wrap(x + offset.x, MAP_WIDTH), y: wrap(y + offset.y, MAP_HEIGHT) }))
        .filter(isEligible)

      if (candidates.length === 0) continue

      const chosen = candidates[Math.floor(Math.random() * candidates.length)]
      const target = { ...chosen, owner: effect.owner }

      if (effect.type === 'fire') fireSpreadTargets.push(target)
      else blobSpreadTargets.push(target)
    }
  }

  const newEffectLayer = effectLayer.map(row => [...row])

  fireSpreadTargets.forEach(({ x, y, owner }) => {
    if (newEffectLayer[y][x] === null) newEffectLayer[y][x] = createFireEffect(owner)
  })

  blobSpreadTargets.forEach(({ x, y, owner }) => {
    if (newEffectLayer[y][x] === null) newEffectLayer[y][x] = createBlobEffect(owner)
  })

  let newTerrainLayer = terrainLayer

  for (let y = 0; y < newEffectLayer.length; y++) {
    for (let x = 0; x < newEffectLayer[0].length; x++) {
      const original = effectLayer[y][x]
      if (!original) continue

      const remaining = original.turnsRemaining - 1

      if (remaining > 0) {
        newEffectLayer[y][x] = { ...original, turnsRemaining: remaining }
      } else {
        newEffectLayer[y][x] = null

        const destroysList = original.type === 'fire' ? FIRE_DESTROYS_TERRAIN : GOOEY_DESTROYS_TERRAIN
        const scarred = scarTileToWasteland(newTerrainLayer, x, y, destroysList)
        if (scarred !== newTerrainLayer) newTerrainLayer = scarred
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