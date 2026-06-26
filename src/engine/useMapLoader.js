import { isTerrain } from './terrain.js'
import { generateProceduralMap } from './map.js'
import { PLAYER } from '../data/player.js'
import { ENEMY_WIZARD } from '../data/enemyWizard.js'

export default function useMapLoader({
  setTerrainLayer,
  setObjectLayer,
  setPlayerPosition,
  setCursor,
  setEnemyPosition,
  setSelected,
  setAp,
  setRound,
  mapFilename
}) {

  const restartGame = () => {
    const generated = generateProceduralMap()
    setTerrainLayer(generated)
    const objects = generated.map(row => row.map(() => null))

    // Place player wizard
    PLAYER.x = 16
    PLAYER.y = 16
    PLAYER.ap = PLAYER.max_ap

    objects[PLAYER.y][PLAYER.x] = {
      type: 'player',
      name: 'Wizard',
      owner: 'player'
    }

    // Place enemy wizard
    ENEMY_WIZARD.x = 20
    ENEMY_WIZARD.y = 20
    ENEMY_WIZARD.ap = ENEMY_WIZARD.max_ap

    objects[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = {
      type: 'enemyWizard',
      name: 'Enemy Wizard',
      owner: 'enemy',
      ref: ENEMY_WIZARD
    }

    setEnemyPosition({ x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y })

    // Finalise
    setObjectLayer(objects)

    const start = { x: PLAYER.x, y: PLAYER.y }
    setPlayerPosition(start)
    setCursor(start)
    setSelected(null)
    setAp(PLAYER.ap)
    setRound(1)

    console.log('Generated map size:', generated.length, generated[0].length)
    console.log('RESTART GAME CALLED')
  }


  // Load handcrafted map from JSON
  const loadHandcraftedMap = (jsonMap) => {
    const terrain = []
    const objects = []
    let playerStart = null
    let enemyStart = null

    for (let y = 0; y < 32; y++) {
      terrain[y] = []
      objects[y] = []

      for (let x = 0; x < 32; x++) {
        const tile = jsonMap[y][x]

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
        }
      }
    }

    // Apply terrain
    setTerrainLayer(terrain)

    // Insert objects (player + enemy)
    if (playerStart) {
      PLAYER.x = playerStart.x
      PLAYER.y = playerStart.y

      objects[playerStart.y][playerStart.x] = {
        type: 'player',
        name: 'Wizard',
        owner: 'player'
      }

      setPlayerPosition(playerStart)
      setCursor(playerStart)
    }

    if (enemyStart) {
      ENEMY_WIZARD.x = enemyStart.x
      ENEMY_WIZARD.y = enemyStart.y

      objects[enemyStart.y][enemyStart.x] = {
        type: 'enemyWizard',
        name: 'Enemy Wizard',
        owner: 'enemy',
        ref: ENEMY_WIZARD
      }

      setEnemyPosition(enemyStart)
    }

    setObjectLayer(objects)

    PLAYER.ap = PLAYER.max_ap
    setAp(PLAYER.ap)
    setRound(1)
    setSelected(null)
  }

  // Load map from file
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

