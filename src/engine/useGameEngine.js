import { useState, useRef } from 'react'
import { generateProceduralMap } from './map.js'
import { PLAYER } from '../data/player.js'
import useSpellcasting from './useSpellcasting.js'
import useMapLoader from './useMapLoader.js'
import useInput from './useInput.js'
import useTurnSystem from './useTurnSystem.js'

export default function useGameEngine() {
  const [terrainLayer, setTerrainLayer] = useState(() => generateProceduralMap())

  const [objectLayer, setObjectLayer] = useState(() => {
    const layer = terrainLayer.map(row => row.map(() => null))
    PLAYER.x = 16
    PLAYER.y = 16
    PLAYER.ap = PLAYER.max_ap

    layer[PLAYER.y][PLAYER.x] = {
      type: 'player',
      name: 'Wizard',
      owner: 'player'
    }

    return layer
  })

  const [playerPosition, setPlayerPosition] = useState(() => ({
    x: PLAYER.x,
    y: PLAYER.y
  }))

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
  const [portalStart, setPortalStart] = useState(null)
  const [portalPosition, setPortalPosition] = useState(null)
  const [gameStatus, setGameStatus] = useState('playing') // 'playing' | 'won' | 'lost'
  const [gameOverMessage, setGameOverMessage] = useState('')
  const [isAnimating, setIsAnimating] = useState(false)
  const turnTokenRef = useRef(0)

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
    setObjectLayer,
    setEnemyPosition,
    showLoadModal,
    gameStatus,
    setGameStatus,
    setGameOverMessage,
    isAnimating
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
    setPortalStart,
    setPortalPosition,
    setGameStatus,
    setGameOverMessage,
    setIsAnimating,
    turnTokenRef,
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
      objectLayer[cursor.y][cursor.x]
        ? [objectLayer[cursor.y][cursor.x]]
        : []
  }

  const endTurn = useTurnSystem({
    terrainLayer,
    objectLayer,
    enemyPosition,
    round,
    portalStart,
    portalPosition,
    gameStatus,
    isAnimating,
    setAp,
    setRound,
    setObjectLayer,
    setEnemyPosition,
    setTerrainLayer,
    setPortalPosition,
    setGameStatus,
    setGameOverMessage,
    setIsAnimating,
    turnTokenRef
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
    portalPosition,
    gameStatus,
    gameOverMessage,
    isAnimating,
    castSpellForPlayer,
    setShowLoadModal,
    setMapFilename,
    endTurn,
    restartGame,
    loadMapFromFile
  }
}
