import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listBlueprints,
  cloneBlueprint,
  rememberPick,
  recallPick,
} from '../data/wizardStore.js'
import { priceBlueprint } from '../data/wizardRules.js'
import './wizard.css'

function describeSpells(blueprint) {
  const entries = Object.entries(blueprint.spellLevels).filter(
    ([, level]) => level > 0,
  )
  if (entries.length === 0) return 'No spells yet'

  const shown = entries
    .slice(0, 4)
    .map(([name, level]) => `${name} ×${level}`)
    .join(', ')
  const more = entries.length - 4
  return more > 0 ? `${shown} and ${more} more` : shown
}

export default function WizardPicker({ onConfirm, onClose, canClose }) {
  const [blueprints] = useState(() => listBlueprints())
  const [selectedId, setSelectedId] = useState(() => {
    const last = recallPick()
    const all = listBlueprints()
    return all.some((b) => b.id === last) ? last : (all[0]?.id ?? null)
  })

  const selected = blueprints.find((b) => b.id === selectedId) || null

  function confirm(blueprint = selected) {
    if (!blueprint) return
    rememberPick(blueprint.id)
    onConfirm(cloneBlueprint(blueprint))
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && canClose) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canClose, onClose])

  return (
    <div
      className='modal'
      onClick={() => {
        if (canClose) onClose()
      }}
    >
      <div
        className='modal-content wz-picker'
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Choose your wizard</h2>

        {blueprints.length === 0 ? (
          <p>
            You haven't made a wizard yet. Open the Wizard Editor to create one.
          </p>
        ) : (
          <div
            className='wz-picker-list'
            role='radiogroup'
            aria-label='Wizard blueprints'
          >
            {blueprints.map((b) => {
              const price = priceBlueprint(b)
              return (
                <div
                  key={b.id}
                  role='radio'
                  aria-checked={b.id === selectedId}
                  tabIndex={0}
                  className={`wz-card ${b.id === selectedId ? 'selected' : ''}`}
                  onClick={() => setSelectedId(b.id)}
                  onDoubleClick={() => confirm(b)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedId(b.id)
                    }
                  }}
                >
                  <div className='wz-card-head'>
                    <span className='wz-card-name'>{b.name}</span>
                    {b.builtIn ? (
                      <span className='wz-badge'>Built-in</span>
                    ) : (
                      <span className='wz-badge'>
                        {Math.max(0, price.bank)} banked
                      </span>
                    )}
                  </div>

                  <div className='wz-card-stats'>
                    <span>
                      Mana <b>{b.stats.max_mana}</b>
                    </span>
                    <span>
                      AP <b>{b.stats.max_ap}</b>
                    </span>
                    <span>
                      Stamina <b>{b.stats.stamina}</b>
                    </span>
                    <span>
                      Combat <b>{b.stats.combat}</b>
                    </span>
                    <span>
                      Defence <b>{b.stats.defence}</b>
                    </span>
                    <span>
                      Magic res <b>{b.stats.magic_resistance}</b>
                    </span>
                  </div>

                  <div className='wz-card-spells'>{describeSpells(b)}</div>
                </div>
              )
            })}
          </div>
        )}

        <div className='wz-picker-footer'>
          <Link to='/wizard-editor'>Wizard Editor ›</Link>

          <div className='modal-actions' style={{ margin: 0 }}>
            {canClose && (
              <button className='btn btn-ghost' onClick={onClose}>
                Cancel
              </button>
            )}
            <button
              className='btn btn-primary'
              onClick={() => confirm()}
              disabled={!selected}
            >
              Start level
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
