import { buildSpellbook } from './spellbook.js'

// A completely independent spellbook — separate objects from SPELLBOOK,
// so casting as the enemy never depletes (or is depleted by) the player's book.
export const ENEMY_SPELLBOOK = buildSpellbook()