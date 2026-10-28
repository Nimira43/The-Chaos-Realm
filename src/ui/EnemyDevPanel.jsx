import { useMemo, useState } from 'react'
import { generateEnemy } from '../data/enemyGenerator.js'
import {
  MAX_DEV_LEVEL,
  getEnemySettings,
  saveEnemySettings,
} from '../data/enemyForLevel.js'
import { ENEMY_BOUNTY } from '../data/enemyRules.js'
import './enemy.css'

export default function EnemyDevPanel() {
  const [settings, setSettings] = useState(() => getEnemySettings())
  const [levelText, setLevelText] = useState(
    () => getEnemySettings().level ?? '',
  )
  const [roll, setRoll] = useState(1)

  const previewLevel = settings.level ?? 1
  const enemy = useMemo(
    () =>
      settings.source === 'generated'
        ? generateEnemy(previewLevel, `preview${roll}`)
        : null,
    [settings.source, previewLevel, roll],
  )

  function update(patch) {
    setSettings(saveEnemySettings(patch))
  }

  function onLevelChange(text) {
    setLevelText(text)
    const n = parseInt(text, 10)
    if (text.trim() === '') update({ level: null })
    else if (!Number.isNaN(n))
      update({ level: Math.min(MAX_DEV_LEVEL, Math.max(1, n)) })
  }

  const spells = enemy
    ? Object.entries(enemy.spellLevels).sort((a, b) => b[1] - a[1])
    : []

  return (
    <details className='en-dev'>
      <summary>
        Developer · enemy wizard{' '}
        <span className='en-dev-now'>
          {settings.source === 'generated' ? 'Generated' : 'Classic Wizard'}
        </span>
      </summary>

      <div className='en-dev-body'>
        <div className='en-dev-row' role='radiogroup' aria-label='Enemy wizard'>
          <label
            className={`en-opt ${settings.source === 'classic' ? 'on' : ''}`}
          >
            <input
              type='radio'
              name='enemy-source'
              checked={settings.source === 'classic'}
              onChange={() => update({ source: 'classic' })}
            />
            Classic Wizard
          </label>
          <label
            className={`en-opt ${settings.source === 'generated' ? 'on' : ''}`}
          >
            <input
              type='radio'
              name='enemy-source'
              checked={settings.source === 'generated'}
              onChange={() => update({ source: 'generated' })}
            />
            Generated
          </label>
        </div>

        {settings.source === 'generated' && (
          <>
            <div className='en-dev-row'>
              <label className='en-level'>
                Enemy level
                <input
                  className='wz-num'
                  type='number'
                  min='1'
                  max={MAX_DEV_LEVEL}
                  placeholder='auto'
                  value={levelText}
                  onChange={(e) => onLevelChange(e.target.value)}
                />
              </label>
              <span className='en-hint'>
                {settings.level
                  ? `Every level uses the level ${settings.level} wizard.`
                  : 'Blank: he follows the level you have reached. The sample is level 1.'}
              </span>
              <button
                className='btn btn-ghost'
                onClick={() => setRoll((r) => r + 1)}
              >
                Roll another
              </button>
            </div>

            {enemy && (
              <div className='en-card'>
                <div className='en-card-head'>
                  <span className='en-name'>{enemy.name}</span>
                  <span className='wz-badge'>
                    level {enemy.level} · power {enemy.budget}
                  </span>
                </div>
                <div className='en-blurb'>
                  {enemy.archetypeTitle}: {enemy.blurb} Kill bounty{' '}
                  {ENEMY_BOUNTY}.
                </div>
                <div className='wz-card-stats'>
                  <span>
                    Mana <b>{enemy.stats.max_mana}</b>
                  </span>
                  <span>
                    AP <b>{enemy.stats.max_ap}</b>
                  </span>
                  <span>
                    Stamina <b>{enemy.stats.stamina}</b>
                  </span>
                  <span>
                    Combat <b>{enemy.stats.combat}</b>
                  </span>
                  <span>
                    Defence <b>{enemy.stats.defence}</b>
                  </span>
                  <span>
                    Magic res <b>{enemy.stats.magic_resistance}</b>
                  </span>
                </div>
                <div className='en-spells'>
                  {spells.map(([name, level]) => (
                    <span key={name} className='en-spell'>
                      {name} ×{level}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  )
}
