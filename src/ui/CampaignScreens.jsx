import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Stepper } from './Stepper.jsx'
import './wizard.css'
import './campaign.css'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MAX_SPELL_LEVEL,
  STAT_RULES,
  getSpellCatalogue,
  priceBlueprint,
} from '../data/wizardRules.js'
import { getBank, shopDelta } from '../data/campaignRun.js'
import './enemy.css'

const TABS = ['Spellbook', 'Stats']

export function CampaignShop({ run, result, nextEnemy, onContinue }) {
  const catalogue = useMemo(() => getSpellCatalogue(), [])
  const owned = run.clone

  const [draft, setDraft] = useState(() => ({
    stats: { ...owned.stats },
    spellLevels: { ...owned.spellLevels },
  }))
  const [tab, setTab] = useState('Spellbook')
  const [search, setSearch] = useState('')

  const bank = getBank(run)
  const delta = shopDelta(owned, draft, catalogue)
  const left = bank - delta.total
  const nextLevel = run.index + 1
  const price = priceBlueprint(draft, catalogue)
  const castShortfall = price.manaToCastAll - draft.stats.max_mana

  const ownedLevel = (spell) => owned.spellLevels[spell.name] || 0
  const draftLevel = (spell) => draft.spellLevels[spell.name] || 0

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

  const maxStat = (rule) =>
    Math.min(rule.max, draft.stats[rule.key] + Math.floor(left / rule.cost))
  const maxLevel = (spell) =>
    Math.min(
      MAX_SPELL_LEVEL,
      draftLevel(spell) + Math.floor(left / spell.manaCost),
    )

  const term = search.trim().toLowerCase()
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    spells: catalogue.filter(
      (s) =>
        s.category === category &&
        (!term || s.name.toLowerCase().includes(term)),
    ),
  })).filter((g) => g.spells.length > 0)

  return (
    <div className='modal'>
      <div
        className='modal-content shop-modal game-over-content victory'
        role='dialog'
        aria-label='Shop'
      >
        <div className='shop-head'>
          <div>
            <h2>Level {run.won} complete!</h2>
            <p>
              {result?.earned > 0 ? `You earned ${result.earned} points. ` : ''}
              Spend them in the shop, then on to level {nextLevel} of{' '}
              {run.levels.length}.
            </p>
            {nextEnemy && (
              <p className='shop-next-enemy'>
                Next wizard: <b>{nextEnemy.name}</b>
                {nextEnemy.budget ? ` · power ${nextEnemy.budget}` : ''}
              </p>
            )}
          </div>

          <div className='shop-bank'>
            <div className={`shop-bank-number ${left === 0 ? 'zero' : ''}`}>
              {left}
            </div>
            <div className='shop-bank-label'>points to spend</div>
          </div>
        </div>

        <div className='shop-tabs'>
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
        </div>

        <div className='shop-body'>
          {tab === 'Stats' && (
            <div className='wz-list'>
              {STAT_RULES.map((rule) => {
                const value = draft.stats[rule.key]
                const spent = (value - owned.stats[rule.key]) * rule.cost
                const atMax = rule.max !== Infinity && value >= rule.max
                return (
                  <div
                    key={rule.key}
                    className={`wz-row ${spent > 0 ? 'has-value' : ''}`}
                  >
                    <div>
                      <div className='wz-row-title'>{rule.label}</div>
                      <div className='wz-row-sub'>{rule.note}</div>
                    </div>
                    <Stepper
                      value={value}
                      min={owned.stats[rule.key]}
                      max={maxStat(rule)}
                      onChange={(v) => setStat(rule.key, v)}
                    />
                    <div className='wz-limits'>
                      {atMax
                        ? 'at the maximum'
                        : `max ${rule.max === Infinity ? 'no limit' : rule.max}`}
                    </div>
                    <div className='wz-cost'>
                      {spent > 0 ? `${spent} pts` : '—'}
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
                  Each level costs the spell's mana cost, up to level{' '}
                  {MAX_SPELL_LEVEL}.
                </span>
              </div>

              {groups.map((group) => (
                <div key={group.category} className='wz-list'>
                  <h3 className='wz-group-title'>
                    {CATEGORY_LABELS[group.category]}
                  </h3>
                  {group.spells.map((spell) => {
                    const level = draftLevel(spell)
                    const spent = (level - ownedLevel(spell)) * spell.manaCost
                    return (
                      <div
                        key={spell.name}
                        className={`wz-row ${spent > 0 ? 'has-value' : ''}`}
                      >
                        <div>
                          <div className='wz-row-title'>{spell.name}</div>
                          <div className='wz-row-sub'>
                            {spell.manaCost} per level
                          </div>
                        </div>
                        <Stepper
                          value={level}
                          min={ownedLevel(spell)}
                          max={maxLevel(spell)}
                          onChange={(v) => setLevel(spell.name, v)}
                        />
                        <div className='wz-limits'>
                          {ownedLevel(spell) > 0
                            ? `you own level ${ownedLevel(spell)}`
                            : `level ${level} of ${MAX_SPELL_LEVEL}`}
                        </div>
                        <div className='wz-cost'>
                          {spent > 0 ? `${spent} pts` : '—'}
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
        </div>

        <div className='shop-foot'>
          <span className={`shop-note ${castShortfall > 0 ? 'wz-warn' : ''}`}>
            {castShortfall > 0
              ? `Casting the whole book once needs ${price.manaToCastAll} mana you have ${draft.stats.max_mana}.`
              : `Mana ${draft.stats.max_mana} covers casting the whole book once (${price.manaToCastAll}).`}
          </span>
          <button
            className='btn btn-ghost'
            onClick={() =>
              setDraft({
                stats: { ...owned.stats },
                spellLevels: { ...owned.spellLevels },
              })
            }
            disabled={delta.total === 0}
          >
            Undo purchases
          </button>
          <button className='btn btn-primary' onClick={() => onContinue(draft)}>
            Start level {nextLevel} ›
          </button>
        </div>
      </div>
    </div>
  )
}

export function CampaignComplete({ run }) {
  return (
    <div className='modal'>
      <div className='modal-content game-over-content victory'>
        <h2>Congratulations!</h2>
        <p>
          {run.wizardName} fought through all {run.levels.length} levels and
          made it to the portal every time.
        </p>

        <div className='campaign-stats'>
          <div className='campaign-stat'>
            <strong>{run.won}</strong>
            <span>Levels won</span>
          </div>
          <div className='campaign-stat'>
            <strong>{run.earned}</strong>
            <span>Points earned</span>
          </div>
        </div>
        <p className='campaign-tag'>{getBank(run)} points left unspent.</p>

        <Link to='/' style={{ textDecoration: 'none' }}>
          <button className='btn btn-primary' style={{ width: '100%' }}>
            Back to Home
          </button>
        </Link>
      </div>
    </div>
  )
}

export function CampaignDefeat({ run, message }) {
  return (
    <div className='modal'>
      <div className='modal-content game-over-content defeat'>
        <h2>Defeated</h2>
        {message && <p>{message}</p>}
        <p>
          {run.wizardName} fell on level {run.index + 1} of {run.levels.length}.
          The run is over.
        </p>

        <div className='campaign-stats'>
          <div className='campaign-stat'>
            <strong>{run.won}</strong>
            <span>Levels won</span>
          </div>
          <div className='campaign-stat'>
            <strong>{run.earned}</strong>
            <span>Points earned</span>
          </div>
        </div>

        <Link to='/' style={{ textDecoration: 'none' }}>
          <button className='btn btn-primary' style={{ width: '100%' }}>
            Back to Home
          </button>
        </Link>
      </div>
    </div>
  )
}
