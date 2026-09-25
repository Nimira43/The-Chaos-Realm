import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { ENEMY_SPELLBOOK } from '../data/enemySpellbook.js'
import { CREATURES } from '../data/creatures.js'
import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrappedChebyshevDistance } from './utils.js'
import { castSpell, RANGED_SPELL_BASE_RANGE } from './spellCaster.js'
import { applyMagicDamage } from './combat.js'
import { getAdjacentTiles } from './pathfinding.js'
import { getMaxAp } from './mounts.js'
import { SIGHT_RANGE, findNearestPlayerTarget } from './enemyAIShared.js'
import {
  createFireEffect,
  createBlobEffect,
  createVineEffect,
  createFloodEffect,
  isTileIgnitable as checkTileIgnitable,
  isTileSpreadableForBlob as checkTileSpreadableForBlob,
  isTileValidForVineCast as checkTileValidForVineCast,
  isTileValidForFloodCast as checkTileValidForFloodCast
} from './environmentEffects.js'

const CAST_CHANCE = 0.5

function isTileFreeForCast(terrainLayer, objectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false

  const terrain = terrainLayer[y][x]
  const blockedTerrain = ['wall', 'water', 'mountain', 'lava', 'doorLocked', 'doorUnlocked']
  if (blockedTerrain.includes(terrain)) return false

  if (objectLayer[y][x] !== null) return false

  return true
}

function pickRangedSpellTarget(objectLayer, casterX, casterY, maxRange) {
  const { target } = findNearestPlayerTarget(objectLayer, casterX, casterY)
  const distance = wrappedChebyshevDistance(casterX, casterY, target.x, target.y, MAP_WIDTH, MAP_HEIGHT)

  if (distance <= maxRange) return { x: target.x, y: target.y }
  return null
}

export function castEnemyWizardSpell(terrainLayer, objectLayer, effectLayer) {
  const { dist } = findNearestPlayerTarget(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
  if (dist > SIGHT_RANGE) return { objectLayer, effectLayer, cast: false }

  const adjacentPlayerCount = getAdjacentTiles(ENEMY_WIZARD.x, ENEMY_WIZARD.y)
    .filter(t => {
      const c = objectLayer[t.y]?.[t.x]
      return c && (c.type === 'player' || (c.type === 'creature' && c.owner === 'player'))
    }).length

  const usableSpells = ENEMY_SPELLBOOK.filter(spell => {
    if (spell.currentSpellLevel <= 0) return false
    if (ENEMY_WIZARD.current_mana < spell.manaCost * spell.currentSpellLevel) return false

    if (spell.category === 'creature') {
      return getAdjacentTiles(ENEMY_WIZARD.x, ENEMY_WIZARD.y).some(t => isTileFreeForCast(terrainLayer, objectLayer, t.x, t.y))
    }

    if (spell.ranged) {
      const maxRange = RANGED_SPELL_BASE_RANGE + spell.currentSpellLevel
      return pickRangedSpellTarget(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y, maxRange) !== null
    }

    if (spell.category === 'offensive') {
      return pickRangedSpellTarget(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y, spell.currentSpellLevel) !== null
    }

    return true
  })

  if (usableSpells.length === 0) return { objectLayer, effectLayer, cast: false }

  const offensiveOptions = usableSpells.filter(s => s.category === 'offensive')
  const underThreat = adjacentPlayerCount >= 2 && offensiveOptions.length > 0

  let spell

  if (underThreat) {
    spell = offensiveOptions.find(s => s.name === 'Magic Lightning') || offensiveOptions[0]
    console.debug(`[enemy wizard] under threat (${adjacentPlayerCount} adjacent) — casting ${spell.name}`)
  } else {
    if (Math.random() > CAST_CHANCE) return { objectLayer, effectLayer, cast: false }
    spell = usableSpells[Math.floor(Math.random() * usableSpells.length)]
  }

  let workingLayer = objectLayer
  let workingEffectLayer = effectLayer

  const isTileFree = (tile) => isTileFreeForCast(terrainLayer, workingLayer, tile.x, tile.y)
  const isTileIgnitable = (tile) => checkTileIgnitable(terrainLayer, workingEffectLayer, tile.x, tile.y)
  const isTileSpreadableForBlob = (tile) => checkTileSpreadableForBlob(terrainLayer, workingEffectLayer, tile.x, tile.y)
  const isTileValidForVine = (tile) => checkTileValidForVineCast(terrainLayer, workingEffectLayer, tile.x, tile.y)
  const isTileValidForFlood = (tile) => checkTileValidForFloodCast(terrainLayer, workingEffectLayer, tile.x, tile.y)

  const spawnCreature = (creatureName, tile) => {
    const creatureData = CREATURES.find(c => c.name === creatureName)
    workingLayer = workingLayer.map(row => [...row])
    workingLayer[tile.y][tile.x] = {
      type: 'creature',
      owner: 'enemy',
      name: creatureName,
      x: tile.x,
      y: tile.y,
      ap: getMaxAp(creatureData),
      current_health: creatureData.constitution,
      stats: creatureData,
      wanderTarget: null,
      inventory: []
    }
  }

  const igniteTile = (tile) => {
    workingEffectLayer = workingEffectLayer.map(row => [...row])
    workingEffectLayer[tile.y][tile.x] = createFireEffect('enemy')
  }

  const spreadBlobTile = (tile) => {
    workingEffectLayer = workingEffectLayer.map(row => [...row])
    workingEffectLayer[tile.y][tile.x] = createBlobEffect('enemy')
  }

  const applyVineToTile = (tile) => {
    workingEffectLayer = workingEffectLayer.map(row => [...row])
    workingEffectLayer[tile.y][tile.x] = createVineEffect('enemy')
  }

  const applyFloodToTile = (tile) => {
    workingEffectLayer = workingEffectLayer.map(row => [...row])
    workingEffectLayer[tile.y][tile.x] = createFloodEffect('enemy')
  }

  const zapEffects = []
  const zapTile = (tile, level) => {
    const result = applyMagicDamage(workingLayer, tile, level)
    workingLayer = result.objectLayer
    zapEffects.push({ x: tile.x, y: tile.y })
  }

  let aimPos = null
  if (spell.ranged) {
    const maxRange = RANGED_SPELL_BASE_RANGE + spell.currentSpellLevel
    aimPos = pickRangedSpellTarget(workingLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y, maxRange)
  } else if (spell.category === 'offensive') {
    aimPos = pickRangedSpellTarget(workingLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y, spell.currentSpellLevel)
  }

  castSpell({
    spell,
    casterPos: { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y },
    aimPos,
    isTileFree,
    spawnCreature,
    isTileIgnitable,
    igniteTile,
    isTileSpreadableForBlob,
    spreadBlobTile,
    isTileValidForVine,
    applyVineToTile,
    isTileValidForFlood,
    applyFloodToTile,
    zapTile
  })

  const cost = spell.manaCost * spell.currentSpellLevel
  ENEMY_WIZARD.current_mana -= cost
  spell.currentSpellLevel = Math.max(0, spell.currentSpellLevel - 1)

  return {
    objectLayer: workingLayer,
    effectLayer: workingEffectLayer,
    zapEffects,
    cast: true
  }
}