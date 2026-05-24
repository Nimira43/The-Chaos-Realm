// src/engine/useTurnSystem.js
import { PLAYER } from '../data/player.js'

export default function useTurnSystem({
  setAp,
  setRound
}) {

  const endTurn = () => {
    // Reset AP
    PLAYER.ap = PLAYER.max_ap
    setAp(PLAYER.ap)

    // Mana regeneration: +10% of current mana (rounded up)
    const regen = Math.ceil(PLAYER.current_mana * 0.10)
    PLAYER.current_mana = Math.min(
      PLAYER.current_mana + regen,
      PLAYER.max_mana
    )

    setRound(prev => prev + 1)
  }

  return endTurn
}
