import { PLAYER } from '../data/player.js'
import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { MAP_WIDTH, MAP_HEIGHT, getMovementCost } from './terrain.js'
import { wrap } from './utils.js'
import { NEIGHBOUR_OFFSETS } from './pathfinding.js'
import { getMoverStats } from './mounts.js'
import { applyFireDamage, applyGooeyBlobDamage, applyTangleVineDamage, GOOEY_BLOB_HEALTH, TANGLE_VINE_HEALTH } from './combat.js'

export const WALL_EFFECT_TYPES = ['fire', 'blob', 'vine', 'flood']
export const ATTACKABLE_EFFECT_TYPES = ['blob', 'vine'] // Fire and Flood cannot be conventionally destroyed

export function isEnvironmentEffectBlocking(effectLayer, x, y, entity) {
  const type = effectLayer?.[y]?.[x]?.type
  if (!WALL_EFFECT_TYPES.includes(type)) return false
  if (type === 'flood' && (entity?.water_type || entity?.isFlyingNow)) return false
  return true
}

export const FIRE_DURATION_TURNS = 4
export const FIRE_SPREAD_CHANCE = 0.4
export const GOOEY_DURATION_TURNS = 4
export const GOOEY_SPREAD_CHANCE = 0.4

export function createFireEffect(owner) {
  return { type: 'fire', turnsRemaining: FIRE_DURATION_TURNS, owner }
}

export function createBlobEffect(owner) {
  return { type: 'blob', turnsRemaining: GOOEY_DURATION_TURNS, health: GOOEY_BLOB_HEALTH, owner }
}

export function createVineEffect(owner) {
  return { type: 'vine', health: TANGLE_VINE_HEALTH, owner } // no turnsRemaining — permanent
}

export function createFloodEffect(owner) {
  return { type: 'flood', owner } // no turnsRemaining, no health — permanent, undestroyable by attack
}

const FIRE_UNIGNITABLE_TERRAIN = ['rock', 'swamp', 'water', 'mountain', 'portal', 'wasteland']
const FIRE_DESTROYS_TERRAIN = ['grass', 'rough', 'forest', 'floor', 'road', 'wall', 'doorLocked', 'doorUnlocked', 'doorOpen']

const GOOEY_UNSPREADABLE_TERRAIN = ['mountain', 'portal', 'wasteland']
const GOOEY_DESTROYS_TERRAIN = ['swamp', 'water', 'forest', 'rough', 'grass', 'floor', 'road', 'doorLocked', 'doorUnlocked', 'doorOpen', 'rock']

const TANGLE_UNCASTABLE_TERRAIN = ['mountain', 'portal']
const TANGLE_DESTROYS_TERRAIN = ['grass', 'rough', 'forest', 'floor', 'road', 'doorLocked', 'doorUnlocked', 'doorOpen', 'rock', 'swamp']

const FLOOD_UNCASTABLE_TERRAIN = ['mountain', 'portal', 'lava']

export function isTileIgnitable(terrainLayer, effectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false
  if (effectLayer[y][x] !== null) return false

  return !FIRE_UNIGNITABLE_TERRAIN.includes(terrainLayer[y][x])
}

function isFireSpreadTarget(terrainLayer, effectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false
  if (FIRE_UNIGNITABLE_TERRAIN.includes(terrainLayer[y][x])) return false

  const existing = effectLayer[y][x]
  return existing === null || existing.type === 'vine'
}

export function isTileSpreadableForBlob(terrainLayer, effectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false
  if (GOOEY_UNSPREADABLE_TERRAIN.includes(terrainLayer[y][x])) return false

  const existing = effectLayer[y][x]
  return existing === null || existing.type === 'flood'
}

export function isTileValidForVineCast(terrainLayer, effectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false
  if (TANGLE_UNCASTABLE_TERRAIN.includes(terrainLayer[y][x])) return false

  const existing = effectLayer[y][x]
  return existing === null || existing.type === 'blob'
}

export function isTileValidForFloodCast(terrainLayer, effectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false
  if (FLOOD_UNCASTABLE_TERRAIN.includes(terrainLayer[y][x])) return false

  const existing = effectLayer[y][x]
  return existing === null || existing.type === 'fire'
}

function scarTileToWasteland(terrainLayer, x, y, destroysList) {
  const current = terrainLayer[y][x]
  if (current === 'wasteland') return terrainLayer
  if (!destroysList.includes(current)) return terrainLayer

  const newLayer = terrainLayer.map(row => [...row])
  newLayer[y][x] = 'wasteland'
  return newLayer
}

export function scarWallEffectDestroyedTile(terrainLayer, x, y, effectType) {
  const destroysList = effectType === 'vine' ? TANGLE_DESTROYS_TERRAIN : GOOEY_DESTROYS_TERRAIN
  return scarTileToWasteland(terrainLayer, x, y, destroysList)
}

const RESPECTS_FACTION = { fire: true, blob: true, vine: false, flood: false }

function getNeighbourTiles(x, y) {
  return NEIGHBOUR_OFFSETS.map(offset => ({
    x: wrap(x + offset.x, MAP_WIDTH),
    y: wrap(y + offset.y, MAP_HEIGHT)
  }))
}

function isAdjacentToFlood(effectLayer, x, y) {
  return getNeighbourTiles(x, y).some(n => effectLayer[n.y][n.x]?.type === 'flood')
}

function hasEscapeRoute(terrainLayer, objectLayer, effectLayer, x, y, entity) {
  return getNeighbourTiles(x, y).some(n => {
    if (objectLayer[n.y][n.x] !== null) return false
    if (isEnvironmentEffectBlocking(effectLayer, n.x, n.y, entity)) return false
    return getMovementCost(terrainLayer[n.y][n.x], entity) < 999
  })
}

function applyFloodDrowning(terrainLayer, objectLayer, effectLayer) {
  let workingObjects = objectLayer
  const defeatedTargets = []

  for (let y = 0; y < workingObjects.length; y++) {
    for (let x = 0; x < workingObjects[0].length; x++) {
      const cell = workingObjects[y][x]
      if (!cell) continue

      let entity, targetType, getFlag, setFlag

      if (cell.type === 'player') {
        entity = PLAYER
        targetType = 'player'
        getFlag = () => PLAYER.floodTrapped
        setFlag = (v) => { PLAYER.floodTrapped = v }
      } else if (cell.type === 'enemyWizard') {
        entity = cell.ref
        targetType = 'enemyWizard'
        getFlag = () => cell.ref.floodTrapped
        setFlag = (v) => { cell.ref.floodTrapped = v }
      } else if (cell.type === 'creature') {
        entity = cell.stats
        targetType = 'creature'
        getFlag = () => cell.floodTrapped
        setFlag = (v) => {
          workingObjects = workingObjects.map(row => [...row])
          const current = workingObjects[y][x]
          if (current) workingObjects[y][x] = { ...current, floodTrapped: v }
        }
      } else {
        continue
      }

      const moverStats = getMoverStats(cell, entity)
      const trapped = isAdjacentToFlood(effectLayer, x, y) && !hasEscapeRoute(terrainLayer, workingObjects, effectLayer, x, y, moverStats)

      if (trapped) {
        if (getFlag()) {
          workingObjects = workingObjects.map(row => [...row])
          workingObjects[y][x] = null
          defeatedTargets.push(targetType)
        } else {
          setFlag(true)
        }
      } else if (getFlag()) {
        setFlag(false)
      }
    }
  }

  return {
    objectLayer: workingObjects,
    defeatedTargets
  }
}

export function tickEnvironmentEffects(terrainLayer, objectLayer, effectLayer) {
  let workingObjects = objectLayer
  const defeatedTargets = []

  for (let y = 0; y < effectLayer.length; y++) {
    for (let x = 0; x < effectLayer[0].length; x++) {
      const effect = effectLayer[y][x]
      if (!effect || effect.type === 'flood') continue

      const occupant = workingObjects[y][x]
      if (RESPECTS_FACTION[effect.type] && occupant && occupant.owner === effect.owner) continue

      const damageFn =
        effect.type === 'fire' ? applyFireDamage :
        effect.type === 'blob' ? applyGooeyBlobDamage :
        applyTangleVineDamage

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
      if (!effect || effect.type === 'vine' || effect.type === 'flood') continue

      const spreadChance = effect.type === 'fire' ? FIRE_SPREAD_CHANCE : GOOEY_SPREAD_CHANCE
      if (Math.random() >= spreadChance) continue

      const isEligible = effect.type === 'fire'
        ? (n) => isFireSpreadTarget(terrainLayer, effectLayer, n.x, n.y)
        : (n) => isTileSpreadableForBlob(terrainLayer, effectLayer, n.x, n.y)

      const candidates = getNeighbourTiles(x, y).filter(isEligible)
      if (candidates.length === 0) continue

      const chosen = candidates[Math.floor(Math.random() * candidates.length)]
      const target = { ...chosen, owner: effect.owner }

      if (effect.type === 'fire') fireSpreadTargets.push(target)
      else blobSpreadTargets.push(target)
    }
  }

  const newEffectLayer = effectLayer.map(row => [...row])

  fireSpreadTargets.forEach(({ x, y, owner }) => { newEffectLayer[y][x] = createFireEffect(owner) })
  blobSpreadTargets.forEach(({ x, y, owner }) => { newEffectLayer[y][x] = createBlobEffect(owner) })

  let newTerrainLayer = terrainLayer

  for (let y = 0; y < newEffectLayer.length; y++) {
    for (let x = 0; x < newEffectLayer[0].length; x++) {
      const original = effectLayer[y][x]
      if (!original || original.turnsRemaining === undefined) continue

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

  const drownResult = applyFloodDrowning(newTerrainLayer, workingObjects, newEffectLayer)
  workingObjects = drownResult.objectLayer
  defeatedTargets.push(...drownResult.defeatedTargets)

  return {
    objectLayer: workingObjects,
    effectLayer: newEffectLayer,
    terrainLayer: newTerrainLayer, defeatedTargets
  }
}
