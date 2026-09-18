import { isTerrain } from './terrain.js'
import { generateProceduralMap } from './map.js'
import { wrap } from './utils.js'
import { PLAYER } from '../data/player.js'
import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { SPELLBOOK, resetSpellbook } from '../data/spellbook.js'
import { ENEMY_SPELLBOOK } from '../data/enemySpellbook.js'
import { createKeyItem, placeRandomApples } from './items.js'

const SPAWN_TERRAIN_EXCLUDED = ['mountain', 'wall', 'lava', 'water', 'doorLocked', 'doorUnlocked']

function inferSpawnTerrain(terrain, x, y, width, height) {
  const tally = {}

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue

      const nx = wrap(x + dx, width)
      const ny = wrap(y + dy, height)
      const neighbourTerrain = terrain[ny][nx]

      if (!neighbourTerrain) continue 
      if (SPAWN_TERRAIN_EXCLUDED.includes(neighbourTerrain)) continue

      tally[neighbourTerrain] = (tally[neighbourTerrain] || 0) + 1
    }
  }

  let best = null
  let bestCount = 0

  for (const [terrainType, count] of Object.entries(tally)) {
    if (count > bestCount) {
      best = terrainType
      bestCount = count
    }
  }

  return best || 'grass'
}

export default function useMapLoader({
  setTerrainLayer,
  setObjectLayer,
  setEffectLayer,
  setItemLayer,
  setPlayerPosition,
  setCursor,
  setEnemyPosition,
  setSelected,
  setAp,
  setRound,
  setPortalStart,
  setPortalPosition,
  setGameStatus,
  setGameOverMessage,
  setIsAnimating,
  turnTokenRef,
  mapFilename
}) {

  const restartGame = () => {
    turnTokenRef.current += 1
    setIsAnimating(false)

    const generated = generateProceduralMap()
    setTerrainLayer(generated)
    const objects = generated.map(row => row.map(() => null))
    const effects = generated.map(row => row.map(() => null))
    let items = generated.map(row => row.map(() => null))

    resetSpellbook(SPELLBOOK)
    resetSpellbook(ENEMY_SPELLBOOK)

    PLAYER.x = 16
    PLAYER.y = 16
    PLAYER.ap = PLAYER.max_ap
    PLAYER.current_mana = PLAYER.max_mana
    PLAYER.current_health = PLAYER.constitution
    PLAYER.floodTrapped = false
    PLAYER.inventory = []

    objects[PLAYER.y][PLAYER.x] = {
      type: 'player',
      name: 'Wizard',
      owner: 'player'
    }

    ENEMY_WIZARD.x = 20
    ENEMY_WIZARD.y = 20
    ENEMY_WIZARD.ap = ENEMY_WIZARD.max_ap
    ENEMY_WIZARD.current_mana = ENEMY_WIZARD.max_mana
    ENEMY_WIZARD.current_health = ENEMY_WIZARD.constitution
    ENEMY_WIZARD.wanderTarget = null
    ENEMY_WIZARD.floodTrapped = false
    ENEMY_WIZARD.inventory = []

    objects[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = {
      type: 'enemyWizard',
      name: 'Enemy Wizard',
      owner: 'enemy',
      ref: ENEMY_WIZARD
    }

    setEnemyPosition({ x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y })

    items = placeRandomApples(generated, objects, items)
    setObjectLayer(objects)
    setEffectLayer(effects)
    setItemLayer(items)

    const start = { x: PLAYER.x, y: PLAYER.y }
    setPlayerPosition(start)
    setCursor(start)
    setSelected(null)
    setAp(PLAYER.ap)
    setRound(1)

    setPortalStart(null)
    setPortalPosition(null)
    setGameStatus('playing')
    setGameOverMessage('')

    try {
      resetSpellbook(SPELLBOOK)
      resetSpellbook(ENEMY_SPELLBOOK)
    } catch (err) {
      console.error('Failed to reset spellbooks on restart:', err)
    }

    console.log('Generated map size:', generated.length, generated[0].length)
    console.log('RESTART GAME CALLED')
  }


  const loadHandcraftedMap = (jsonMap) => {
    turnTokenRef.current += 1
    setIsAnimating(false)

    const height = jsonMap.length
    const width = jsonMap[0].length

    const terrain = []
    const objects = []
    const effects = []
    let items = []
    let playerStart = null
    let enemyStart = null
    let portalStart = null
    const keyPositions = []

    const spawnMarkerPositions = []

    for (let y = 0; y < height; y++) {
      terrain[y] = []
      objects[y] = []
      effects[y] = []
      items[y] = []

      for (let x = 0; x < width; x++) {
        const tile = jsonMap[y][x]
        effects[y][x] = null
        items[y][x] = null

        if (isTerrain(tile)) {
          terrain[y][x] = tile
          objects[y][x] = null
        } else {
          terrain[y][x] = null
          objects[y][x] = null
          spawnMarkerPositions.push({ x, y })

          if (tile === 'playerWizard') {
            playerStart = { x, y }
          }

          if (tile === 'enemyWizard') {
            enemyStart = { x, y }
          }

          if (tile === 'portal') {
            portalStart = { x, y }
          }

          if (tile === 'key') {
            keyPositions.push({ x, y })
          }
        }
      }
    }

    spawnMarkerPositions.forEach(({ x, y }) => {
      terrain[y][x] = inferSpawnTerrain(terrain, x, y, width, height)
    })

    keyPositions.forEach(({ x, y }) => {
      items[y][x] = [createKeyItem()]
    })

    setTerrainLayer(terrain)

    resetSpellbook(SPELLBOOK)
    resetSpellbook(ENEMY_SPELLBOOK)

    const resolvedPlayerStart = playerStart || {
      x: Math.floor(width / 2),
      y: Math.floor(height / 2)
    }

    if (!playerStart) {
      console.warn('No playerWizard tile found in this map — placing the player at the map centre instead.')
    }

    PLAYER.x = resolvedPlayerStart.x
    PLAYER.y = resolvedPlayerStart.y
    PLAYER.ap = PLAYER.max_ap
    PLAYER.current_mana = PLAYER.max_mana
    PLAYER.current_health = PLAYER.constitution
    PLAYER.floodTrapped = false
    PLAYER.inventory = []

    objects[resolvedPlayerStart.y][resolvedPlayerStart.x] = {
      type: 'player',
      name: 'Wizard',
      owner: 'player'
    }

    setPlayerPosition(resolvedPlayerStart)
    setCursor(resolvedPlayerStart)

    if (enemyStart) {
      ENEMY_WIZARD.x = enemyStart.x
      ENEMY_WIZARD.y = enemyStart.y
      ENEMY_WIZARD.ap = ENEMY_WIZARD.max_ap
      ENEMY_WIZARD.current_mana = ENEMY_WIZARD.max_mana
      ENEMY_WIZARD.current_health = ENEMY_WIZARD.constitution
      ENEMY_WIZARD.wanderTarget = null
      ENEMY_WIZARD.floodTrapped = false
      ENEMY_WIZARD.inventory = []

      objects[enemyStart.y][enemyStart.x] = {
        type: 'enemyWizard',
        name: 'Enemy Wizard',
        owner: 'enemy',
        ref: ENEMY_WIZARD
      }

      setEnemyPosition(enemyStart)
    } else {
      setEnemyPosition(null)
    }

    items = placeRandomApples(terrain, objects, items)
    setObjectLayer(objects)
    setEffectLayer(effects)
    setItemLayer(items)

    setAp(PLAYER.ap)
    setRound(1)
    setSelected(null)

    setPortalStart(portalStart)
    setPortalPosition(null)
    setGameStatus('playing')
    setGameOverMessage('')

    try {
      resetSpellbook(SPELLBOOK)
      resetSpellbook(ENEMY_SPELLBOOK)
    } catch (err) {
      console.error('Failed to reset spellbooks on map load:', err)
    }
  }

  const loadMapFromFile = async () => {
    try {
      const res = await fetch(`/created-maps/${mapFilename}.json`)
      const data = await res.json()
      loadHandcraftedMap(data)
    } catch {
      alert('Map not found')
    }
  }

  return {
    restartGame,
    loadMapFromFile,
    loadHandcraftedMap
  }
}