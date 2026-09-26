import { useEffect } from 'react'
import { wrap } from './utils.js'
import { tryMove } from './movement.js'
import { PLAYER } from '../data/player.js'
import { getMovementCost, IMPASSABLE_THRESHOLD } from './terrain.js'
import { resolveAttack, applyLavaDamage, resolveWallEffectAttack, ATTACK_AP_COST } from './combat.js'
import { isEnvironmentEffectBlocking, ATTACKABLE_EFFECT_TYPES } from './environmentEffects.js'
import { isMounted, getMoverStats, getMoverAp, withMoverAp } from './mounts.js'

export default function useInput({
  cursor,
  selected,
  terrainLayer,
  objectLayer,
  effectLayer,
  playerPosition,
  enemyPosition,
  setCursor,
  setSelected,
  setPlayerPosition,
  setAp,
  setObjectLayer,
  setEffectLayer,
  setEnemyPosition,
  setTerrainLayer,
  showLoadModal,
  gameStatus,
  setGameStatus,
  setGameOverMessage,
  isAnimating
}) {

  useEffect(() => {
    function handleKey(e) {
      if (showLoadModal) return
      if (gameStatus !== 'playing') return
      if (isAnimating) return

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

          const playerCell = objectLayer[PLAYER.y][PLAYER.x]
          const mounted = isMounted(playerCell)
          const moverStats = getMoverStats(playerCell, PLAYER)
          const moverAp = getMoverAp(playerCell, PLAYER.ap)

          const spendPlayerAttackAp = (layer) => {
            if (!mounted) {
              PLAYER.ap -= ATTACK_AP_COST
              setAp(PLAYER.ap)
              return layer
            }

            const cell = layer[PLAYER.y][PLAYER.x]
            if (!cell?.mount) return layer
            const copy = layer.map(row => [...row])
            copy[PLAYER.y][PLAYER.x] = withMoverAp(cell, cell.mount.ap - ATTACK_AP_COST)
            return copy
          }

          if (isEnvironmentEffectBlocking(effectLayer, newX, newY, moverStats)) {
            const occupant = objectLayer[newY][newX]

            if (occupant !== null) {
              if (occupant.owner === 'enemy') {
                if (moverAp < ATTACK_AP_COST) return

                const result = resolveAttack({
                  objectLayer,
                  attackerPos: { x: PLAYER.x, y: PLAYER.y },
                  defenderPos: { x: newX, y: newY }
                })

                if (result.blocked) {
                  console.log(
                    result.blockedReason === 'target-airborne'
                      ? 'Out of reach — that target is flying!'
                      : 'Normal attacks cannot harm the undead!'
                  )
                  return
                }

                setObjectLayer(spendPlayerAttackAp(result.objectLayer))

                if (result.defeated && result.defenderType === 'enemyWizard') {
                  setEnemyPosition(null)
                }
              } else {
                console.log('Cannot move onto an occupied tile')
              }
              return
            }

            const effectType = effectLayer[newY][newX].type

            if (ATTACKABLE_EFFECT_TYPES.includes(effectType)) {
              if (moverAp < ATTACK_AP_COST) return

              const result = resolveWallEffectAttack({
                effectLayer,
                terrainLayer,
                attackerCombat: moverStats.combat,
                pos: { x: newX, y: newY }
              })

              const spentLayer = spendPlayerAttackAp(objectLayer)
              if (spentLayer !== objectLayer) setObjectLayer(spentLayer)
              setEffectLayer(result.effectLayer)

              if (result.destroyed) {
                setTerrainLayer(result.terrainLayer)
              }
            } else {
              console.log(`${effectType} blocks the way!`)
            }
            return
          }

          const occupant = objectLayer[newY][newX]

          if (occupant !== null) {
            if (occupant.owner === 'enemy') {
              if (moverAp < ATTACK_AP_COST) return

              const result = resolveAttack({
                objectLayer,
                attackerPos: { x: PLAYER.x, y: PLAYER.y },
                defenderPos: { x: newX, y: newY }
              })

              if (result.blocked) {
                console.log(
                  result.blockedReason === 'target-airborne'
                    ? 'Out of reach — that target is flying!'
                    : 'Normal attacks cannot harm the undead!'
                )
                return
              }

              setObjectLayer(spendPlayerAttackAp(result.objectLayer))

              if (result.defeated && result.defenderType === 'enemyWizard') {
                setEnemyPosition(null)
              }
            } else {
              console.log("Player cannot move onto an occupied tile")
            }
            return
          }

          let moved = false
          let mountApAfterMove = moverAp

          if (mounted) {
            const cost = getMovementCost(map[newY][newX], moverStats)
            if (cost < IMPASSABLE_THRESHOLD && moverAp >= cost) {
              PLAYER.x = newX
              PLAYER.y = newY
              mountApAfterMove = moverAp - cost
              moved = true
            }
          } else {
            moved = tryMove(PLAYER, dx, dy, map)
          }

          if (moved) {
            const newPos = { x: PLAYER.x, y: PLAYER.y }

            setObjectLayer(prev => {
              let copy = prev.map(row => [...row])
              const movingCell = copy[playerPosition.y][playerPosition.x]
              copy[playerPosition.y][playerPosition.x] = null
              copy[newPos.y][newPos.x] = mounted
                ? withMoverAp(movingCell, mountApAfterMove)
                : {
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

            if (terrainLayer[newPos.y][newPos.x] === 'portal') {
              setGameStatus('won')
              setGameOverMessage('You reached the portal! Victory!')
            }
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

        const moverStats = getMoverStats(creature, creature.stats)
        const moverAp = getMoverAp(creature, creature.ap)

        if (dx || dy) {
          const newX = wrap(x + dx, map[0].length)
          const newY = wrap(y + dy, map.length)

          if (isEnvironmentEffectBlocking(effectLayer, newX, newY, moverStats)) {
            const occupant = objectLayer[newY][newX]

            if (occupant !== null) {
              if (occupant.owner === 'enemy') {
                if (moverAp < ATTACK_AP_COST) return

                const result = resolveAttack({
                  objectLayer,
                  attackerPos: { x, y },
                  defenderPos: { x: newX, y: newY }
                })

                if (result.blocked) {
                  console.log(
                    result.blockedReason === 'target-airborne'
                      ? `${creature.name} can't reach that target — it's flying!`
                      : `${creature.name} cannot harm the undead with a normal attack!`
                  )
                  return
                }

                let updatedLayer = result.objectLayer
                const attackerCellNow = updatedLayer[y][x]

                if (attackerCellNow) {
                  updatedLayer = updatedLayer.map(row => [...row])
                  updatedLayer[y][x] = withMoverAp(attackerCellNow, getMoverAp(attackerCellNow, attackerCellNow.ap) - ATTACK_AP_COST)
                }

                setObjectLayer(updatedLayer)

                if (result.defeated && result.defenderType === 'enemyWizard') {
                  setEnemyPosition(null)
                }
              }
              return
            }

            const effectType = effectLayer[newY][newX].type

            if (ATTACKABLE_EFFECT_TYPES.includes(effectType)) {
              if (moverAp < ATTACK_AP_COST) return

              const result = resolveWallEffectAttack({
                effectLayer,
                terrainLayer,
                attackerCombat: moverStats.combat,
                pos: { x: newX, y: newY }
              })

              setObjectLayer(prev => {
                const copy = prev.map(row => [...row])
                copy[y][x] = withMoverAp(creature, moverAp - ATTACK_AP_COST)
                return copy
              })

              setEffectLayer(result.effectLayer)

              if (result.destroyed) {
                setTerrainLayer(result.terrainLayer)
              }
            }
            return
          }

          const occupant = objectLayer[newY][newX]

          if (occupant !== null) {
            if (occupant.owner === 'enemy') {
              if (moverAp < ATTACK_AP_COST) return

              const result = resolveAttack({
                objectLayer,
                attackerPos: { x, y },
                defenderPos: { x: newX, y: newY }
              })

              if (result.blocked) {
                console.log(
                  result.blockedReason === 'target-airborne'
                    ? `${creature.name} can't reach that target — it's flying!`
                    : `${creature.name} cannot harm the undead with a normal attack!`
                )
                return
              }

              let updatedLayer = result.objectLayer
              const attackerCellNow = updatedLayer[y][x]

              if (attackerCellNow) {
                updatedLayer = updatedLayer.map(row => [...row])
                updatedLayer[y][x] = withMoverAp(attackerCellNow, getMoverAp(attackerCellNow, attackerCellNow.ap) - ATTACK_AP_COST)
              }

              setObjectLayer(updatedLayer)

              if (result.defeated && result.defenderType === 'enemyWizard') {
                setEnemyPosition(null)
              }
            }
            return
          }

          const terrainType = terrainLayer[newY][newX]
          const cost = getMovementCost(terrainType, moverStats)

          if (cost >= IMPASSABLE_THRESHOLD) return
          if (moverAp < cost) return

          let updatedLayer = objectLayer.map(row => [...row])
          updatedLayer[y][x] = null
          updatedLayer[newY][newX] = {
            ...withMoverAp(creature, moverAp - cost),
            x: newX,
            y: newY
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
    effectLayer,
    playerPosition,
    enemyPosition,
    setCursor,
    setSelected,
    setPlayerPosition,
    setAp,
    setObjectLayer,
    setEffectLayer,
    setEnemyPosition,
    setTerrainLayer,
    showLoadModal,
    gameStatus,
    setGameStatus,
    setGameOverMessage,
    isAnimating
  ])
}