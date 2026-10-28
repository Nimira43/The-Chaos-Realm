import {
  STAT_RULES,
  baselineStats,
  getSpellCatalogue,
  statCost,
} from './wizardRules.js'
import { ARCHETYPES } from './enemyArchetypes.js'
import { ENEMY_FIRST_NAMES } from './enemyNames.js'
import {
  CATEGORY_WEIGHT,
  ENEMY_RAMP_LEVELS,
  ENEMY_STAT_CAPS,
  MANA_PER_SPELL_POINT,
  POTION_LEVEL_CAP,
  BUY_AVOIDED,
  BUY_FAVOURED,
  KIT_AVOIDED,
  KIT_FAVOURED,
  KIT_SLACK,
  enemyBudget,
  maxSpellCost,
  spellLevelCap,
} from './enemyRules.js'

function hashString(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}

function makeRng(seedText) {
  let a = hashString(seedText)()
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickOne(list, rng) {
  return list[Math.floor(rng() * list.length)]
}

function pickWeighted(items, weights, rng) {
  let total = 0
  for (const w of weights) total += w
  let roll = rng() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}

function climbStats(level, archetype) {
  const stats = baselineStats()
  const progress = Math.min(1, (level - 1) / (ENEMY_RAMP_LEVELS - 1))

  for (const rule of STAT_RULES) {
    const cap = ENEMY_STAT_CAPS[rule.key]
    if (cap === undefined) continue
    const bias = archetype.statBias?.[rule.key] ?? 1
    const gain = Math.round(progress * (cap - rule.base) * bias)
    stats[rule.key] = Math.min(cap, rule.base + Math.max(0, gain))
  }
  return stats
}

function splitMoney(money, baseMana) {
  if (MANA_PER_SPELL_POINT * money <= baseMana)
    return { spellPoints: money, extraMana: 0 }
  const spellPoints = Math.floor(
    (money + baseMana) / (1 + MANA_PER_SPELL_POINT),
  )
  return { spellPoints, extraMana: money - spellPoints }
}

function chooseKit({ points, level, archetype, unlocked, capFor, rng }) {
  const favoured = new Set(archetype.favoured)
  const avoided = new Set(archetype.avoided)
  const dearest = maxSpellCost(level)

  const weightOf = (s) => {
    const category = CATEGORY_WEIGHT[s.category] ?? 0.2
    const affinity = favoured.has(s.name)
      ? KIT_FAVOURED
      : avoided.has(s.name)
        ? KIT_AVOIDED
        : 1
    return category * affinity * (0.4 + s.manaCost / dearest)
  }

  const pool = [...unlocked]
  const kit = []
  let capacity = 0

  while (pool.length > 0 && capacity < points * KIT_SLACK) {
    const spell = pickWeighted(pool, pool.map(weightOf), rng)
    pool.splice(pool.indexOf(spell), 1)
    kit.push(spell)
    capacity += capFor(spell) * spell.manaCost
  }

  if (!kit.some((s) => s.category === 'creature')) {
    const creatures = unlocked.filter((s) => s.category === 'creature')
    if (creatures.length)
      kit.push(pickWeighted(creatures, creatures.map(weightOf), rng))
  }
  return kit
}

function buySpells({ points, level, archetype, catalogue, rng }) {
  const unlocked = catalogue.filter((s) => s.manaCost <= maxSpellCost(level))
  const capFor = (s) =>
    s.category === 'potion'
      ? Math.min(POTION_LEVEL_CAP, spellLevelCap(level))
      : spellLevelCap(level)
  const kit = chooseKit({ points, level, archetype, unlocked, capFor, rng })
  const favoured = new Set(archetype.favoured)
  const avoided = new Set(archetype.avoided)

  const levels = {}
  let left = points

  for (;;) {
    const options = kit.filter(
      (s) => (levels[s.name] || 0) < capFor(s) && s.manaCost <= left,
    )
    if (options.length === 0) break

    const weights = options.map((s) => {
      const affinity = favoured.has(s.name)
        ? BUY_FAVOURED
        : avoided.has(s.name)
          ? BUY_AVOIDED
          : 1
      return affinity / Math.pow(1 + (levels[s.name] || 0), 1.5)
    })
    const spell = pickWeighted(options, weights, rng)
    levels[spell.name] = (levels[spell.name] || 0) + 1
    left -= spell.manaCost
  }

  return { levels, left }
}

export function generateEnemy(level, seed = '') {
  const lvl = Math.max(1, Math.round(level) || 1)
  const rng = makeRng(`${seed}|${lvl}`)
  const catalogue = getSpellCatalogue()

  const archetype = pickOne(ARCHETYPES, rng)
  const name =
    `${pickOne(ENEMY_FIRST_NAMES, rng)} the ${archetype.title}`.slice(0, 40)

  const budget = enemyBudget(lvl)
  const stats = climbStats(lvl, archetype)

  let statSpend = 0
  for (const rule of STAT_RULES)
    statSpend += statCost(rule.key, stats[rule.key])

  const { spellPoints, extraMana } = splitMoney(
    Math.max(0, budget - statSpend),
    stats.max_mana,
  )
  const bought = buySpells({
    points: spellPoints,
    level: lvl,
    archetype,
    catalogue,
    rng,
  })

  const manaGain = extraMana + bought.left
  stats.max_mana += manaGain

  const spellSpend = spellPoints - bought.left
  return {
    id: `enemy_${seed}_${lvl}`,
    name,
    archetype: archetype.id,
    archetypeTitle: archetype.title,
    blurb: archetype.blurb,
    level: lvl,
    seed: String(seed),
    budget,
    spent: statSpend + manaGain + spellSpend,
    stats,
    spellLevels: bought.levels,
  }
}

export function describeEnemy(enemy) {
  return `${enemy.name} · power ${enemy.budget}`
}
