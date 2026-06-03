import { useEffect } from 'react'
import { wrap } from './utils.js'
import { tryMove } from './movement.js'
import { PLAYER } from '../data/player.js'
import { terrainCost } from './terrain.js'

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

      // SPACE — selection logic

      if (e.key === ' ') {
        if (!selected) {
          const obj = objectLayer[cursor.y][cursor.x]

          if (obj?.type === 'player') {
            setSelected({ type: 'player' })
            return
          }

          if (obj?.type === 'creature' && obj.owner === 'player') {
            setSelected({ type: 'creature', x: cursor.x, y: cursor.y })
            return
          }
        } else {
          setSelected(null)
        }
        return
      }

      // Cursor movement (no selection)

      if (!selected) {
        if (dx || dy) {
          setCursor(c => ({
            x: wrap(c.x + dx, map[0].length),
            y: wrap(c.y + dy, map.length)
          }))
        }
        return
      }

      // PLAYER MOVEMENT

      if (selected.type === 'player') {
        if (dx || dy) {
          const newX = wrap(PLAYER.x + dx, map[0].length)
          const newY = wrap(PLAYER.y + dy, map.length)

          // BLOCK movement if tile is occupied
          if (objectLayer[newY][newX] !== null) {
            console.log("Player cannot move onto an occupied tile")
            return
          }

          const moved = tryMove(PLAYER, dx, dy, map)
          if (moved) {
            const newPos = { x: PLAYER.x, y: PLAYER.y }

            setObjectLayer(prev => {
              const copy = prev.map(row => [...row])
              copy[playerPosition.y][playerPosition.x] = null
              copy[newPos.y][newPos.x] = {
                type: 'player',
                name: 'Wizard',
                owner: 'player'
              }
              return copy
            })

            setAp(PLAYER.ap)
            setCursor(newPos)
            setPlayerPosition(newPos)
          }
        }
        return
      }

      // CREATURE MOVEMENT

      if (selected.type === 'creature') {
        const { x, y } = selected
        const creature = objectLayer[y][x]
        if (!creature) {
          setSelected(null)
          return
        }

        if (dx || dy) {
          const newX = wrap(x + dx, map[0].length)
          const newY = wrap(y + dy, map.length)

          const terrainType = terrainLayer[newY][newX]
          const cost = terrainCost[terrainType] ?? 1

          if (cost >= 999) return
          if (objectLayer[newY][newX] !== null) return
          if (creature.ap < cost) return

          setObjectLayer(prev => {
            const copy = prev.map(row => [...row])
            copy[y][x] = null
            copy[newY][newX] = {
              ...creature,
              x: newX,
              y: newY,
              ap: creature.ap - cost
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

