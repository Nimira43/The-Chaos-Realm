import { useMemo, useState } from 'react' 
import { Link, useSearchParams } from 'react-router-dom' 
import { CREATURES } from '../data/creatures.js' 
import { BESTIARY, BESTIARY_SECTIONS } from '../data/bestiary.js' 
import '../ui/bestiary.css' 

const STATS = [
  ['constitution', 'Constitution'],
  ['combat', 'Combat'],
  ['defence', 'Defence'],
  ['magic_resistance', 'Magic resistance'],
  ['stamina', 'Stamina'],
  ['action_points_ground', 'Action points (ground)'],
  ['action_points_flying', 'Action points (flying)'],
  ['carry_limit', 'Carry limit'],
] 

const TERRAIN = [
  ['water_type', 'Water'],
  ['wood_type', 'Forest'],
  ['rock_type', 'Rock'],
  ['lava_type', 'Lava'],
] 

const statByName = Object.fromEntries(CREATURES.map((c) => [c.name, c])) 
const bySlug = Object.fromEntries(BESTIARY.map((c) => [c.slug, c])) 
const STAT_MAX = Object.fromEntries(
  STATS.map(([k]) => [k, Math.max(...CREATURES.map((c) => c[k] || 0))]),
) 
const SECTION_CLASS = { Good: 'good', Neutral: 'neutral', Evil: 'evil' } 

function Stats({ stats }) {
  if (!stats) return null 
  const traits = [] 
  if (stats.undead) traits.push('Undead') 
  if (stats.mount) traits.push('Can be ridden') 
  if (stats.ride_mounts) traits.push('Can ride mounts') 
  TERRAIN.forEach(([k, label]) => {
    if (stats[k]) traits.push(`${label} dweller`) 
  }) 

  return (
    <section className='bs-block'>
      <h3>In the game</h3>
      <div className='bs-cost'>
        <span>
          <b>{stats.manaCost}</b> mana to summon
        </span>
        <span>
          <b>{stats.victory_points}</b> victory points
        </span>
      </div>
      <ul className='bs-stats'>
        {STATS.map(([k, label]) => {
          if (k === 'action_points_flying' && !stats[k]) return null 
          return (
            <li key={k}>
              <span className='bs-stat-label'>{label}</span>
              <span className='bs-bar'>
                <i
                  style={{
                    width: `${Math.max(3, (stats[k] / STAT_MAX[k]) * 100)}%`,
                  }}
                />
              </span>
              <span className='bs-stat-num'>{stats[k]}</span>
            </li>
          ) 
        })}
      </ul>
      {traits.length > 0 && <p className='bs-traits'>{traits.join(' · ')}</p>}
    </section>
  ) 
}

function Detail({ c, index, list }) {
  const stats = statByName[c.name] 
  const prev = list[(index - 1 + list.length) % list.length] 
  const next = list[(index + 1) % list.length] 
  const q = c.quick 
  const rows = [
    ['Alignment', q.alignment],
    ['Temperament', q.temperament],
    ['Role', q.role],
    ['Strengths', q.strengths],
    ['Weaknesses', q.weaknesses],
    ['Allies', q.allies],
    ['Enemies', q.enemies],
  ] 

  return (
    <article className='bs-detail'>
      <nav className='bs-detail-nav'>
        <Link to='/bestiary' className='bs-link'>
          ‹ All creatures
        </Link>
        <span>
          <Link
            to={`/bestiary?c=${prev.slug}`}
            className='bs-link'
            aria-label={`Previous: ${prev.name}`}
          >
            ‹ {prev.name}
          </Link>
          <Link
            to={`/bestiary?c=${next.slug}`}
            className='bs-link'
            aria-label={`Next: ${next.name}`}
          >
            {next.name} ›
          </Link>
        </span>
      </nav>

      <figure className={`bs-hero ${c.scene ? 'bs-hero-scene' : ''}`}>
        <img
          src={c.hero}
          alt={
            c.scene
              ? `${[c.name, ...c.shownWith.map((s) => bySlug[s].name)].join(', ')}`
              : c.name
          }
        />
      </figure>

      <header className='bs-head'>
        <span className={`bs-badge ${SECTION_CLASS[c.section]}`}>
          {c.quick.alignment}
        </span>
        <h1>{c.name}</h1>
        <p className='bs-tagline'>{c.tagline}</p>
      </header>

      {c.shownWith.length > 0 && (
        <p className='bs-with'>
          Pictured with{' '}
          {c.shownWith.map((s, i) => (
            <span key={s}>
              {i > 0 && ' and '}
              <Link to={`/bestiary?c=${s}`} className='bs-link'>
                {bySlug[s].name}
              </Link>
            </span>
          ))}
        </p>
      )}

      <div className='bs-cols'>
        <div className='bs-body'>
          {c.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <aside className='bs-side'>
          <section className='bs-block'>
            <h3>Quick reference</h3>
            <dl className='bs-quick'>
              {rows.map(([k, v]) =>
                v ? (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          </section>
          <Stats stats={stats} />
          <section className='bs-block'>
            <h3>Keywords</h3>
            <ul className='bs-keywords'>
              {c.keywords.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </article>
  ) 
}

export default function Bestiary() {
  const [params] = useSearchParams() 
  const [section, setSection] = useState('All') 
  const [search, setSearch] = useState('') 
  const open = bySlug[params.get('c')] 

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase() 
    return BESTIARY.filter(
      (c) =>
        (section === 'All' || c.section === section) &&
        (!q ||
          c.name.toLowerCase().includes(q) ||
          c.keywords.some((k) => k.toLowerCase().includes(q)) ||
          c.quick.role.toLowerCase().includes(q)),
    ) 
  }, [section, search]) 

  return (
    <div className='bs-page'>
      <div className='bs-wrap'>
        {open ? (
          <Detail c={open} index={BESTIARY.indexOf(open)} list={BESTIARY} />
        ) : (
          <>
            <header className='bs-top'>
              <Link to='/game-modes' className='bs-link'>
                ‹ Back
              </Link>
              <div>
                <h1 className='bs-title'>The Chaos Realm Bestiary</h1>
                <p className='bs-sub'>
                  {BESTIARY.length} creatures, from the noblest guardians to the
                  darkest horrors
                </p>
              </div>
              <span />
            </header>

            <div className='bs-filters'>
              <div className='bs-tabs' role='tablist'>
                {['All', ...BESTIARY_SECTIONS].map((s) => (
                  <button
                    key={s}
                    role='tab'
                    aria-selected={section === s}
                    className={`bs-tab ${section === s ? 'on' : ''}`}
                    onClick={() => setSection(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input
                className='bs-search'
                type='search'
                placeholder='Search by name, keyword or role'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label='Search creatures'
              />
            </div>

            {shown.length === 0 && (
              <p className='bs-empty'>Nothing in the Realm matches that.</p>
            )}

            {BESTIARY_SECTIONS.map((sec) => {
              const here = shown.filter((c) => c.section === sec) 
              if (!here.length) return null 
              return (
                <section key={sec} className='bs-section'>
                  <h2 className={`bs-sec-head ${SECTION_CLASS[sec]}`}>{sec}</h2>
                  <div className='bs-grid'>
                    {here.map((c) => (
                      <Link
                        key={c.slug}
                        to={`/bestiary?c=${c.slug}`}
                        className='bs-card'
                      >
                        <img src={c.thumb} alt='' loading='lazy' />
                        <span className='bs-card-name'>{c.name}</span>
                        <span
                          className={`bs-card-align ${SECTION_CLASS[c.section]}`}
                        >
                          {c.quick.alignment.split(' / ')[0]}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ) 
            })}
          </>
        )}
      </div>
    </div>
  ) 
}
