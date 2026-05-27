import { PLAYER } from '../data/player.js'

export default function useTurnSystem({
  setAp,
  setRound,
  setObjectLayer
}) {

  const endTurn = () => {
    // Reset player AP
    PLAYER.ap = PLAYER.max_ap
    setAp(PLAYER.ap)

    // Mana regeneration
    const regen = Math.ceil(PLAYER.current_mana * 0.10)
    PLAYER.current_mana = Math.min(
      PLAYER.current_mana + regen,
      PLAYER.max_mana
    )

    // Reset AP for all creatures
    setObjectLayer(prev =>
      prev.map(row =>
        row.map(cell => {
          if (cell && cell.type === 'creature') {
            return {
              ...cell,
              ap: cell.stats.action_points_ground
            }
          }
          return cell
        })
      )
    )

    setRound(prev => prev + 1)
  }

  return endTurn
}
