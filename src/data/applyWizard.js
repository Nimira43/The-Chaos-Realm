import { PLAYER } from './player.js'
import { SPELLBOOK } from './spellbook.js'
import { FIXED_CONSTITUTION, STAT_KEYS } from './wizardRules.js'

export function applyWizardToGame(clone) {
  PLAYER.name = clone.name

  for (const key of STAT_KEYS) PLAYER[key] = clone.stats[key]

  PLAYER.constitution = FIXED_CONSTITUTION
  PLAYER.current_health = FIXED_CONSTITUTION
  PLAYER.ap = PLAYER.max_ap
  PLAYER.current_mana = PLAYER.max_mana

  for (const spell of SPELLBOOK) {
    const level = clone.spellLevels?.[spell.name] || 0
    spell.initialSpellLevel = level
    spell.currentSpellLevel = level
  }
}
