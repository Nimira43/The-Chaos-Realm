import { PLAYER } from '../data/player.js'
import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { runEnemyWizardAI, runEnemyCreaturesAI } from './enemyAI.js'

export const MAX_ROUNDS = 30

const FRAME_DELAY_MS = 120

function playFrames(frames, setObjectLayer, onDone) {
  if (frames.length === 0) {
    onDone()
    return
  }

  let i = 0

  function step() {
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

export default function useTurnSystem({
  terrainLayer,
  objectLayer,
  enemyPosition,
  round,
  setAp,
  setRound,
  setObjectLayer,
  setEnemyPosition
}) {

  const endTurn = () => {
    if (round >= MAX_ROUNDS) return

    PLAYER.ap = PLAYER.max_ap
    setAp(PLAYER.ap)

    console.debug('[enemy wizard] AP before reset:', ENEMY_WIZARD.ap, '| resetting to max:', ENEMY_WIZARD.max_ap)
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
    let frames = []

    if (enemyPosition) {
      const wizardResult = runEnemyWizardAI(terrainLayer, workingLayer)
      workingLayer = wizardResult.objectLayer
      frames = frames.concat(wizardResult.frames)

      if (wizardResult.selfDefeated) {
        setEnemyPosition(null)
        console.log('The enemy wizard perished in the lava!')
      } else if (wizardResult.position) {
        setEnemyPosition(wizardResult.position)
      }

      if (wizardResult.defeatedTarget === 'player') {
        console.log('The player wizard has fallen!')
      }
    }

    const creatureResult = runEnemyCreaturesAI(terrainLayer, workingLayer)
    workingLayer = creatureResult.objectLayer
    frames = frames.concat(creatureResult.frames)

    if (creatureResult.defeatedTargets.includes('player')) {
      console.log('The player wizard has fallen!')
    }

    playFrames(frames, setObjectLayer, () => {
      setObjectLayer(workingLayer)
    })

    setRound(prev => Math.min(prev + 1, MAX_ROUNDS))
  }

  return endTurn
}