// src/engine/useMapLoader.js
import { isTerrain } from './terrain.js'
import { generateProceduralMap } from './map.js'
import { PLAYER } from '../data/player.js'

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

  // -----------------------------
  // Restart the game (procedural map)
  // -----------------------------
  const restartGame = () => {
    const generated = generateProceduralMap()

    setTerrainLayer(generated)
    setObjectLayer(generated.map(row => row.map(() => null)))

    PLAYER.x = 16
    PLAYER.y = 16
    PLAYER.ap = PLAYER.max_ap

    const start = { x: PLAYER.x, y: PLAYER.y }
    setPlayerPosition(start)
    setCursor(start)
    setSelected(null)
    setAp(PLAYER.ap)
    setRound(1)
  }

  // -----------------------------
  // Load handcrafted map from JSON
  // -----------------------------
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
          objects[y][x] = tile

          if (tile === 'playerWizard') playerStart = { x, y }
          if (tile === 'enemyWizard') enemyStart = { x, y }
        }
      }
    }

    setTerrainLayer(terrain)
    setObjectLayer(objects)

    if (playerStart) {
      PLAYER.x = playerStart.x
      PLAYER.y = playerStart.y
      setPlayerPosition(playerStart)
      setCursor(playerStart)
    }

    if (enemyStart) {
      setEnemyPosition(enemyStart)
    }

    PLAYER.ap = PLAYER.max_ap
    setAp(PLAYER.ap)
    setRound(1)
    setSelected(null)
  }

  // -----------------------------
  // Load map from file
  // -----------------------------
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
