import { PLAYER } from '../data/player.js'
import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { runEnemyWizardAI, runEnemyCreaturesAI } from './enemyAI.js'

export default function useTurnSystem({
  terrainLayer,
  objectLayer,
  enemyPosition,
  setAp,
  setRound,
  setObjectLayer,
  setEnemyPosition
}) {

  const endTurn = () => {
    // Reset player AP
    PLAYER.ap = PLAYER.max_ap
    setAp(PLAYER.ap)

    // Reset enemy wizard AP
    ENEMY_WIZARD.ap = ENEMY_WIZARD.max_ap

    // Mana regeneration — player
    const playerRegen = Math.ceil(PLAYER.current_mana * 0.10)
    PLAYER.current_mana = Math.min(
      PLAYER.current_mana + playerRegen,
      PLAYER.max_mana
    )

    // Mana regeneration — enemy wizard
    const enemyRegen = Math.ceil(ENEMY_WIZARD.current_mana * 0.10)
    ENEMY_WIZARD.current_mana = Math.min(
      ENEMY_WIZARD.current_mana + enemyRegen,
      ENEMY_WIZARD.max_mana
    )

    // Reset AP for all creatures (player-owned AND enemy-owned)
    const withCreatureAp = objectLayer.map(row =>
      row.map(cell => {
        if (cell && cell.type === 'creature') {
          return { ...cell, ap: cell.stats.action_points_ground }
        }
        return cell
      })
    )

    let workingLayer = withCreatureAp

    // Enemy wizard's turn — only if one is actually on the board
    if (enemyPosition) {
      const wizardResult = runEnemyWizardAI(terrainLayer, workingLayer)
      workingLayer = wizardResult.objectLayer

      if (wizardResult.position) {
        setEnemyPosition(wizardResult.position)
      }

      if (wizardResult.defeatedTarget === 'player') {
        console.log('The player wizard has fallen!')
      }
    }

    // Enemy creatures act independently — they keep fighting even if their
    // wizard has already been defeated
    const creatureResult = runEnemyCreaturesAI(terrainLayer, workingLayer)
    workingLayer = creatureResult.objectLayer

    if (creatureResult.defeatedTargets.includes('player')) {
      console.log('The player wizard has fallen!')
    }

    setObjectLayer(workingLayer)
    setRound(prev => prev + 1)
  }

  return endTurn
}

