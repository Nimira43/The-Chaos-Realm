import { useEffect } from 'react'
import { wrap } from './utils.js'
import { tryMove } from './movement.js'
import { PLAYER } from '../data/player.js'
import { getMovementCost } from './terrain.js'
import { resolveAttack, applyLavaDamage, ATTACK_AP_COST } from './combat.js'

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
  setObjectLayer,
  setEnemyPosition,
  showLoadModal
}) {

  useEffect(() => {
    function handleKey(e) {
      if (showLoadModal) return

      const active = document.activeElement
      const isTyping =
        active &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')

      if (isTyping) return

      const map = terrainLayer
      if (!map.length) return

      let dx = 0
      let dy = 0

      const isGameKey =
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === ' '

      if (isGameKey) e.preventDefault()

      if (e.key === 'ArrowUp') dy = -1
      else if (e.key === 'ArrowDown') dy = 1
      else if (e.key === 'ArrowLeft') dx = -1
      else if (e.key === 'ArrowRight') dx = 1

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

      if (!selected) {
        if (dx || dy) {
          setCursor(c => ({
            x: wrap(c.x + dx, map[0].length),
            y: wrap(c.y + dy, map.length)
          }))
        }
        return
      }

      if (selected.type === 'player') {
        if (dx || dy) {
          const newX = wrap(PLAYER.x + dx, map[0].length)
          const newY = wrap(PLAYER.y + dy, map.length)

          const occupant = objectLayer[newY][newX]

          if (occupant !== null) {
            if (occupant.owner === 'enemy') {
              if (PLAYER.ap < ATTACK_AP_COST) return

              const result = resolveAttack({
                objectLayer,
                attackerPos: { x: PLAYER.x, y: PLAYER.y },
                defenderPos: { x: newX, y: newY }
              })

              PLAYER.ap -= ATTACK_AP_COST
              setAp(PLAYER.ap)
              setObjectLayer(result.objectLayer)

              if (result.defeated && result.defenderType === 'enemyWizard') {
                setEnemyPosition(null)
              }
            } else {
              console.log("Player cannot move onto an occupied tile")
            }
            return
          }

          const moved = tryMove(PLAYER, dx, dy, map)
          if (moved) {
            const newPos = { x: PLAYER.x, y: PLAYER.y }

            setObjectLayer(prev => {
              let copy = prev.map(row => [...row])
              copy[playerPosition.y][playerPosition.x] = null
              copy[newPos.y][newPos.x] = {
                type: 'player',
                name: 'Wizard',
                owner: 'player'
              }

              if (terrainLayer[newPos.y][newPos.x] === 'lava') {
                const lavaResult = applyLavaDamage(copy, newPos)
                copy = lavaResult.objectLayer
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

          const occupant = objectLayer[newY][newX]

          if (occupant !== null) {
            if (occupant.owner === 'enemy') {
              if (creature.ap < ATTACK_AP_COST) return

              const result = resolveAttack({
                objectLayer,
                attackerPos: { x, y },
                defenderPos: { x: newX, y: newY }
              })

              let updatedLayer = result.objectLayer
              const attackerCellNow = updatedLayer[y][x]

              if (attackerCellNow) {
                updatedLayer = updatedLayer.map(row => [...row])
                updatedLayer[y][x] = { ...attackerCellNow, ap: attackerCellNow.ap - ATTACK_AP_COST }
              }

              setObjectLayer(updatedLayer)

              if (result.defeated && result.defenderType === 'enemyWizard') {
                setEnemyPosition(null)
              }
            }
            return
          }

          const terrainType = terrainLayer[newY][newX]
          const cost = getMovementCost(terrainType, creature.stats)

          if (cost >= 999) return
          if (creature.ap < cost) return

          let updatedLayer = objectLayer.map(row => [...row])
          updatedLayer[y][x] = null
          updatedLayer[newY][newX] = {
            ...creature,
            x: newX,
            y: newY,
            ap: creature.ap - cost
          }

          let defeated = false

          if (terrainType === 'lava') {
            const lavaResult = applyLavaDamage(updatedLayer, { x: newX, y: newY })
            updatedLayer = lavaResult.objectLayer
            defeated = lavaResult.defeated
          }

          setObjectLayer(updatedLayer)

          if (defeated) {
            setSelected(null)
          } else {
            setCursor({ x: newX, y: newY })
            setSelected({ type: 'creature', x: newX, y: newY })
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
    setAp,
    setObjectLayer,
    setEnemyPosition,
    showLoadModal
  ])
}