import { generateEnemy } from './enemyGenerator.js'
import { CLASSIC_NAME } from './applyEnemy.js'

const STORAGE_KEY = 'chaosRealm.devEnemy'
export const MAX_DEV_LEVEL = 200

export const CLASSIC_ENEMY = {
  classic: true,
  id: 'classic',
  name: CLASSIC_NAME,
  archetypeTitle: 'Classic',
  level: null,
  budget: null,
}

const DEFAULTS = { source: 'classic', level: null }

export function getEnemySettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    const level = Math.round(Number(raw?.level))
    return {
      source: raw?.source === 'generated' ? 'generated' : 'classic',
      level:
        Number.isFinite(level) && level >= 1
          ? Math.min(MAX_DEV_LEVEL, level)
          : null,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveEnemySettings(settings) {
  const next = { ...getEnemySettings(), ...settings }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* the setting just won't be remembered */
  }
  return next
}

export function enemyForLevel(position, { seed = '' } = {}) {
  const settings = getEnemySettings()
  if (settings.source === 'classic')
    return { ...CLASSIC_ENEMY, level: position }
  return generateEnemy(settings.level ?? position, seed)
}
