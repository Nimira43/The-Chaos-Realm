import { useEffect, useState } from 'react'
import { generateProceduralMap } from './map.js'
import { PLAYER } from '../data/player.js'
import { tryMove } from './movement.js'
import { wrap } from './utils.js'
import { isTerrain } from './terrain.js'
import { castSpell } from './spellCaster.js'

export function useMapAndPlayer() {
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

  useEffect(() => {
    function handleKey(e) {
      const map = terrainLayer
      if (!map.length) return

      let dx = 0
      let dy = 0

      if (e.key === 'ArrowUp') dy = -1
      else if (e.key === 'ArrowDown') dy = 1
      else if (e.key === 'ArrowLeft') dx = -1
      else if (e.key === 'ArrowRight') dx = 1

      if (e.key === ' ') {
        if (!selected) {
          if (cursor.x === playerPosition.x && cursor.y === playerPosition.y) {
            setSelected({ type: 'player' })
          }
        } else {
          setSelected(null)
        }
        return
      }

      if (!selected) {
        if (dx !== 0 || dy !== 0) {
          setCursor(c => ({
            x: wrap(c.x + dx, map[0].length),
            y: wrap(c.y + dy, map.length)
          }))
        }
        return
      }

      if (selected.type === 'player') {
        if (tryMove(PLAYER, dx, dy, map)) {
          setAp(PLAYER.ap)
          const newPos = { x: PLAYER.x, y: PLAYER.y }
          setCursor(newPos)
          setPlayerPosition(newPos)
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cursor, selected, terrainLayer, playerPosition])

  function endTurn() {
    PLAYER.ap = PLAYER.max_ap
    setAp(PLAYER.ap)
    setRound(prev => prev + 1)
  }

  function restartGame() {
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

  async function loadMapFromFile() {
    try {
      const res = await fetch(`/created-maps/${mapFilename}.json`)
      const data = await res.json()
      loadHandcraftedMap(data)
      setShowLoadModal(false)
    } catch {
      alert('Map not found')
    }
  }

  function loadHandcraftedMap(jsonMap) {
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

  function castSpellForPlayer(spell) {
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

    const isTileFree = tile =>
      tile.y >= 0 &&
      tile.y < objectLayer.length &&
      tile.x >= 0 &&
      tile.x < objectLayer[0].length &&
      objectLayer[tile.y][tile.x] === null

    const spawnCreature = (creatureName, tile) => {
      setObjectLayer(prev => {
        const copy = prev.map(row => [...row])
        copy[tile.y][tile.x] = creatureName
        return copy
      })
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
