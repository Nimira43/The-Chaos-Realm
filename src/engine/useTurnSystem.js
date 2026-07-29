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

    if (enemyPosition) {
      const wizardResult = runEnemyWizardAI(terrainLayer, workingLayer)
      workingLayer = wizardResult.objectLayer

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

    if (creatureResult.defeatedTargets.includes('player')) {
      console.log('The player wizard has fallen!')
    }

    setObjectLayer(workingLayer)
    setRound(prev => prev + 1)
  }

  return endTurn
}
