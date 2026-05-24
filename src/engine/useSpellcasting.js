// src/engine/useSpellcasting.js
import { CREATURES } from '../data/creatures.js'
import { castSpell } from './spellCaster.js'

export default function useSpellcasting({
  terrainLayer,
  objectLayer,
  playerPosition,
  enemyPosition,
  setObjectLayer,
  PLAYER
}) {
  // -----------------------------
  // Helper: is a tile free?
  // -----------------------------
  const isTileFree = (tile) => {
    const { x, y } = tile

    if (y < 0 || y >= terrainLayer.length) return false
    if (x < 0 || x >= terrainLayer[0].length) return false

    const terrain = terrainLayer[y][x]
    const object = objectLayer[y][x]

    const blockedTerrain = ['wall', 'water', 'door']
    if (blockedTerrain.includes(terrain)) return false

    if (object !== null) return false

    if (playerPosition.x === x && playerPosition.y === y) return false
    if (enemyPosition && enemyPosition.x === x && enemyPosition.y === y) return false

    return true
  }

  // -----------------------------
  // Helper: spawn a creature
  // -----------------------------
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
        stats: creatureData
      }
      return copy
    })
  }

  // -----------------------------
  // Main spellcasting function
  // -----------------------------
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

    castSpell({
      spell,
      casterPos: playerPosition,
      isTileFree,
      spawnCreature
    })

    PLAYER.current_mana -= cost
    spell.currentSpellLevel = Math.max(0, spell.currentSpellLevel - 1)
  }

  return castSpellForPlayer
}
