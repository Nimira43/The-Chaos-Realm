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
  setAp,
  setObjectLayer
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
          // Select player
          if (cursor.x === playerPosition.x && cursor.y === playerPosition.y) {
            setSelected({ type: 'player' })
            return
          }

          // Select creature
          const obj = objectLayer[cursor.y][cursor.x]
          if (obj && obj.type === 'creature' && obj.owner === 'player') {
            setSelected({ type: 'creature', x: cursor.x, y: cursor.y })
            return
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
        return
      }

      // -----------------------------
      // Creature movement
      // -----------------------------
      if (selected.type === 'creature') {
        const { x, y } = selected
        const creature = objectLayer[y][x]

        if (!creature) {
          setSelected(null)
          return
        }

        if (creature.ap <= 0) {
          console.log('Creature has no AP left')
          return
        }

        if (dx !== 0 || dy !== 0) {
          const newX = wrap(x + dx, map[0].length)
          const newY = wrap(y + dy, map.length)

          const terrain = terrainLayer[newY][newX]
          const blockedTerrain = ['wall', 'water', 'door']
          if (blockedTerrain.includes(terrain)) return

          if (objectLayer[newY][newX] !== null) return

          // Move creature
          setObjectLayer(prev => {
            const copy = prev.map(row => [...row])
            copy[y][x] = null
            copy[newY][newX] = {
              ...creature,
              x: newX,
              y: newY,
              ap: creature.ap - 1
            }
            return copy
          })

          setCursor({ x: newX, y: newY })
          setSelected({ type: 'creature', x: newX, y: newY })
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
    setAp,
    setObjectLayer
  ])
}
