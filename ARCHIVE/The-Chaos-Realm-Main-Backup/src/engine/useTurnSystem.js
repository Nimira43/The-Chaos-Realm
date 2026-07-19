import { PLAYER } from '../data/player.js'
import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { runEnemyWizardAI } from './enemyAI.js'

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

    // Mana regeneration
    const regen = Math.ceil(PLAYER.current_mana * 0.10)
    PLAYER.current_mana = Math.min(
      PLAYER.current_mana + regen,
      PLAYER.max_mana
    )

    // Reset AP for all creatures
    const withCreatureAp = objectLayer.map(row =>
      row.map(cell => {
        if (cell && cell.type === 'creature') {
          return { ...cell, ap: cell.stats.action_points_ground }
        }
        return cell
      })
    )

    // Enemy wizard's turn — only if one is actually on the board
    if (enemyPosition) {
      const { objectLayer: afterAI, moved, position } = runEnemyWizardAI(terrainLayer, withCreatureAp)
      setObjectLayer(afterAI)
      if (moved && position) {
        setEnemyPosition(position)
      }
    } else {
      setObjectLayer(withCreatureAp)
    }

    setRound(prev => prev + 1)
  }

  return endTurn
}