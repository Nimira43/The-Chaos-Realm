import { isTerrain } from './terrain.js'
import { generateProceduralMap } from './map.js'
import { PLAYER } from '../data/player.js'
import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { SPELLBOOK, resetSpellbook } from '../data/spellbook.js'
import { ENEMY_SPELLBOOK } from '../data/enemySpellbook.js'

export default function useMapLoader({
  setTerrainLayer,
  setObjectLayer,
  setEffectLayer,
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

    resetSpellbook(SPELLBOOK)
    resetSpellbook(ENEMY_SPELLBOOK)

    PLAYER.x = 16
    PLAYER.y = 16
    PLAYER.ap = PLAYER.max_ap
    PLAYER.current_mana = PLAYER.max_mana
    PLAYER.current_health = PLAYER.constitution

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

    objects[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = {
      type: 'enemyWizard',
      name: 'Enemy Wizard',
      owner: 'enemy',
      ref: ENEMY_WIZARD
    }

    setEnemyPosition({ x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y })

    setObjectLayer(objects)
    setEffectLayer(effects)

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
    let playerStart = null
    let enemyStart = null
    let portalStart = null

    for (let y = 0; y < height; y++) {
      terrain[y] = []
      objects[y] = []
      effects[y] = []

      for (let x = 0; x < width; x++) {
        const tile = jsonMap[y][x]
        effects[y][x] = null

        if (isTerrain(tile)) {
          terrain[y][x] = tile
          objects[y][x] = null
        } else {
          terrain[y][x] = 'grass'
          objects[y][x] = null

          if (tile === 'playerWizard') {
            playerStart = { x, y }
          }

          if (tile === 'enemyWizard') {
            enemyStart = { x, y }
          }

          if (tile === 'portal') {
            portalStart = { x, y }
          }
        }
      }
    }

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

    setObjectLayer(objects)
    setEffectLayer(effects)

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