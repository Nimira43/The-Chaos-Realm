import { PLAYER } from '../data/player.js'
import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { MAP_WIDTH, MAP_HEIGHT, getMovementCost } from './terrain.js'
import { wrap } from './utils.js'
import { NEIGHBOUR_OFFSETS } from './pathfinding.js'
import { applyFireDamage, applyGooeyBlobDamage, applyTangleVineDamage, GOOEY_BLOB_HEALTH, TANGLE_VINE_HEALTH } from './combat.js'

// ---------------------------------------------------------------------------
// A tile's effect layer entry is either null, or a SINGLE effect object:
//   { type: 'fire',  turnsRemaining, owner }
//   { type: 'blob',  turnsRemaining, health, owner }
//   { type: 'vine',  health, owner }                 <- permanent
//   { type: 'flood', owner }                          <- permanent, no damage
// Only one effect per tile, ever. The four-way cycle:
//   Vine destroys Blob -> Blob destroys Flood -> Flood destroys Fire -> Fire destroys Vine
// with each effect neutral to the one two steps away (Vine<->Flood, Blob<->Fire).
// ---------------------------------------------------------------------------

export const WALL_EFFECT_TYPES = ['fire', 'blob', 'vine', 'flood']
export const ATTACKABLE_EFFECT_TYPES = ['blob', 'vine'] // Fire and Flood cannot be conventionally destroyed

// Whether this tile blocks movement outright — a wall to everyone, EXCEPT
// Flood specifically lets water_type entities pass through untouched.
export function isEnvironmentEffectBlocking(effectLayer, x, y, entity) {
  const type = effectLayer?.[y]?.[x]?.type
  if (!WALL_EFFECT_TYPES.includes(type)) return false
  if (type === 'flood' && entity?.water_type) return false
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

const FIRE_UNIGNITABLE_TERRAIN = ['rock', 'swamp', 'water', 'mountain', 'key', 'portal', 'wasteland']
const FIRE_DESTROYS_TERRAIN = ['grass', 'rough', 'forest', 'floor', 'road', 'wall', 'door']

const GOOEY_UNSPREADABLE_TERRAIN = ['mountain', 'key', 'portal', 'wasteland']
const GOOEY_DESTROYS_TERRAIN = ['swamp', 'water', 'forest', 'rough', 'grass', 'floor', 'road', 'wall', 'door', 'rock']

const TANGLE_UNCASTABLE_TERRAIN = ['mountain', 'portal', 'key']
const TANGLE_DESTROYS_TERRAIN = ['grass', 'rough', 'forest', 'floor', 'road', 'wall', 'door', 'rock', 'swamp']

// Deliberately does NOT protect 'key' — per design, a flooded key is lost.
const FLOOD_UNCASTABLE_TERRAIN = ['mountain', 'portal', 'lava']

export function isTileIgnitable(terrainLayer, effectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false
  if (effectLayer[y][x] !== null) return false

  return !FIRE_UNIGNITABLE_TERRAIN.includes(terrainLayer[y][x])
}

// Fire's SPREAD is additionally allowed onto a Vine tile — Fire destroys Vine.
function isFireSpreadTarget(terrainLayer, effectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false
  if (FIRE_UNIGNITABLE_TERRAIN.includes(terrainLayer[y][x])) return false

  const existing = effectLayer[y][x]
  return existing === null || existing.type === 'vine'
}

// Blob's spread AND cast (same eligibility function serves both) can land
// on an empty tile OR a Flood tile — Blob destroys Flood.
export function isTileSpreadableForBlob(terrainLayer, effectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false
  if (GOOEY_UNSPREADABLE_TERRAIN.includes(terrainLayer[y][x])) return false

  const existing = effectLayer[y][x]
  return existing === null || existing.type === 'flood'
}

// Tangle Vine's cast: empty tile OR an existing Blob tile — Vine destroys
// Blob. CORRECTED from an earlier version that mistakenly let Vine overwrite
// anything except Fire — that would have let it wrongly consume Flood too,
// which the cycle requires to be neutral to Vine.
export function isTileValidForVineCast(terrainLayer, effectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false
  if (TANGLE_UNCASTABLE_TERRAIN.includes(terrainLayer[y][x])) return false

  const existing = effectLayer[y][x]
  return existing === null || existing.type === 'blob'
}

// Flood's cast: empty tile OR an existing Fire tile — Flood destroys Fire.
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

// Used by combat.js when a Blob/Vine tile is destroyed by direct attack.
// Flood is never passed here — it isn't in ATTACKABLE_EFFECT_TYPES.
export function scarWallEffectDestroyedTile(terrainLayer, x, y, effectType) {
  const destroysList = effectType === 'vine' ? TANGLE_DESTROYS_TERRAIN : GOOEY_DESTROYS_TERRAIN
  return scarTileToWasteland(terrainLayer, x, y, destroysList)
}

// Fire and Blob respect the caster's own side. Tangle Vine and Flood do not
// — Vine damages everyone including its own caster (hence the range
// requirement), and Flood deals no periodic damage to anyone at all, so
// this flag is moot for it either way.
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

// Whether this entity has at least one legal tile to step onto right now —
// empty, not blocked by any wall effect (for THIS entity — water_type units
// pass through Flood fine), and passable terrain.
function hasEscapeRoute(terrainLayer, objectLayer, effectLayer, x, y, entity) {
  return getNeighbourTiles(x, y).some(n => {
    if (objectLayer[n.y][n.x] !== null) return false
    if (isEnvironmentEffectBlocking(effectLayer, n.x, n.y, entity)) return false
    return getMovementCost(terrainLayer[n.y][n.x], entity) < 999
  })
}

// Drowning pass: anyone adjacent to Flood with NO escape route gets flagged.
// If they're STILL trapped on the very next tick, they drown. Escaping in
// between (e.g. Gooey Blob clearing a path) clears the flag and saves them.
// NOTE: the Sea Wolf mount rescue described in design isn't functional yet
// — mounting itself doesn't exist as a system. Once it does, a mounted
// water-type escape will be recognised automatically by hasEscapeRoute
// above, with no changes needed here.
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

      const trapped = isAdjacentToFlood(effectLayer, x, y) && !hasEscapeRoute(terrainLayer, workingObjects, effectLayer, x, y, entity)

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

  // 1. Damage — Fire, Blob, and Vine only. Flood deals none.
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

  // 2. Spread — Fire and Blob only. Vine and Flood never spread.
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

  // 3. Decay — only effects that carry a turnsRemaining (Fire, Blob). Vine
  // and Flood have none and are skipped entirely — permanent until destroyed.
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

  // 4. Drowning — anyone trapped by Flood with no escape route, two ticks running.
  const drownResult = applyFloodDrowning(newTerrainLayer, workingObjects, newEffectLayer)
  workingObjects = drownResult.objectLayer
  defeatedTargets.push(...drownResult.defeatedTargets)

  return {
    objectLayer: workingObjects,
    effectLayer: newEffectLayer,
    terrainLayer: newTerrainLayer, defeatedTargets
  }
}
