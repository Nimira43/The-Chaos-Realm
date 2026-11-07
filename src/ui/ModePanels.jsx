import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Stepper } from './Stepper.jsx'
import {
  MODE_LABELS,
  TIERS,
  canLoot,
  deleteRun,
  listAllRuns,
  listPlayableLevels,
  lootUnlocked,
  runTitle,
} from '../data/campaignRun.js'
import './gameModes.css'

function Panel({ title, intro, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className='modal' onClick={onClose}>
      <div
        className={`modal-content gm-panel ${wide ? 'gm-panel-wide' : ''}`}
        role='dialog'
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='gm-panel-head'>
          <h2>{title}</h2>
          <button
            className='gm-panel-close'
            onClick={onClose}
            aria-label='Close'
          >
            ×
          </button>
        </div>
        {intro && <p className='gm-panel-intro'>{intro}</p>}
        {children}
      </div>
    </div>
  )
}

const progressOf = (run) =>
  run.status === 'complete'
    ? 'Complete'
    : run.status === 'shopping'
      ? `In the shop after level ${run.won} of ${run.levels.length}`
      : `Level ${run.index + 1} of ${run.levels.length}`

export function SavesPanel({ kind, onClose }) {
  const [runs, setRuns] = useState(() => listAllRuns())
  const [confirming, setConfirming] = useState(null)
  const loot = kind === 'loot'

  function remove(id) {
    if (confirming !== id) {
      setConfirming(id)
      return
    }
    deleteRun(id)
    setConfirming(null)
    setRuns(listAllRuns())
  }

  return (
    <Panel
      title={loot ? 'Loot Mode' : 'Continue'}
      intro={
        loot
          ? 'Pick the save to top up. One treasure map, 100 action points, no enemy and no spells. Whatever you carry home goes into that save’s points.'
          : 'Your saved runs, newest first.'
      }
      onClose={onClose}
    >
      {runs.length === 0 ? (
        <div className='gm-empty'>
          No saves yet. Start a campaign and it will be kept here.
        </div>
      ) : (
        <ul className='gm-saves'>
          {runs.map((run) => {
            const done = run.status === 'complete'
            const lootable = canLoot(run)
            const reason = done
              ? 'Run finished'
              : !lootUnlocked(run)
                ? 'Win level 1 to unlock'
                : ''

            const body = (
              <>
                <span className='gm-save-title'>{runTitle(run)}</span>
                <span className='gm-save-sub'>
                  {run.wizardName} · {MODE_LABELS[run.mode] || 'Campaign'} ·{' '}
                  {progressOf(run)} · {run.clone.score} pts
                </span>
                {loot && reason && (
                  <span className='gm-save-reason'>{reason}</span>
                )}
              </>
            )

            const open = loot ? lootable : !done
            const to = loot ? `/game?loot=${run.id}` : `/game?run=${run.id}`

            return (
              <li
                key={run.id}
                className={`gm-save ${open ? '' : 'gm-save-off'}`}
              >
                {open ? (
                  <Link to={to} className='gm-save-main'>
                    {body}
                  </Link>
                ) : (
                  <div className='gm-save-main' aria-disabled='true'>
                    {body}
                  </div>
                )}

                {!loot && (
                  <button
                    className={`gm-save-delete ${confirming === run.id ? 'sure' : ''}`}
                    onClick={() => remove(run.id)}
                    onBlur={() =>
                      setConfirming((c) => (c === run.id ? null : c))
                    }
                    aria-label={`Delete ${runTitle(run)}`}
                  >
                    {confirming === run.id ? 'Sure?' : 'Delete'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

function usePlayable() {
  const [playable, setPlayable] = useState(null) // null while loading
  useEffect(() => {
    let live = true
    listPlayableLevels().then((list) => {
      if (live) setPlayable(list)
    })
    return () => {
      live = false
    }
  }, [])
  return playable
}

export function RandomPanel({ onClose }) {
  const playable = usePlayable()
  const [tierName, setTierName] = useState('Low')
  const [wanted, setWanted] = useState(5)

  const counts = useMemo(() => {
    const set = new Set(playable || [])
    return Object.fromEntries(
      TIERS.map((t) => [t.name, t.levels.filter((n) => set.has(n)).length]),
    )
  }, [playable])

  const available = counts[tierName] || 0
  const count = Math.min(wanted, available)

  return (
    <Panel
      title='Random Mode'
      intro='Choose a tier and how many levels to fight. They are drawn at random from that tier, and the wizard you face grows stronger with each level, just as in the Main Campaign.'
      onClose={onClose}
    >
      <div className='gm-tiers' role='radiogroup' aria-label='Tier'>
        {TIERS.map((t) => (
          <button
            key={t.name}
            role='radio'
            aria-checked={tierName === t.name}
            className={`gm-tier ${tierName === t.name ? 'on' : ''}`}
            onClick={() => setTierName(t.name)}
            disabled={playable !== null && counts[t.name] === 0}
          >
            <strong>{t.name}</strong>
            <span>{playable === null ? '…' : `${counts[t.name]} levels`}</span>
          </button>
        ))}
      </div>

      <div className='gm-count'>
        <span>How many levels?</span>
        {available > 0 ? (
          <Stepper
            value={Math.max(1, count)}
            min={1}
            max={available}
            onChange={setWanted}
          />
        ) : (
          <span className='gm-muted'>
            {playable === null
              ? 'Checking the levels…'
              : 'No playable levels in this tier'}
          </span>
        )}
      </div>

      <div className='gm-panel-foot'>
        {available > 0 ? (
          <Link
            className='gm-go'
            to={`/game?campaign=random&tier=${tierName}&count=${Math.max(1, count)}`}
          >
            Choose a wizard ›
          </Link>
        ) : (
          <span className='gm-go gm-go-off'>Choose a wizard ›</span>
        )}
      </div>
    </Panel>
  )
}

export function SelectPanel({ onClose }) {
  const playable = usePlayable()
  const [picks, setPicks] = useState([])

  const ready = useMemo(() => new Set(playable || []), [playable])
  const toggle = (name) =>
    setPicks((p) =>
      p.includes(name) ? p.filter((n) => n !== name) : [...p, name],
    )

  return (
    <Panel
      title='Select Mode'
      intro='Tap the levels you want, in the order you want to fight them. The first level you pick gets the weakest enemy wizard, and each one after is stronger.'
      onClose={onClose}
      wide
    >
      {playable === null ? (
        <div className='gm-empty'>Checking the levels…</div>
      ) : (
        <div className='gm-select-body'>
          {TIERS.map((tier) => {
            const here = tier.levels.filter((n) => ready.has(n))
            if (here.length === 0) return null
            return (
              <section key={tier.name}>
                <h3 className='gm-select-tier'>{tier.name}</h3>
                <div className='gm-tiles'>
                  {here.map((name) => {
                    const at = picks.indexOf(name)
                    return (
                      <button
                        key={name}
                        className={`gm-tile ${at >= 0 ? 'on' : ''}`}
                        aria-pressed={at >= 0}
                        onClick={() => toggle(name)}
                      >
                        <span className='gm-tile-name'>
                          {name.replace('Level', '')}
                        </span>
                        {at >= 0 && (
                          <span className='gm-tile-order'>{at + 1}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <div className='gm-order'>
        {picks.length === 0 ? (
          <span className='gm-muted'>Nothing picked yet.</span>
        ) : (
          <>
            <span className='gm-order-label'>Your order:</span>
            {picks.map((n, i) => (
              <span key={n} className='gm-chip'>
                {i + 1}. {n.replace('Level', '')}
              </span>
            ))}
          </>
        )}
      </div>

      <div className='gm-panel-foot'>
        <button
          className='gm-clear'
          onClick={() => setPicks([])}
          disabled={picks.length === 0}
        >
          Clear
        </button>
        {picks.length > 0 ? (
          <Link
            className='gm-go'
            to={`/game?campaign=select&levels=${picks.join(',')}`}
          >
            Choose a wizard ›
          </Link>
        ) : (
          <span className='gm-go gm-go-off'>Choose a wizard ›</span>
        )}
      </div>
    </Panel>
  )
}
