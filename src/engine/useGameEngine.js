import { useState } from 'react'
import { generateProceduralMap } from './map.js'
import { PLAYER } from '../data/player.js'
import useSpellcasting from './useSpellcasting.js'
import useMapLoader from './useMapLoader.js'
import useInput from './useInput.js'
import useTurnSystem from './useTurnSystem.js'

export default function useGameEngine() {

  const [terrainLayer, setTerrainLayer] = useState(() => generateProceduralMap())

  const [objectLayer, setObjectLayer] = useState(() =>
    terrainLayer.map(row => row.map(() => null))
  )

  const [playerPosition, setPlayerPosition] = useState(() => {
    PLAYER.x = 16
    PLAYER.y = 16
    PLAYER.ap = PLAYER.max_ap
    return { x: PLAYER.x, y: PLAYER.y }
  })

  const [enemyPosition, setEnemyPosition] = useState(null)

  const [cursor, setCursor] = useState(() => ({
    x: PLAYER.x,
    y: PLAYER.y
  }))

  const [selected, setSelected] = useState(null)
  const [ap, setAp] = useState(PLAYER.ap)
  const [round, setRound] = useState(1)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [mapFilename, setMapFilename] = useState('')

  useInput({
    cursor,
    selected,
    terrainLayer,
    objectLayer,
    playerPosition,
    enemyPosition,
    setCursor,
    setSelected,
    setPlayerPosition,
    setAp,
    setObjectLayer
  })

  const {
    restartGame,
    loadMapFromFile,
  } = useMapLoader({
    setTerrainLayer,
    setObjectLayer,
    setPlayerPosition,
    setCursor,
    setEnemyPosition,
    setSelected,
    setAp,
    setRound,
    mapFilename
  })

  const castSpellForPlayer = useSpellcasting({
    terrainLayer,
    objectLayer,
    playerPosition,
    enemyPosition,
    setObjectLayer,
    PLAYER
  })

  const info = {
    terrain:
      terrainLayer.length
        ? terrainLayer[cursor.y][cursor.x]
        : 'grass',

    occupiers:
      playerPosition &&
        cursor.x === playerPosition.x &&
        cursor.y === playerPosition.y
        ? [{ type: 'player', owner: 'us' }]
        : []
  }

  const endTurn = useTurnSystem({
    setAp,
    setRound,
    setObjectLayer
  })

  return {
    ap,
    round,
    terrainLayer,
    objectLayer,
    cursor,
    selected,
    playerPosition,
    enemyPosition,
    info,
    showLoadModal,
    mapFilename,
    castSpellForPlayer,
    setShowLoadModal,
    setMapFilename,
    endTurn,
    restartGame,
    loadMapFromFile
  }
}
