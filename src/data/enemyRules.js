export const ENEMY_BOUNTY = 100
export const ENEMY_BUDGET_BASE = 400
export const ENEMY_BUDGET_STEP = 80
export const ENEMY_BUDGET_SCALE = 1

export function enemyBudget(level) {
  const lvl = Math.max(1, Math.round(level) || 1)
  return Math.round(
    (ENEMY_BUDGET_BASE + ENEMY_BUDGET_STEP * (lvl - 1)) * ENEMY_BUDGET_SCALE,
  )
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
  magic_resistance: 90,
}

export const ENEMY_CONSTITUTION = 100
export const MANA_PER_SPELL_POINT = 0.6

export const CATEGORY_WEIGHT = {
  creature: 1,
  offensive: 0.3,
  environment: 0.25,
  potion: 0.08,
}

export const POTION_LEVEL_CAP = 2
export const KIT_FAVOURED = 6
export const KIT_AVOIDED = 0.15
export const KIT_SLACK = 1.0
export const BUY_FAVOURED = 4
export const BUY_AVOIDED = 0.25

export const TRAVELLER_KIT = {
  // Retired: the Gift Box below now supplies every ride and the breaker, free.
  // Set back to true to bring back the old budget-paid kit as well.
  enabled: false,
  levels: 1,
  maxShare: 0.4,
  fliers: ['Pegasus', 'Giant Eagle', 'Gryphon'],
  rides: ['Sea Wolf', 'Cindermaw'],
  breakers: ['Magic Fire', 'Gooey Blob', 'Tangle Vine'],
  preferredBreaker: 'Tangle Vine',
}

// The Gift Box: the one guarantee about every enemy wizard, on every level.
// These spells are FREE: they are not part of his points budget, ignore the
// level at which a spell would normally unlock (the Demon is level 27 on the
// ladder), and are added ON TOP of anything his school buys. Each is one cast
// (spell level 1 = one creature or one Vine). A gift that is cast is spent:
// if the Sea Wolf dies and the level needed it, he loses the level.
//   spells : name -> levels given
export const GIFT_BOX = {
  enabled: true,
  spells: {
    Cindermaw: 1, // lava
    'Sea Wolf': 1, // water
    'Giant Eagle': 1, // air
    Demon: 1, // the tough one, sent in to clear what a Vine breaks
    'Tangle Vine': 1, // the breaker: aimed at a wall or a locked door
  },
}
