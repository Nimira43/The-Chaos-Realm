import { useMemo, useRef, useState } from 'react'
import EditorShell from '../ui/EditorShell.jsx'
import { Stepper } from '../ui/Stepper.jsx'
import '../ui/wizard.css'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CREATION_BUDGET,
  MAX_NAME_LENGTH,
  MAX_SPELL_LEVEL,
  STAT_RULES,
  getSpellCatalogue,
  priceBlueprint,
  spellCost,
  statCost,
} from '../data/wizardRules.js'
import {
  CLASSIC_ID,
  deleteBlueprint,
  duplicateBlueprint,
  exportBlueprints,
  importBlueprints,
  listBlueprints,
  newBlueprint,
  saveBlueprint,
} from '../data/wizardStore.js'

const TABS = ['Stats', 'Spellbook']

const snapshot = (draft) =>
  JSON.stringify({ n: draft.name, s: draft.stats, l: draft.spellLevels })

export default function WizardEditor() {
  const catalogue = useMemo(() => getSpellCatalogue(), [])
  const fileInputRef = useRef(null)

  const [blueprints, setBlueprints] = useState(() => listBlueprints())
  const [draft, setDraft] = useState(() => {
    const first = listBlueprints().find((b) => !b.builtIn)
    return first || newBlueprint()
  })
  const [saved, setSaved] = useState(() => snapshot(draft))
  const [tab, setTab] = useState('Spellbook')
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(null)
  const [toast, setToast] = useState(null)

  const readOnly = !!draft.builtIn
  const dirty = snapshot(draft) !== saved
  const price = priceBlueprint(draft, catalogue)
  const bank = price.bank

  function showToast(message, isError = false) {
    setToast({ message, isError })
    setTimeout(() => setToast(null), 2600)
  }

  function refresh(selectId) {
    const all = listBlueprints()
    setBlueprints(all)
    const target = all.find((b) => b.id === selectId)
    if (target) load(target)
  }

  function load(blueprint) {
    setDraft(blueprint)
    setSaved(snapshot(blueprint))
    setDialog(null)
  }

  function guard(action) {
    if (dirty && !readOnly) setDialog({ type: 'discard', action })
    else action()
  }

  function select(id) {
    if (id === draft.id) return
    guard(() => load(blueprints.find((b) => b.id === id)))
  }

  function startNew() {
    guard(() => load(newBlueprint()))
  }

  function setStat(key, value) {
    setDraft((d) => ({ ...d, stats: { ...d.stats, [key]: value } }))
  }

  function setLevel(name, level) {
    setDraft((d) => {
      const spellLevels = { ...d.spellLevels }
      if (level > 0) spellLevels[name] = level
      else delete spellLevels[name]
      return { ...d, spellLevels }
    })
  }

  const maxFor = (key) => {
    const rule = STAT_RULES.find((r) => r.key === key)
    const free = bank + statCost(key, draft.stats[key])
    return Math.min(rule.max, rule.base + Math.floor(free / rule.cost))
  }

  const maxLevelFor = (spell) => {
    const free =
      bank + spellCost(spell.manaCost, draft.spellLevels[spell.name] || 0)
    return Math.min(MAX_SPELL_LEVEL, Math.floor(free / spell.manaCost))
  }

  function save() {
    const result = saveBlueprint(draft)
    if (!result.ok) return showToast(result.error, true)
    refresh(result.blueprint.id)
    showToast(`Saved ${result.blueprint.name}`)
  }

  function duplicate() {
    const result = duplicateBlueprint(draft.id)
    if (!result.ok) return showToast(result.error, true)
    refresh(result.blueprint.id)
    showToast(`Made ${result.blueprint.name}`)
  }

  function remove() {
    const name = draft.name
    deleteBlueprint(draft.id)
    setDialog(null)
    const all = listBlueprints()
    setBlueprints(all)
    load(all.find((b) => !b.builtIn) || newBlueprint())
    showToast(`Deleted ${name}`)
  }

  function exportFile() {
    const blob = new Blob([exportBlueprints()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'chaos-realm-wizards.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const result = importBlueprints(await file.text())
    if (result.error) return showToast(result.error, true)

    setBlueprints(listBlueprints())
    showToast(
      `Imported ${result.added} wizard${result.added === 1 ? '' : 's'}${result.skipped ? `, skipped ${result.skipped}` : ''}`,
      result.added === 0,
    )
  }

  const term = search.trim().toLowerCase()
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    spells: catalogue.filter(
      (s) =>
        s.category === category &&
        (!term || s.name.toLowerCase().includes(term)),
    ),
  })).filter((g) => g.spells.length > 0)

  const owned = catalogue.filter((s) => draft.spellLevels[s.name] > 0)
  const spentPct = Math.min(100, (price.spent / CREATION_BUDGET) * 100)
  const statsPct = Math.min(100, (price.stats / CREATION_BUDGET) * 100)
  const over = bank < 0
  const castShortfall = price.manaToCastAll - draft.stats.max_mana

  return (
    <EditorShell
      title='Wizard Editor'
      subtitle={
        dirty && !readOnly
          ? 'Unsaved changes'
          : `${CREATION_BUDGET} points to spend`
      }
      actions={
        <>
          <button className='btn btn-ghost' onClick={exportFile}>
            Export
          </button>
          <button
            className='btn btn-ghost'
            onClick={() => fileInputRef.current?.click()}
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type='file'
            accept='application/json,.json'
            hidden
            onChange={importFile}
          />
          <button
            className='btn btn-primary'
            onClick={save}
            disabled={readOnly || !dirty}
          >
            Save
          </button>
        </>
      }
    >
      <div className='wizard-body'>
        <aside className='wizard-column left'>
          <section>
            <h2 className='panel-title'>Wizards</h2>
            <div className='wz-roster'>
              {blueprints.map((b) => (
                <button
                  key={b.id}
                  className={`wz-roster-item ${b.id === draft.id ? 'active' : ''}`}
                  onClick={() => select(b.id)}
                >
                  <span className='wz-roster-name'>{b.name}</span>
                  {b.builtIn && <span className='wz-badge'>Built-in</span>}
                </button>
              ))}
              <button
                className={`wz-roster-item ${draft.id === null ? 'active' : ''}`}
                onClick={startNew}
              >
                <span className='wz-roster-name'>＋ New wizard</span>
              </button>
            </div>
          </section>

          <section>
            <h2 className='panel-title'>Identity</h2>
            <div className='field'>
              <label htmlFor='wizard-name'>Name</label>
              <input
                id='wizard-name'
                value={draft.name}
                maxLength={MAX_NAME_LENGTH}
                placeholder='Name your wizard'
                disabled={readOnly}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
              />
            </div>
          </section>

          {readOnly ? (
            <div className='wz-banner'>
              This is the wizard the game was built with, kept for testing
              levels. He ignores the {CREATION_BUDGET}-point limit and can't be
              changed.
            </div>
          ) : draft.id ? (
            <div className='wz-row-actions'>
              <button
                className='btn btn-ghost'
                onClick={() => guard(duplicate)}
              >
                Duplicate
              </button>
              <button
                className='btn btn-ghost'
                onClick={() => setDialog({ type: 'delete' })}
              >
                Delete
              </button>
            </div>
          ) : null}
        </aside>

        <main className='wizard-stage'>
          <div className='tabs'>
            {TABS.map((t) => (
              <button
                key={t}
                className={`tab ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Stats' && (
            <div className='wz-list'>
              <p className='help-text'>
                Every point above the starting value costs 1 point. Health is
                always 100 at the start of a level.
              </p>
              {STAT_RULES.map((rule) => {
                const value = draft.stats[rule.key]
                const cost = statCost(rule.key, value)
                return (
                  <div
                    key={rule.key}
                    className={`wz-row ${cost > 0 ? 'has-value' : ''}`}
                  >
                    <div>
                      <div className='wz-row-title'>{rule.label}</div>
                      <div className='wz-row-sub'>{rule.note}</div>
                    </div>
                    <Stepper
                      value={value}
                      min={rule.base}
                      max={maxFor(rule.key)}
                      disabled={readOnly}
                      onChange={(v) => setStat(rule.key, v)}
                    />
                    <div className='wz-limits'>
                      start {rule.base} · max{' '}
                      {rule.max === Infinity ? 'no limit' : rule.max}
                    </div>
                    <div className='wz-cost'>
                      {cost > 0 ? `${cost} pts` : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'Spellbook' && (
            <div className='wz-list'>
              <div className='wz-toolbar'>
                <input
                  placeholder='Find a spell…'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className='help-text'>
                  Cost is mana cost × level, up to level {MAX_SPELL_LEVEL}.
                </span>
              </div>

              {groups.map((group) => (
                <div key={group.category} className='wz-list'>
                  <h3 className='wz-group-title'>
                    {CATEGORY_LABELS[group.category]}
                  </h3>
                  {group.spells.map((spell) => {
                    const level = draft.spellLevels[spell.name] || 0
                    return (
                      <div
                        key={spell.name}
                        className={`wz-row ${level > 0 ? 'has-value' : ''}`}
                      >
                        <div>
                          <div className='wz-row-title'>{spell.name}</div>
                          <div className='wz-row-sub'>
                            {spell.manaCost} per level
                          </div>
                        </div>
                        <Stepper
                          value={level}
                          min={0}
                          max={maxLevelFor(spell)}
                          disabled={readOnly}
                          onChange={(v) => setLevel(spell.name, v)}
                        />
                        <div className='wz-limits'>
                          level {level} of {MAX_SPELL_LEVEL}
                        </div>
                        <div className='wz-cost'>
                          {level > 0
                            ? `${spellCost(spell.manaCost, level)} pts`
                            : '—'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {groups.length === 0 && (
                <div className='empty-state'>
                  <span>No spell matches '{search}'.</span>
                </div>
              )}
            </div>
          )}
        </main>

        <aside className='wizard-column right'>
          <section>
            <h2 className='panel-title'>Points</h2>
            <div className='wz-bank'>
              <span className={`wz-bank-number ${over ? 'over' : ''}`}>
                {over ? price.spent - CREATION_BUDGET : bank}
              </span>
              <span className='wz-bank-label'>
                {over ? 'over budget' : 'left to spend'}
              </span>
            </div>
            <div
              className='wz-bar'
              style={{ marginTop: 14 }}
              aria-hidden='true'
            >
              <div className='wz-bar-stats' style={{ width: `${statsPct}%` }} />
              <div
                className='wz-bar-spells'
                style={{ width: `${Math.max(0, spentPct - statsPct)}%` }}
              />
            </div>
          </section>

          <section>
            <div className='wz-legend'>
              <div>
                <span>
                  <i className='wz-dot' style={{ background: '#c98a2b' }} />
                  Stats
                </span>
                <strong>{price.stats}</strong>
              </div>
              <div>
                <span>
                  <i className='wz-dot' style={{ background: 'var(--main)' }} />
                  Spells
                </span>
                <strong>{price.spells}</strong>
              </div>
              <div>
                <span>Spent</span>
                <strong>
                  {price.spent} / {CREATION_BUDGET}
                </strong>
              </div>
              <div>
                <span>Banked for later</span>
                <strong>{Math.max(0, bank)}</strong>
              </div>
            </div>
            <p className='help-text' style={{ marginTop: 10 }}>
              Unspent points are kept and can be spent once the game is under
              way.
            </p>
          </section>

          <section>
            <h2 className='panel-title'>Casting</h2>
            <p className='help-text'>
              Casting every spell once needs{' '}
              <strong>{price.manaToCastAll}</strong> mana. He has{' '}
              <strong>{draft.stats.max_mana}</strong>.
            </p>
            <p
              className={`help-text ${castShortfall > 0 ? 'wz-warn' : 'wz-good'}`}
              style={{ marginTop: 6 }}
            >
              {castShortfall > 0
                ? `Short by ${castShortfall}: he can't cast the whole book in one level.`
                : `Enough mana to cast the whole book once, with ${-castShortfall} to spare.`}
            </p>
          </section>

          <section>
            <h2 className='panel-title'>Spellbook</h2>
            {owned.length === 0 ? (
              <p className='help-text'>No spells chosen yet.</p>
            ) : (
              <div className='wz-chips'>
                {owned.map((s) => (
                  <span key={s.name} className='wz-chip'>
                    {s.name} ×{draft.spellLevels[s.name]}
                  </span>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {dialog?.type === 'discard' && (
        <div className='modal' onClick={() => setDialog(null)}>
          <div className='modal-content' onClick={(e) => e.stopPropagation()}>
            <h2>Discard changes?</h2>
            <p>{draft.name || 'This wizard'} has changes you haven't saved.</p>
            <div className='modal-actions'>
              <button className='btn btn-ghost' onClick={() => setDialog(null)}>
                Keep editing
              </button>
              <button
                className='btn btn-primary'
                onClick={() => {
                  const { action } = dialog
                  setDialog(null)
                  action()
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog?.type === 'delete' && (
        <div className='modal' onClick={() => setDialog(null)}>
          <div className='modal-content' onClick={(e) => e.stopPropagation()}>
            <h2>Delete {draft.name}?</h2>
            <p>
              Games already started with this wizard keep their own copy and are
              not affected.
            </p>
            <div className='modal-actions'>
              <button className='btn btn-ghost' onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className='btn btn-primary' onClick={remove}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.isError ? 'error' : ''}`}>
          {toast.message}
        </div>
      )}
    </EditorShell>
  )
}