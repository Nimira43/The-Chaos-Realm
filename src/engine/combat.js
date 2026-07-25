import { PLAYER } from '../data/player.js'

// Flat AP cost for any attack action, regardless of terrain or attacker type.
// Kept separate from movement cost — attacking and moving are different actions.
export const ATTACK_AP_COST = 2

// Random swing added on top of the attacker's combat rating before subtracting
// the defender's defence, so outcomes aren't perfectly deterministic.
const DAMAGE_ROLL_MAX = 6

function rollDamage(attackerCombat, defenderDefence) {
  const swing = Math.floor(Math.random() * DAMAGE_ROLL_MAX) + 1
  return Math.max(1, (attackerCombat + swing) - defenderDefence)
}

// Normalises access to combat stats across the three kinds of thing that can
// occupy a tile: the player wizard (a singleton), the enemy wizard (a singleton
// referenced via cell.ref), and creatures (plain objects living in the layer).
function getCombatProfile(cell) {
  if (!cell) return null

  if (cell.type === 'player') {
    return {
      combat: PLAYER.combat,
      defence: PLAYER.defence,
      health: PLAYER.current_health,
      apply: (newHealth) => { PLAYER.current_health = newHealth }
    }
  }

  if (cell.type === 'enemyWizard') {
    const ref = cell.ref
    return {
      combat: ref.combat,
      defence: ref.defence,
      health: ref.current_health,
      apply: (newHealth) => { ref.current_health = newHealth }
    }
  }

  if (cell.type === 'creature') {
    return {
      combat: cell.stats.combat,
      defence: cell.stats.defence,
      health: cell.current_health,
      // Creature health lives on the cell itself (not a singleton) — nothing to
      // "apply" here, the caller replaces the cell in the layer instead.
      apply: null
    }
  }

  return null
}

// Resolves one attack from the unit at attackerPos against the unit at defenderPos.
// Returns a new objectLayer with damage applied and defeated units removed.
// The caller is responsible for deducting the attacker's own AP.
export function resolveAttack({ objectLayer, attackerPos, defenderPos }) {
  const attackerCell = objectLayer[attackerPos.y][attackerPos.x]
  const defenderCell = objectLayer[defenderPos.y][defenderPos.x]

  if (!attackerCell || !defenderCell) {
    return { objectLayer, damage: 0, defeated: false, defenderType: null }
  }

  const attackerProfile = getCombatProfile(attackerCell)
  const defenderProfile = getCombatProfile(defenderCell)

  if (!attackerProfile || !defenderProfile) {
    return { objectLayer, damage: 0, defeated: false, defenderType: null }
  }

  const damage = rollDamage(attackerProfile.combat, defenderProfile.defence)
  const newHealth = Math.max(0, defenderProfile.health - damage)
  const defeated = newHealth <= 0

  let newLayer = objectLayer

  if (defenderProfile.apply) {
    // Wizard — health lives on the singleton, mutate it directly
    defenderProfile.apply(newHealth)

    if (defeated) {
      newLayer = objectLayer.map(row => [...row])
      newLayer[defenderPos.y][defenderPos.x] = null
    }
  } else {
    // Creature — health lives on the cell, replace it immutably
    newLayer = objectLayer.map(row => [...row])

    newLayer[defenderPos.y][defenderPos.x] = defeated
      ? null
      : { ...defenderCell, current_health: newHealth }
  }

  return { objectLayer: newLayer, damage, defeated, defenderType: defenderCell.type }
}