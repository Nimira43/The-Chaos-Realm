import { PLAYER } from '../data/player.js'
import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { runEnemyWizardAI, runEnemyCreaturesAI } from './enemyAI.js'
import { terrainCost, MAP_WIDTH, MAP_HEIGHT } from './terrain.js'

export const MAX_ROUNDS = 30
export const PORTAL_TURN = Math.round(MAX_ROUNDS * 2 / 3)

const FRAME_DELAY_MS = 120

function playFrames(frames, setObjectLayer, turnTokenRef, token, onDone) {
  if (turnTokenRef.current !== token) return
  if (frames.length === 0) {
    onDone()
    return
  }

  let i = 0

  function step() {
    if (turnTokenRef.current !== token) return
    setObjectLayer(frames[i])
    i++
    if (i < frames.length) {
      setTimeout(step, FRAME_DELAY_MS)
    } else {
      onDone()
    }
  }

  step()
}

function pickRandomPortalTile(terrainLayer, objectLayer) {
  const attempts = 40

  for (let i = 0; i < attempts; i++) {
    const x = Math.floor(Math.random() * MAP_WIDTH)
    const y = Math.floor(Math.random() * MAP_HEIGHT)
    const terrain = terrainLayer[y][x]

    if (terrain === 'lava') continue
    if ((terrainCost[terrain] ?? 999) >= 999) continue
    if (objectLayer[y][x] !== null) continue

    return { x, y }
  }

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const terrain = terrainLayer[y][x]
      if (terrain === 'lava') continue
      if ((terrainCost[terrain] ?? 999) >= 999) continue
      if (objectLayer[y][x] !== null) continue
      return { x, y }
    }
  }

  return null
}

export default function useTurnSystem({
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
}) {

  const endTurn = () => {
    if (gameStatus !== 'playing') return
    if (round >= MAX_ROUNDS) return
    if (isAnimating) return

    turnTokenRef.current += 1
    const myToken = turnTokenRef.current
    setIsAnimating(true)

    PLAYER.ap = PLAYER.max_ap
    setAp(PLAYER.ap)

    ENEMY_WIZARD.ap = ENEMY_WIZARD.max_ap

    const playerRegen = Math.ceil(PLAYER.current_mana * 0.10)
    PLAYER.current_mana = Math.min(
      PLAYER.current_mana + playerRegen,
      PLAYER.max_mana
    )

    const enemyRegen = Math.ceil(ENEMY_WIZARD.current_mana * 0.10)
    ENEMY_WIZARD.current_mana = Math.min(
      ENEMY_WIZARD.current_mana + enemyRegen,
      ENEMY_WIZARD.max_mana
    )

    const withCreatureAp = objectLayer.map(row =>
      row.map(cell => {
        if (cell && cell.type === 'creature') {
          return { ...cell, ap: cell.stats.action_points_ground }
        }
        return cell
      })
    )

    let workingLayer = withCreatureAp
    let workingTerrain = terrainLayer
    let activePortalPosition = portalPosition
    let frames = []

    const nextRound = Math.min(round + 1, MAX_ROUNDS)

    let newStatus = null
    let newMessage = ''

    if (!activePortalPosition && nextRound >= PORTAL_TURN) {
      const spawnTile = portalStart || pickRandomPortalTile(workingTerrain, workingLayer)

      if (spawnTile) {
        const newTerrain = workingTerrain.map(row => [...row])
        newTerrain[spawnTile.y][spawnTile.x] = 'portal'

        workingTerrain = newTerrain
        activePortalPosition = spawnTile
        setTerrainLayer(newTerrain)
        setPortalPosition(spawnTile)

        if (PLAYER.x === spawnTile.x && PLAYER.y === spawnTile.y) {
          newStatus = 'won'
          newMessage = 'The portal opened beneath your feet — victory!'
        } else if (enemyPosition && ENEMY_WIZARD.x === spawnTile.x && ENEMY_WIZARD.y === spawnTile.y) {
          newStatus = 'lost'
          newMessage = 'The portal opened beneath the enemy wizard — you lose.'
        }
      } else {
        console.warn('Could not find a valid tile to place the portal on.')
      }
    }

    if (enemyPosition) {
      const wizardResult = runEnemyWizardAI(workingTerrain, workingLayer, activePortalPosition)
      workingLayer = wizardResult.objectLayer
      frames = frames.concat(wizardResult.frames)

      if (wizardResult.selfDefeated) {
        setEnemyPosition(null)
        console.log('The enemy wizard perished in the lava!')
      } else if (wizardResult.position) {
        setEnemyPosition(wizardResult.position)
      }

      if (!newStatus && wizardResult.defeatedTarget === 'player') {
        newStatus = 'lost'
        newMessage = 'Your wizard has fallen!'
      }

      if (
        !newStatus &&
        !wizardResult.selfDefeated &&
        activePortalPosition &&
        ENEMY_WIZARD.x === activePortalPosition.x &&
        ENEMY_WIZARD.y === activePortalPosition.y
      ) {
        newStatus = 'lost'
        newMessage = 'The enemy wizard reached the portal first — you lose.'
      }
    }

    const creatureResult = runEnemyCreaturesAI(workingTerrain, workingLayer)
    workingLayer = creatureResult.objectLayer
    frames = frames.concat(creatureResult.frames)

    if (!newStatus && creatureResult.defeatedTargets.includes('player')) {
      newStatus = 'lost'
      newMessage = 'Your wizard has fallen!'
    }

    if (!newStatus && nextRound >= MAX_ROUNDS) {
      newStatus = 'lost'
      newMessage = "Time's up — you failed to reach the portal in time."
    }

    playFrames(frames, setObjectLayer, turnTokenRef, myToken, () => {
      if (turnTokenRef.current !== myToken) return
      setObjectLayer(workingLayer)
      setIsAnimating(false)
    })

    setRound(nextRound)

    if (newStatus) {
      setGameStatus(newStatus)
      setGameOverMessage(newMessage)
    }
  }

  return endTurn
}