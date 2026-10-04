import { CREATURES } from '../data/creatures.js'
import { isMountCreature, canFly } from './mounts.js'

export const USE_OPTIONS_BONUS = 15
export const ARMY_MANA_RESERVE = 120
export const TERRAIN_TRIGGER_TILES = 25
export const SPECIALIST_CAP = 3

export const TERRAIN_SPECIALISTS = {
  mountain: [
    (stats) => isMountCreature(stats) && canFly(stats),
    (stats) => canFly(stats)
  ],
  water: [
    (stats) => isMountCreature(stats) && !!stats.water_type,
    (stats) => !!stats.water_type
  ],
  forest: [
    (stats) => isMountCreature(stats) && !!stats.wood_type
  ],
  lava: [
    (stats) => isMountCreature(stats) && !!stats.lava_type,
    (stats) => !!stats.lava_type
  ]
}

export function scoreCreature(stats) {
  return stats.combat + (stats.use_options ? USE_OPTIONS_BONUS : 0)
}

export function getActiveTerrainPreferences(terrainCounts) {
  return Object.keys(TERRAIN_SPECIALISTS)
    .filter(terrain => (terrainCounts[terrain] || 0) >= TERRAIN_TRIGGER_TILES)
    .sort((a, b) => terrainCounts[b] - terrainCounts[a])
    .flatMap(terrain => TERRAIN_SPECIALISTS[terrain].map(pred => ({ terrain, pred })))
}

function bestOf(candidates) {
  return [...candidates].sort((a, b) =>
    b.score - a.score ||
    b.stats.combat - a.stats.combat ||
    a.cost - b.cost
  )[0]
}

export function pickArmySpell({
  spellbook,
  mana,
  reserve = ARMY_MANA_RESERVE,
  freeTileCount,
  terrainCounts = {},
  wizardMounted = false,
  countOwn = () => 0
}) {
  const candidates = []

  for (const spell of spellbook) {
    if (spell.category !== 'creature') continue

    const level = spell.currentSpellLevel
    if (level <= 0) continue

    const cost = spell.manaCost * level
    if (mana - cost < reserve) continue

    if (Math.min(level, freeTileCount) < Math.ceil(level / 2)) continue

    const stats = CREATURES.find(c => c.name === spell.name)
    if (!stats) continue

    candidates.push({ spell, stats, cost, score: scoreCreature(stats) })
  }

  if (candidates.length === 0) return null

  if (!wizardMounted) {
    for (const { pred } of getActiveTerrainPreferences(terrainCounts)) {
      if (countOwn(pred) >= SPECIALIST_CAP) continue
      const matching = candidates.filter(c => pred(c.stats))
      if (matching.length > 0) return bestOf(matching)
    }
  }

  return bestOf(candidates)
}
