import { PLAYER } from '../data/player.js'

// Flat AP cost for any attack action, regardless of terrain or attacker type.
// Kept separate from movement cost — attacking and moving are different actions.
export const ATTACK_AP_COST = 2

// Random swing added on top of the attacker's combat rating before subtracting
// the defender's defence, so outcomes aren't perfectly deterministic.
const DAMAGE_ROLL_MAX = 6

// Lava deals a flat percentage of a unit's MAX health, not their current health.
const LAVA_DAMAGE_PERCENT = 0.10

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
      maxHealth: PLAYER.constitution,
      undead: PLAYER.undead,
      apply: (newHealth) => { PLAYER.current_health = newHealth }
    }
  }

  if (cell.type === 'enemyWizard') {
    const ref = cell.ref
    return {
      combat: ref.combat,
      defence: ref.defence,
      health: ref.current_health,
      maxHealth: ref.constitution,
      undead: ref.undead,
      apply: (newHealth) => { ref.current_health = newHealth }
    }
  }

  if (cell.type === 'creature') {
    return {
      combat: cell.stats.combat,
      defence: cell.stats.defence,
      health: cell.current_health,
      maxHealth: cell.stats.constitution,
      undead: cell.stats.undead,
      // Creature health lives on the cell itself (not a singleton) — nothing to
      // "apply" here, the caller replaces the cell in the layer instead.
      apply: null
    }
  }

  return null
}

// Shared damage-application logic — used by both combat attacks and
// environmental effects (lava). Handles the "health lives on a singleton"
// vs "health lives on the cell" split, and removes the unit from the board
// if the damage is fatal.
function applyDamageToCell(objectLayer, pos, damage) {
  const cell = objectLayer[pos.y][pos.x]
  if (!cell) return { objectLayer, damage: 0, defeated: false, targetType: null }

  const profile = getCombatProfile(cell)
  if (!profile) return { objectLayer, damage: 0, defeated: false, targetType: null }

  const newHealth = Math.max(0, profile.health - damage)
  const defeated = newHealth <= 0

  let newLayer = objectLayer

  if (profile.apply) {
    // Wizard — health lives on the singleton, mutate it directly
    profile.apply(newHealth)

    if (defeated) {
      newLayer = objectLayer.map(row => [...row])
      newLayer[pos.y][pos.x] = null
    }
  } else {
    // Creature — health lives on the cell, replace it immutably
    newLayer = objectLayer.map(row => [...row])

    newLayer[pos.y][pos.x] = defeated
      ? null
      : { ...cell, current_health: newHealth }
  }

  return { objectLayer: newLayer, damage, defeated, targetType: cell.type }
}

// Resolves one attack from the unit at attackerPos against the unit at defenderPos.
// Returns a new objectLayer with damage applied and defeated units removed.
// The caller is responsible for deducting the attacker's own AP — but only
// when `blocked` is false; a blocked attack never happened, so it should
// never cost anything.
export function resolveAttack({ objectLayer, attackerPos, defenderPos }) {
  const attackerCell = objectLayer[attackerPos.y][attackerPos.x]
  const defenderCell = objectLayer[defenderPos.y][defenderPos.x]

  if (!attackerCell || !defenderCell) {
    return { objectLayer, damage: 0, defeated: false, defenderType: null, blocked: false }
  }

  const attackerProfile = getCombatProfile(attackerCell)
  const defenderProfile = getCombatProfile(defenderCell)

  if (!attackerProfile || !defenderProfile) {
    return { objectLayer, damage: 0, defeated: false, defenderType: null, blocked: false }
  }

  // Undead immunity: only the undead can harm the undead through a normal
  // attack. Everything else — living creatures, both wizards — bounces off
  // harmlessly. The exceptions to this (Magic Fire, Gooey Blob, Tangle Vine,
  // Water, and magic weapons) are deliberately NOT handled here — each of
  // those will need its own damage path that bypasses this check entirely,
  // rather than this function growing a list of "unless" clauses.
  if (defenderProfile.undead && !attackerProfile.undead) {
    return {
      objectLayer,
      damage: 0,
      defeated: false,
      defenderType: defenderCell.type,
      blocked: true,
      blockedReason: 'undead-immune'
    }
  }

  const damage = rollDamage(attackerProfile.combat, defenderProfile.defence)
  const result = applyDamageToCell(objectLayer, defenderPos, damage)

  return {
    objectLayer: result.objectLayer,
    damage: result.damage,
    defeated: result.defeated,
    defenderType: result.targetType,
    blocked: false
  }
}

// Applies lava damage (10% of max health) to whatever unit is at pos.
// Used whenever a mover steps onto a 'lava' tile, for any entity type.
// Lava is environmental, not a "normal attack" — it is NOT subject to the
// undead immunity check above, and burns the undead just as readily.
export function applyLavaDamage(objectLayer, pos) {
  const cell = objectLayer[pos.y][pos.x]
  if (!cell) return { objectLayer, damage: 0, defeated: false }

  const profile = getCombatProfile(cell)
  if (!profile) return { objectLayer, damage: 0, defeated: false }

  const damage = Math.max(1, Math.ceil(profile.maxHealth * LAVA_DAMAGE_PERCENT))
  const result = applyDamageToCell(objectLayer, pos, damage)

  return { objectLayer: result.objectLayer, damage: result.damage, defeated: result.defeated }
}

// import { PLAYER } from '../data/player.js'

// export const ATTACK_AP_COST = 2

// const DAMAGE_ROLL_MAX = 6
// const LAVA_DAMAGE_PERCENT = 0.10

// function rollDamage(attackerCombat, defenderDefence) {
//   const swing = Math.floor(Math.random() * DAMAGE_ROLL_MAX) + 1
//   return Math.max(1, (attackerCombat + swing) - defenderDefence)
// }

// function getCombatProfile(cell) {
//   if (!cell) return null

//   if (cell.type === 'player') {
//     return {
//       combat: PLAYER.combat,
//       defence: PLAYER.defence,
//       health: PLAYER.current_health,
//       maxHealth: PLAYER.constitution,
//       apply: (newHealth) => { PLAYER.current_health = newHealth }
//     }
//   }

//   if (cell.type === 'enemyWizard') {
//     const ref = cell.ref
//     return {
//       combat: ref.combat,
//       defence: ref.defence,
//       health: ref.current_health,
//       maxHealth: ref.constitution,
//       apply: (newHealth) => { ref.current_health = newHealth }
//     }
//   }

//   if (cell.type === 'creature') {
//     return {
//       combat: cell.stats.combat,
//       defence: cell.stats.defence,
//       health: cell.current_health,
//       maxHealth: cell.stats.constitution,
//       apply: null
//     }
//   }

//   return null
// }

// function applyDamageToCell(objectLayer, pos, damage) {
//   const cell = objectLayer[pos.y][pos.x]
//   if (!cell) return { objectLayer, damage: 0, defeated: false, targetType: null }

//   const profile = getCombatProfile(cell)
//   if (!profile) return { objectLayer, damage: 0, defeated: false, targetType: null }

//   const newHealth = Math.max(0, profile.health - damage)
//   const defeated = newHealth <= 0

//   let newLayer = objectLayer

//   if (profile.apply) {
//     profile.apply(newHealth)

//     if (defeated) {
//       newLayer = objectLayer.map(row => [...row])
//       newLayer[pos.y][pos.x] = null
//     }
//   } else {
//     newLayer = objectLayer.map(row => [...row])

//     newLayer[pos.y][pos.x] = defeated
//       ? null
//       : { ...cell, current_health: newHealth }
//   }

//   return { objectLayer: newLayer, damage, defeated, targetType: cell.type }
// }

// export function resolveAttack({ objectLayer, attackerPos, defenderPos }) {
//   const attackerCell = objectLayer[attackerPos.y][attackerPos.x]
//   const defenderCell = objectLayer[defenderPos.y][defenderPos.x]

//   if (!attackerCell || !defenderCell) {
//     return { objectLayer, damage: 0, defeated: false, defenderType: null }
//   }

//   const attackerProfile = getCombatProfile(attackerCell)
//   const defenderProfile = getCombatProfile(defenderCell)

//   if (!attackerProfile || !defenderProfile) {
//     return { objectLayer, damage: 0, defeated: false, defenderType: null }
//   }

//   const damage = rollDamage(attackerProfile.combat, defenderProfile.defence)
//   const result = applyDamageToCell(objectLayer, defenderPos, damage)

//   return {
//     objectLayer: result.objectLayer,
//     damage: result.damage,
//     defeated: result.defeated,
//     defenderType: result.targetType
//   }
// }

// export function applyLavaDamage(objectLayer, pos) {
//   const cell = objectLayer[pos.y][pos.x]
//   if (!cell) return { objectLayer, damage: 0, defeated: false }

//   const profile = getCombatProfile(cell)
//   if (!profile) return { objectLayer, damage: 0, defeated: false }

//   const damage = Math.max(1, Math.ceil(profile.maxHealth * LAVA_DAMAGE_PERCENT))
//   const result = applyDamageToCell(objectLayer, pos, damage)

//   return { objectLayer: result.objectLayer, damage: result.damage, defeated: result.defeated }
// }