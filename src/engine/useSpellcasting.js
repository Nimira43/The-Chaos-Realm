import { CREATURES } from '../data/creatures.js'
import { castSpell, RANGED_SPELL_BASE_RANGE, HEALING_RANGE } from './spellCaster.js'
import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrappedChebyshevDistance, getAreaTiles } from './utils.js'
import { getMaxAp } from './mounts.js'
import { applyMagicDamage } from './combat.js'
import {
  isTileIgnitable as checkTileIgnitable,
  isTileSpreadableForBlob as checkTileSpreadableForBlob,
  isTileValidForVineCast as checkTileValidForVineCast,
  isTileValidForFloodCast as checkTileValidForFloodCast,
  createFireEffect,
  createBlobEffect,
  createVineEffect,
  createFloodEffect
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
  setZapEffects,
  PLAYER
}) {

  const isTileFree = (tile) => {
    const { x, y } = tile

    if (y < 0 || y >= terrainLayer.length) return false
    if (x < 0 || x >= terrainLayer[0].length) return false

    const terrain = terrainLayer[y][x]
    const object = objectLayer[y][x]

    const blockedTerrain = ['wall', 'water', 'mountain', 'doorLocked', 'doorUnlocked']
    if (blockedTerrain.includes(terrain)) return false

    if (object !== null) return false

    if (playerPosition.x === x && playerPosition.y === y) return false
    if (enemyPosition && enemyPosition.x === x && enemyPosition.y === y) return false

    return true
  }

  const isTileIgnitable = (tile) => checkTileIgnitable(terrainLayer, effectLayer, tile.x, tile.y)
  const isTileSpreadableForBlob = (tile) => checkTileSpreadableForBlob(terrainLayer, effectLayer, tile.x, tile.y)
  const isTileValidForVine = (tile) => checkTileValidForVineCast(terrainLayer, effectLayer, tile.x, tile.y)
  const isTileValidForFlood = (tile) => checkTileValidForFloodCast(terrainLayer, effectLayer, tile.x, tile.y)

  const isTileValidForHeal = (tile) => {
    const { x, y } = tile
    if (y < 0 || y >= objectLayer.length) return false
    if (x < 0 || x >= objectLayer[0].length) return false

    const occupant = objectLayer[y][x]
    if (!occupant) return false

    return occupant.type === 'player' || (occupant.type === 'creature' && occupant.owner === 'player')
  }

  const healTile = (tile) => {
    const occupant = objectLayer[tile.y][tile.x]
    if (!occupant) return

    if (occupant.type === 'player') {
      PLAYER.current_health = PLAYER.constitution
    }

    if (occupant.type === 'creature' || occupant.mount) {
      setObjectLayer(prev => {
        const copy = prev.map(row => [...row])
        let cell = copy[tile.y][tile.x]
        if (cell.type === 'creature') {
          cell = { ...cell, current_health: cell.stats.constitution }
        }
        if (cell.mount) {
          cell = { ...cell, mount: { ...cell.mount, current_health: cell.mount.stats.constitution } }
        }
        copy[tile.y][tile.x] = cell
        return copy
      })
    }
  }

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
        ap: getMaxAp(creatureData),
        current_health: creatureData.constitution,
        stats: creatureData,
        inventory: []
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

  const applyFloodToTile = (tile) => {
    setEffectLayer(prev => {
      const copy = prev.map(row => [...row])
      copy[tile.y][tile.x] = createFloodEffect('player')
      return copy
    })
  }

  const zapTile = (tile, level) => {
    setObjectLayer(prev => {
      const result = applyMagicDamage(prev, tile, level)
      return result.objectLayer
    })

    setZapEffects(prev => [
      ...prev.filter(z => z.until > Date.now()),
      { x: tile.x, y: tile.y, until: Date.now() + 500 }
    ])
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

    if (spell.healing) {
      const distance = wrappedChebyshevDistance(playerPosition.x, playerPosition.y, cursor.x, cursor.y, MAP_WIDTH, MAP_HEIGHT)

      if (distance > HEALING_RANGE || !isTileValidForHeal(cursor)) {
        alert('Select yourself or an adjacent creature to heal')
        return
      }
    }

    if (spell.category === 'offensive') {
      const maxRange = level
      const distance = wrappedChebyshevDistance(playerPosition.x, playerPosition.y, cursor.x, cursor.y, MAP_WIDTH, MAP_HEIGHT)

      if (distance > maxRange) {
        alert('Out of range')
        return
      }

      const affectedTiles = spell.name === 'Magic Lightning'
        ? getAreaTiles(cursor.x, cursor.y, 1, MAP_WIDTH, MAP_HEIGHT)
        : [cursor]

      const hasTarget = affectedTiles.some(t => objectLayer[t.y]?.[t.x])
      if (!hasTarget) {
        alert('No target in range')
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
      applyVineToTile,
      isTileValidForFlood,
      applyFloodToTile,
      isTileValidForHeal,
      healTile,
      zapTile
    })

    PLAYER.current_mana -= cost
    spell.currentSpellLevel = Math.max(0, spell.currentSpellLevel - 1)
  }

  return castSpellForPlayer
}