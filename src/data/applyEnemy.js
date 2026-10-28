import { ENEMY_WIZARD } from './enemyWizard.js'
import { ENEMY_SPELLBOOK } from './enemySpellbook.js'
import { buildSpellbook } from './spellbook.js'
import { STAT_KEYS } from './wizardRules.js'
import { ENEMY_BOUNTY, ENEMY_CONSTITUTION } from './enemyRules.js'

export const CLASSIC_NAME = 'Classic Wizard'

const TOUCHED_KEYS = [...STAT_KEYS, 'name', 'constitution', 'victory_points']
const SNAPSHOT_KEY = '__chaosRealmClassicEnemy'

function classicKit() {
  if (!globalThis[SNAPSHOT_KEY]) {
    const wizard = {}
    for (const key of TOUCHED_KEYS)
      if (key in ENEMY_WIZARD) wizard[key] = ENEMY_WIZARD[key]
    const spells = {}
    for (const s of ENEMY_SPELLBOOK) spells[s.name] = s.initialSpellLevel || 0
    globalThis[SNAPSHOT_KEY] = { wizard, spells }
  }
  return globalThis[SNAPSHOT_KEY]
}

function setSpellLevels(levelFor) {
  const catalogue = buildSpellbook()
  for (const entry of catalogue) {
    if (!ENEMY_SPELLBOOK.some((s) => s.name === entry.name))
      ENEMY_SPELLBOOK.push({
        ...entry,
        initialSpellLevel: 0,
        currentSpellLevel: 0,
      })
  }
  for (const spell of ENEMY_SPELLBOOK) {
    const level = levelFor(spell.name)
    spell.initialSpellLevel = level
    spell.currentSpellLevel = level
  }
}

function refill() {
  ENEMY_WIZARD.ap = ENEMY_WIZARD.max_ap
  ENEMY_WIZARD.current_mana = ENEMY_WIZARD.max_mana
  ENEMY_WIZARD.current_health = ENEMY_WIZARD.constitution
}

export function applyEnemyToGame(enemy) {
  const classic = classicKit()

  if (!enemy || enemy.classic) {
    for (const key of TOUCHED_KEYS) {
      if (key in classic.wizard) ENEMY_WIZARD[key] = classic.wizard[key]
      else delete ENEMY_WIZARD[key]
    }
    ENEMY_WIZARD.name = CLASSIC_NAME
    setSpellLevels((name) => classic.spells[name] || 0)
  } else {
    ENEMY_WIZARD.name = enemy.name
    for (const key of STAT_KEYS) ENEMY_WIZARD[key] = enemy.stats[key]
    ENEMY_WIZARD.constitution = ENEMY_CONSTITUTION
    setSpellLevels((name) => enemy.spellLevels[name] || 0)
  }

  ENEMY_WIZARD.victory_points = ENEMY_BOUNTY
  refill()
}
