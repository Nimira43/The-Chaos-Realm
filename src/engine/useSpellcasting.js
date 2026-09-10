import { CREATURES } from '../data/creatures.js'
import { castSpell, RANGED_SPELL_BASE_RANGE } from './spellCaster.js'
import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrappedChebyshevDistance } from './utils.js'
import {
  isTileIgnitable as checkTileIgnitable,
  isTileSpreadableForBlob as checkTileSpreadableForBlob,
  isTileValidForVineCast as checkTileValidForVineCast,
  createFireEffect,
  createBlobEffect,
  createVineEffect
} from './environmentEffects.js'

export default function useSpellcasting({
  terrainLayer,
  objectLayer,
  effectLayer,
  playerPosition,
  enemyPosition,
  cursor,
  setObjectLayer,
  setEffectLayer,
  PLAYER
}) {

  const isTileFree = (tile) => {
    const { x, y } = tile

    if (y < 0 || y >= terrainLayer.length) return false
    if (x < 0 || x >= terrainLayer[0].length) return false

    const terrain = terrainLayer[y][x]
    const object = objectLayer[y][x]

    const blockedTerrain = ['wall', 'water', 'door', 'mountain']
    if (blockedTerrain.includes(terrain)) return false

    if (object !== null) return false

    if (playerPosition.x === x && playerPosition.y === y) return false
    if (enemyPosition && enemyPosition.x === x && enemyPosition.y === y) return false

    return true
  }

  const isTileIgnitable = (tile) => checkTileIgnitable(terrainLayer, effectLayer, tile.x, tile.y)
  const isTileSpreadableForBlob = (tile) => checkTileSpreadableForBlob(terrainLayer, effectLayer, tile.x, tile.y)
  const isTileValidForVine = (tile) => checkTileValidForVineCast(terrainLayer, effectLayer, tile.x, tile.y)

  const spawnCreature = (creatureName, tile) => {
    const creatureData = CREATURES.find(c => c.name === creatureName)

    setObjectLayer(prev => {
      const copy = prev.map(row => [...row])
      copy[tile.y][tile.x] = {
        type: 'creature',
        owner: 'player',
        name: creatureName,
        x: tile.x,
        y: tile.y,
        ap: creatureData.action_points_ground,
        current_health: creatureData.constitution,
        stats: creatureData
      }
      return copy
    })
  }

  const igniteTile = (tile) => {
    setEffectLayer(prev => {
      const copy = prev.map(row => [...row])
      copy[tile.y][tile.x] = createFireEffect('player')
      return copy
    })
  }

  const spreadBlobTile = (tile) => {
    setEffectLayer(prev => {
      const copy = prev.map(row => [...row])
      copy[tile.y][tile.x] = createBlobEffect('player')
      return copy
    })
  }

  const applyVineToTile = (tile) => {
    setEffectLayer(prev => {
      const copy = prev.map(row => [...row])
      copy[tile.y][tile.x] = createVineEffect('player')
      return copy
    })
  }

  const castSpellForPlayer = (spell) => {
    if (!spell) return

    if (spell.currentSpellLevel <= 0) {
      alert('This spell is exhausted')
      return
    }

    const level = spell.currentSpellLevel
    const cost = spell.manaCost * level

    if (PLAYER.current_mana < cost) {
      alert('Not enough mana')
      return
    }

    if (spell.ranged) {
      const maxRange = RANGED_SPELL_BASE_RANGE + level
      const distance = wrappedChebyshevDistance(playerPosition.x, playerPosition.y, cursor.x, cursor.y, MAP_WIDTH, MAP_HEIGHT)

      if (distance > maxRange) {
        alert('Out of range')
        return
      }
    }

    castSpell({
      spell,
      casterPos: playerPosition,
      aimPos: cursor,
      isTileFree,
      spawnCreature,
      isTileIgnitable,
      igniteTile,
      isTileSpreadableForBlob,
      spreadBlobTile,
      isTileValidForVine,
      applyVineToTile
    })

    PLAYER.current_mana -= cost
    spell.currentSpellLevel = Math.max(0, spell.currentSpellLevel - 1)
  }

  return castSpellForPlayer
}