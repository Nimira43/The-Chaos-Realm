import { buildSpellbook } from './spellbook.js'

export const CREATION_BUDGET = 400
export const MAX_SPELL_LEVEL = 8
export const MAX_NAME_LENGTH = 24
export const FIXED_CONSTITUTION = 100

export const STAT_RULES = [
  {
    key: 'max_mana',
    label: 'Max mana',
    base: 400,
    max: Infinity,
    cost: 1,
    note: 'Spells cost mana to cast. No upper limit.',
  },
  {
    key: 'max_ap',
    label: 'Action points',
    base: 40,
    max: 60,
    cost: 1,
    note: 'Moves and actions per turn.',
  },
  {
    key: 'stamina',
    label: 'Stamina',
    base: 60,
    max: 100,
    cost: 1,
    note: 'How hard he is to wear down.',
  },
  {
    key: 'combat',
    label: 'Combat',
    base: 10,
    max: 30,
    cost: 1,
    note: 'Hitting power in melee.',
  },
  {
    key: 'defence',
    label: 'Defence',
    base: 10,
    max: 30,
    cost: 1,
    note: 'Resisting melee blows.',
  },
  {
    key: 'magic_resistance',
    label: 'Magic resistance',
    base: 40,
    max: 100,
    cost: 1,
    note: 'Resisting enemy spells.',
  },
]

export const STAT_KEYS = STAT_RULES.map((r) => r.key)

export const CATEGORY_ORDER = [
  'creature',
  'environment',
  'offensive',
  'potion',
]
export const CATEGORY_LABELS = {
  creature: 'Creatures',
  environment: 'Environment',
  offensive: 'Offensive',
  potion: 'Potions',
}

export function getSpellCatalogue() {
  return buildSpellbook().map((s) => ({
    name: s.name,
    manaCost: s.manaCost,
    category: s.category,
  }))
}

export function baselineStats() {
  const stats = {}
  for (const rule of STAT_RULES) stats[rule.key] = rule.base
  return stats
}

export function ruleFor(key) {
  return STAT_RULES.find((r) => r.key === key)
}

export function statCost(key, value) {
  const rule = ruleFor(key)
  return Math.max(0, value - rule.base) * rule.cost
}

export function spellCost(manaCost, level) {
  return manaCost * level
}

export function priceBlueprint(blueprint, catalogue = getSpellCatalogue()) {
  let stats = 0
  for (const rule of STAT_RULES)
    stats += statCost(rule.key, blueprint.stats[rule.key] ?? rule.base)

  let spells = 0
  let manaToCastAll = 0
  for (const spell of catalogue) {
    const level = blueprint.spellLevels?.[spell.name] || 0
    spells += spellCost(spell.manaCost, level)
    manaToCastAll += spellCost(spell.manaCost, level)
  }

  const spent = stats + spells
  return { stats, spells, spent, bank: CREATION_BUDGET - spent, manaToCastAll }
}

export function isWithinBudget(blueprint, catalogue) {
  return priceBlueprint(blueprint, catalogue).spent <= CREATION_BUDGET
}

export function highestAffordableStat(key, current, bankNow) {
  const rule = ruleFor(key)
  const extra = Math.floor(Math.max(0, bankNow) / rule.cost)
  return Math.min(rule.max, current + extra)
}

export function highestAffordableSpellLevel(spell, current, bankNow) {
  const extra = Math.floor(Math.max(0, bankNow) / spell.manaCost)
  return Math.min(MAX_SPELL_LEVEL, current + extra)
}

export function sanitiseBlueprint(raw, catalogue = getSpellCatalogue()) {
  if (!raw || typeof raw !== 'object') return null
  const name = String(raw.name ?? '')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
  if (!name) return null

  const stats = {}
  for (const rule of STAT_RULES) {
    const value = Math.round(Number(raw.stats?.[rule.key]))
    stats[rule.key] = Number.isFinite(value)
      ? Math.min(rule.max, Math.max(rule.base, value))
      : rule.base
  }

  const spellLevels = {}
  for (const spell of catalogue) {
    const level = Math.round(Number(raw.spellLevels?.[spell.name]))
    if (Number.isFinite(level) && level > 0)
      spellLevels[spell.name] = Math.min(MAX_SPELL_LEVEL, level)
  }

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : null,
    name,
    stats,
    spellLevels,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  }
}
