import { buildSpellbook } from './spellbook.js'
import {
  CREATION_BUDGET,
  baselineStats,
  getSpellCatalogue,
  isWithinBudget,
  priceBlueprint,
  sanitiseBlueprint,
} from './wizardRules.js'

const STORAGE_KEY = 'chaosRealm.wizardBlueprints'
const LAST_PICK_KEY = 'chaosRealm.lastWizardId'
const FORMAT_VERSION = 1

export const INCLUDE_CLASSIC_WIZARD = true
export const CLASSIC_ID = 'classic'

function buildClassicWizard() {
  const spellLevels = {}
  for (const spell of buildSpellbook()) {
    if (spell.initialSpellLevel > 0)
      spellLevels[spell.name] = spell.initialSpellLevel
  }

  return {
    id: CLASSIC_ID,
    name: 'Classic Wizard',
    builtIn: true,
    stats: {
      max_mana: 600,
      max_ap: 50,
      stamina: 70,
      combat: 10,
      defence: 10,
      magic_resistance: 50,
    },
    spellLevels,
    createdAt: 0,
    updatedAt: 0,
  }
}

function readStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!parsed || !Array.isArray(parsed.blueprints)) return []

    const catalogue = getSpellCatalogue()
    return parsed.blueprints
      .map((b) => sanitiseBlueprint(b, catalogue))
      .filter((b) => b && b.id && isWithinBudget(b, catalogue))
  } catch {
    return []
  }
}

function writeStorage(blueprints) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: FORMAT_VERSION, blueprints }),
    )
    return true
  } catch {
    return false
  }
}

function newId() {
  return `wz_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function listCustomBlueprints() {
  return readStorage()
}

export function listBlueprints() {
  const custom = readStorage()
  return INCLUDE_CLASSIC_WIZARD ? [buildClassicWizard(), ...custom] : custom
}

export function getBlueprint(id) {
  return listBlueprints().find((b) => b.id === id) || null
}

export function newBlueprint() {
  return {
    id: null,
    name: '',
    stats: baselineStats(),
    spellLevels: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function isNameTaken(name, exceptId = null) {
  const wanted = name.trim().toLowerCase()
  return listBlueprints().some(
    (b) => b.id !== exceptId && b.name.trim().toLowerCase() === wanted,
  )
}

export function saveBlueprint(draft) {
  const catalogue = getSpellCatalogue()
  const clean = sanitiseBlueprint(draft, catalogue)
  if (!clean) return { ok: false, error: 'Give your wizard a name first.' }
  if (draft.builtIn || draft.id === CLASSIC_ID)
    return { ok: false, error: 'The Classic Wizard cannot be changed.' }
  if (isNameTaken(clean.name, draft.id))
    return {
      ok: false,
      error: `There is already a wizard called '${clean.name}'.`,
    }
  if (!isWithinBudget(clean, catalogue))
    return {
      ok: false,
      error: `That costs more than ${CREATION_BUDGET} points.`,
    }

  const all = readStorage()
  const now = Date.now()
  const existing = all.find((b) => b.id === draft.id)
  const saved = {
    ...clean,
    id: existing ? existing.id : newId(),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  }
  const next = existing
    ? all.map((b) => (b.id === saved.id ? saved : b))
    : [...all, saved]

  if (!writeStorage(next))
    return {
      ok: false,
      error: 'The browser would not let me save (storage full or blocked).',
    }
  return { ok: true, blueprint: saved }
}

export function deleteBlueprint(id) {
  if (id === CLASSIC_ID) return false
  return writeStorage(readStorage().filter((b) => b.id !== id))
}

export function duplicateBlueprint(id) {
  const source = readStorage().find((b) => b.id === id)
  if (!source)
    return { ok: false, error: 'Only your own wizards can be duplicated.' }

  let name = `${source.name} copy`.slice(0, 24)
  for (let n = 2; isNameTaken(name); n++)
    name = `${source.name.slice(0, 20)} ${n}`
  return saveBlueprint({ ...source, id: null, name })
}

export function cloneBlueprint(blueprint) {
  const copy = JSON.parse(JSON.stringify(blueprint))
  return {
    ...copy,
    templateId: blueprint.id,
    clonedAt: Date.now(),
    score: blueprint.builtIn ? 0 : Math.max(0, priceBlueprint(blueprint).bank),
  }
}

export function rememberPick(id) {
  try {
    localStorage.setItem(LAST_PICK_KEY, id)
  } catch {
    /* private mode: no memory, no harm */
  }
}

export function recallPick() {
  try {
    return localStorage.getItem(LAST_PICK_KEY)
  } catch {
    return null
  }
}

export function exportBlueprints() {
  return JSON.stringify(
    {
      app: 'chaos-realm-wizards',
      version: FORMAT_VERSION,
      blueprints: readStorage(),
    },
    null,
    2,
  )
}

export function importBlueprints(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { added: 0, skipped: 0, error: 'That is not a wizard file.' }
  }

  const incoming = Array.isArray(parsed) ? parsed : parsed?.blueprints
  if (!Array.isArray(incoming))
    return { added: 0, skipped: 0, error: 'That is not a wizard file.' }

  const catalogue = getSpellCatalogue()
  let added = 0
  let skipped = 0

  for (const raw of incoming) {
    const clean = sanitiseBlueprint(raw, catalogue)
    if (!clean || !isWithinBudget(clean, catalogue)) {
      skipped++
      continue
    }

    let name = clean.name
    for (let n = 2; isNameTaken(name); n++)
      name = `${clean.name.slice(0, 20)} ${n}`

    const result = saveBlueprint({ ...clean, id: null, name })
    if (result.ok) added++
    else skipped++
  }

  return { added, skipped }
}
