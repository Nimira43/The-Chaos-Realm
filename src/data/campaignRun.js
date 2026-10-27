import {
  MAX_SPELL_LEVEL,
  STAT_RULES,
  getSpellCatalogue,
} from './wizardRules.js'

const STORAGE_KEY = 'chaosRealm.campaignRuns'
const FORMAT_VERSION = 1
const MAX_STORED_RUNS = 30

export const TEST_CAMPAIGN_LEVELS = 3
export const LEVEL_POOL = Array.from(
  { length: 50 },
  (_, i) => `Level${String(i + 1).padStart(2, '0')}`,
)

function shuffle(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export async function isPlayableLevel(name) {
  try {
    const res = await fetch(`/created-maps/${name}.json`)
    if (!res.ok) return false
    const data = await res.json()

    const shaped =
      Array.isArray(data) &&
      data.length === 32 &&
      data.every((row) => Array.isArray(row) && row.length === 32)
    return shaped && data.some((row) => row.includes('portal'))
  } catch {
    return false
  }
}

export async function pickPlayableLevels(count, pool = LEVEL_POOL) {
  const chosen = []
  for (const name of shuffle(pool)) {
    if (chosen.length >= count) break
    if (await isPlayableLevel(name)) chosen.push(name)
  }
  return chosen
}

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return parsed && Array.isArray(parsed.runs)
      ? parsed.runs.filter(
          (r) => r && r.id && r.clone && Array.isArray(r.levels),
        )
      : []
  } catch {
    return []
  }
}

function writeAll(runs) {
  try {
    const trimmed = runs.slice(-MAX_STORED_RUNS)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: FORMAT_VERSION, runs: trimmed }),
    )
    return true
  } catch {
    return false
  }
}

export function getRun(id) {
  return readAll().find((r) => r.id === id) || null
}

export function saveRun(run) {
  const stamped = { ...run, updatedAt: Date.now() }
  const all = readAll()
  const exists = all.some((r) => r.id === stamped.id)
  writeAll(
    exists
      ? all.map((r) => (r.id === stamped.id ? stamped : r))
      : [...all, stamped],
  )
  return stamped
}

export function deleteRun(id) {
  writeAll(readAll().filter((r) => r.id !== id))
}

export function listResumableRuns() {
  return readAll()
    .filter((r) => r.status === 'playing' || r.status === 'shopping')
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function createRun({ clone, levels, mode = 'campaign3' }) {
  return {
    id: `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    version: FORMAT_VERSION,
    mode,
    wizardName: clone.name,
    clone,
    levels,
    index: 0,
    won: 0,
    earned: 0,
    status: 'playing',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export const getBank = (run) => run.clone.score

export function winLevel(run, points) {
  const gained = Math.max(0, Math.round(points) || 0)
  const won = run.won + 1
  const finished = won >= run.levels.length

  return {
    ...run,
    clone: { ...run.clone, score: run.clone.score + gained },
    earned: run.earned + gained,
    won,
    index: finished ? run.index : run.index + 1,
    status: finished ? 'complete' : 'shopping',
  }
}

export function shopDelta(owned, draft, catalogue = getSpellCatalogue()) {
  let stats = 0
  for (const rule of STAT_RULES)
    stats += (draft.stats[rule.key] - owned.stats[rule.key]) * rule.cost

  let spells = 0
  for (const spell of catalogue) {
    const before = owned.spellLevels[spell.name] || 0
    const after = draft.spellLevels[spell.name] || 0
    spells += (after - before) * spell.manaCost
  }

  return { stats, spells, total: stats + spells }
}

export function applyPurchases(run, draft) {
  const catalogue = getSpellCatalogue()
  const owned = run.clone
  const stats = {}
  const spellLevels = {}

  for (const rule of STAT_RULES) {
    const value = Math.round(Number(draft.stats[rule.key]))
    if (
      !Number.isFinite(value) ||
      value < owned.stats[rule.key] ||
      value > rule.max
    ) {
      return { ok: false, error: `${rule.label} is out of range.` }
    }
    stats[rule.key] = value
  }

  for (const spell of catalogue) {
    const before = owned.spellLevels[spell.name] || 0
    const after = Math.round(Number(draft.spellLevels[spell.name] || 0))
    if (!Number.isFinite(after) || after < before || after > MAX_SPELL_LEVEL) {
      return { ok: false, error: `${spell.name} is out of range.` }
    }
    if (after > 0) spellLevels[spell.name] = after
  }

  const delta = shopDelta(owned, { stats, spellLevels }, catalogue)
  if (delta.total > owned.score)
    return { ok: false, error: 'Not enough points.' }

  return {
    ok: true,
    spent: delta.total,
    run: {
      ...run,
      clone: { ...owned, stats, spellLevels, score: owned.score - delta.total },
      status: 'playing',
    },
  }
}
