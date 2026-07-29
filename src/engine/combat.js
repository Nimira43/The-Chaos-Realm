import { PLAYER } from '../data/player.js'

export const ATTACK_AP_COST = 2

const DAMAGE_ROLL_MAX = 6
const LAVA_DAMAGE_PERCENT = 0.10

function rollDamage(attackerCombat, defenderDefence) {
  const swing = Math.floor(Math.random() * DAMAGE_ROLL_MAX) + 1
  return Math.max(1, (attackerCombat + swing) - defenderDefence)
}

function getCombatProfile(cell) {
  if (!cell) return null

  if (cell.type === 'player') {
    return {
      combat: PLAYER.combat,
      defence: PLAYER.defence,
      health: PLAYER.current_health,
      maxHealth: PLAYER.constitution,
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
      apply: (newHealth) => { ref.current_health = newHealth }
    }
  }

  if (cell.type === 'creature') {
    return {
      combat: cell.stats.combat,
      defence: cell.stats.defence,
      health: cell.current_health,
      maxHealth: cell.stats.constitution,
      apply: null
    }
  }

  return null
}

function applyDamageToCell(objectLayer, pos, damage) {
  const cell = objectLayer[pos.y][pos.x]
  if (!cell) return { objectLayer, damage: 0, defeated: false, targetType: null }

  const profile = getCombatProfile(cell)
  if (!profile) return { objectLayer, damage: 0, defeated: false, targetType: null }

  const newHealth = Math.max(0, profile.health - damage)
  const defeated = newHealth <= 0

  let newLayer = objectLayer

  if (profile.apply) {
    profile.apply(newHealth)

    if (defeated) {
      newLayer = objectLayer.map(row => [...row])
      newLayer[pos.y][pos.x] = null
    }
  } else {
    newLayer = objectLayer.map(row => [...row])

    newLayer[pos.y][pos.x] = defeated
      ? null
      : { ...cell, current_health: newHealth }
  }

  return { objectLayer: newLayer, damage, defeated, targetType: cell.type }
}

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
  const result = applyDamageToCell(objectLayer, defenderPos, damage)

  return {
    objectLayer: result.objectLayer,
    damage: result.damage,
    defeated: result.defeated,
    defenderType: result.targetType
  }
}

export function applyLavaDamage(objectLayer, pos) {
  const cell = objectLayer[pos.y][pos.x]
  if (!cell) return { objectLayer, damage: 0, defeated: false }

  const profile = getCombatProfile(cell)
  if (!profile) return { objectLayer, damage: 0, defeated: false }

  const damage = Math.max(1, Math.ceil(profile.maxHealth * LAVA_DAMAGE_PERCENT))
  const result = applyDamageToCell(objectLayer, pos, damage)

  return { objectLayer: result.objectLayer, damage: result.damage, defeated: result.defeated }
}