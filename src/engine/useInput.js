// src/engine/useInput.js
import { useEffect } from 'react'
import { wrap } from './utils.js'
import { tryMove } from './movement.js'
import { PLAYER } from '../data/player.js'

export default function useInput({
  cursor,
  selected,
  terrainLayer,
  objectLayer,
  playerPosition,
  enemyPosition,
  setCursor,
  setSelected,
  setPlayerPosition,
  setAp
}) {

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

      // -----------------------------
      // SPACE — selection logic
      // -----------------------------
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

      // -----------------------------
      // Cursor movement (no selection)
      // -----------------------------
      if (!selected) {
        if (dx !== 0 || dy !== 0) {
          setCursor(c => ({
            x: wrap(c.x + dx, map[0].length),
            y: wrap(c.y + dy, map.length)
          }))
        }
        return
      }

      // -----------------------------
      // Player movement
      // -----------------------------
      if (selected.type === 'player') {
        if (dx !== 0 || dy !== 0) {
          const moved = tryMove(PLAYER, dx, dy, map)
          if (moved) {
            setAp(PLAYER.ap)
            const newPos = { x: PLAYER.x, y: PLAYER.y }
            setCursor(newPos)
            setPlayerPosition(newPos)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [
    cursor,
    selected,
    terrainLayer,
    objectLayer,
    playerPosition,
    enemyPosition,
    setCursor,
    setSelected,
    setPlayerPosition,
    setAp
  ])
}
