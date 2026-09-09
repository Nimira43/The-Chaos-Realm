import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap } from './utils.js'
import { NEIGHBOUR_OFFSETS } from './pathfinding.js'
import { applyFireDamage, applyGooeyBlobDamage, GOOEY_BLOB_HEALTH } from './combat.js'

export function withFire(cell, owner) {
  return { ...(cell || {}), fire: { turnsRemaining: FIRE_DURATION_TURNS, owner } }
}

export function withBlob(cell, owner) {
  return { ...(cell || {}), blob: { health: GOOEY_BLOB_HEALTH, owner } }
}

export const FIRE_DURATION_TURNS = 4
export const FIRE_SPREAD_CHANCE = 0.4

const FIRE_UNIGNITABLE_TERRAIN = ['rock', 'swamp', 'water', 'mountain', 'key', 'portal', 'wasteland']

const FIRE_DESTROYS_TERRAIN = ['grass', 'rough', 'forest', 'floor', 'road', 'wall', 'door']

export function isTileIgnitable(terrainLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false

  return !FIRE_UNIGNITABLE_TERRAIN.includes(terrainLayer[y][x])
}

export const GOOEY_SPREAD_CHANCE = 0.4

const GOOEY_UNSPREADABLE_TERRAIN = ['mountain', 'key', 'portal']

const GOOEY_DESTROYS_TERRAIN = ['swamp', 'water', 'forest', 'rough', 'grass', 'floor', 'road', 'wall', 'door', 'rock']

export function isTileSpreadableForBlob(terrainLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false

  return !GOOEY_UNSPREADABLE_TERRAIN.includes(terrainLayer[y][x])
}

const FIRE_RESPECTS_FACTION = true
const GOOEY_RESPECTS_FACTION = true

export function scarTileToWasteland(terrainLayer, x, y, destroysList) {
  const current = terrainLayer[y][x]
  if (current === 'wasteland') return terrainLayer
  if (!destroysList.includes(current)) return terrainLayer

  const newLayer = terrainLayer.map(row => [...row])
  newLayer[y][x] = 'wasteland'
  return newLayer
}

export function scarFireDestroyedTile(terrainLayer, x, y) {
  return scarTileToWasteland(terrainLayer, x, y, FIRE_DESTROYS_TERRAIN)
}

export function scarGooeyDestroyedTile(terrainLayer, x, y) {
  return scarTileToWasteland(terrainLayer, x, y, GOOEY_DESTROYS_TERRAIN)
}

export function tickEnvironmentEffects(terrainLayer, objectLayer, effectLayer) {
  let workingObjects = objectLayer
  const defeatedTargets = []

  for (let y = 0; y < effectLayer.length; y++) {
    for (let x = 0; x < effectLayer[0].length; x++) {
      const fire = effectLayer[y][x]?.fire
      if (!fire) continue

      const occupant = workingObjects[y][x]
      if (FIRE_RESPECTS_FACTION && occupant && occupant.owner === fire.owner) continue

      const result = applyFireDamage(workingObjects, { x, y })
      workingObjects = result.objectLayer
      if (result.defeated && result.targetType) defeatedTargets.push(result.targetType)
    }
  }

  for (let y = 0; y < effectLayer.length; y++) {
    for (let x = 0; x < effectLayer[0].length; x++) {
      const blob = effectLayer[y][x]?.blob
      if (!blob) continue

      const occupant = workingObjects[y][x]
      if (GOOEY_RESPECTS_FACTION && occupant && occupant.owner === blob.owner) continue

      const result = applyGooeyBlobDamage(workingObjects, { x, y })
      workingObjects = result.objectLayer
      if (result.defeated && result.targetType) defeatedTargets.push(result.targetType)
    }
  }

  const fireSpreadTargets = []
  const blobSpreadTargets = []

  for (let y = 0; y < effectLayer.length; y++) {
    for (let x = 0; x < effectLayer[0].length; x++) {
      const cell = effectLayer[y][x]
      if (!cell) continue

      if (cell.fire && Math.random() < FIRE_SPREAD_CHANCE) {
        const candidates = NEIGHBOUR_OFFSETS
          .map(offset => ({ x: wrap(x + offset.x, MAP_WIDTH), y: wrap(y + offset.y, MAP_HEIGHT) }))
          .filter(n => isTileIgnitable(terrainLayer, n.x, n.y) && !effectLayer[n.y][n.x]?.fire)

        if (candidates.length > 0) {
          const chosen = candidates[Math.floor(Math.random() * candidates.length)]
          fireSpreadTargets.push({ ...chosen, owner: cell.fire.owner })
        }
      }

      if (cell.blob && Math.random() < GOOEY_SPREAD_CHANCE) {
        const candidates = NEIGHBOUR_OFFSETS
          .map(offset => ({ x: wrap(x + offset.x, MAP_WIDTH), y: wrap(y + offset.y, MAP_HEIGHT) }))
          .filter(n => isTileSpreadableForBlob(terrainLayer, n.x, n.y) && !effectLayer[n.y][n.x]?.blob)

        if (candidates.length > 0) {
          const chosen = candidates[Math.floor(Math.random() * candidates.length)]
          blobSpreadTargets.push({ ...chosen, owner: cell.blob.owner })
        }
      }
    }
  }

  const newEffectLayer = effectLayer.map(row => [...row])

  fireSpreadTargets.forEach(({ x, y, owner }) => {
    newEffectLayer[y][x] = withFire(newEffectLayer[y][x], owner)
  })

  blobSpreadTargets.forEach(({ x, y, owner }) => {
    newEffectLayer[y][x] = withBlob(newEffectLayer[y][x], owner)
  })

  let newTerrainLayer = terrainLayer 

  for (let y = 0; y < newEffectLayer.length; y++) {
    for (let x = 0; x < newEffectLayer[0].length; x++) {
      const originalFire = effectLayer[y][x]?.fire
      if (!originalFire) continue

      const remaining = originalFire.turnsRemaining - 1
      const cellNow = newEffectLayer[y][x]

      if (remaining > 0) {
        newEffectLayer[y][x] = { ...cellNow, fire: { turnsRemaining: remaining, owner: originalFire.owner } }
      } else {
        const { fire, ...rest } = cellNow
        newEffectLayer[y][x] = Object.keys(rest).length > 0 ? rest : null

        if (newTerrainLayer === terrainLayer) newTerrainLayer = terrainLayer 
        const scarred = scarFireDestroyedTile(newTerrainLayer, x, y)
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