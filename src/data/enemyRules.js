export const ENEMY_BOUNTY = 100
export const ENEMY_BUDGET_BASE = 400
export const ENEMY_BUDGET_STEP = 80
export const ENEMY_BUDGET_SCALE = 1

export function enemyBudget(level) {
  const lvl = Math.max(1, Math.round(level) || 1)
  return Math.round((ENEMY_BUDGET_BASE + ENEMY_BUDGET_STEP * (lvl - 1)) * ENEMY_BUDGET_SCALE)
}

export const ENEMY_RAMP_LEVELS = 50
export const UNLOCK_BASE = 13
export const UNLOCK_PER_LEVEL = 1

export function maxSpellCost(level) {
  return Math.floor(UNLOCK_BASE + UNLOCK_PER_LEVEL * level)
}

export function spellLevelCap(level) {
  return Math.min(8, 3 + Math.floor(level / 6))
}

export const ENEMY_STAT_CAPS = {
  max_ap: 56,
  stamina: 100,
  combat: 30,
  defence: 30,
  magic_resistance: 90
}

export const ENEMY_CONSTITUTION = 100
export const MANA_PER_SPELL_POINT = 0.6

export const CATEGORY_WEIGHT = {
  creature: 1,
  offensive: 0.3,
  environment: 0.25,
  potion: 0.08
}

export const POTION_LEVEL_CAP = 2
export const KIT_FAVOURED = 6
export const KIT_AVOIDED = 0.15
export const KIT_SLACK = 1.0
export const BUY_FAVOURED = 4
export const BUY_AVOIDED = 0.25
