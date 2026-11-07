import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllRuns, listResumableRuns } from '../data/campaignRun.js'
import { RandomPanel, SavesPanel, SelectPanel } from '../ui/ModePanels.jsx'
import '../ui/gameModes.css'

function buildGroups(resumable, saveCount) {
  const campaigns = []

  if (saveCount > 0) {
    campaigns.push({
      panel: 'continue',
      title: 'Continue',
      sub: resumable
        ? `${saveCount} save${saveCount === 1 ? '' : 's'} · latest: ${resumable.saveName || resumable.wizardName}`
        : `${saveCount} save${saveCount === 1 ? '' : 's'}, all finished`,
      highlight: !!resumable,
    })
  }

  campaigns.push(
    {
      to: '/game?campaign=main',
      title: 'Main Campaign',
      sub: 'Fifty levels, a shop between each, and a wizard who grows with you',
    },
    {
      panel: 'random',
      title: 'Random Mode',
      sub: 'Pick a tier and a number the levels are drawn at random',
    },
    {
      panel: 'select',
      title: 'Select Mode',
      sub: 'Choose the levels you want to fight through, in your order',
    },
    {
      panel: 'loot',
      title: 'Loot Mode',
      sub: 'Gather treasure for one of your saves, and nothing else matters',
    },
    {
      to: '/game?campaign=new',
      title: '3 Level Campaign',
      sub: 'Test run: pick a wizard, play three levels, visit the shop',
      test: true,
    },
  )

  return [
    { heading: 'Play', items: campaigns },
    {
      heading: 'Workshop',
      items: [
        {
          to: '/game',
          title: 'Game Engine',
          sub: 'Race the enemy wizard to the portal on any map',
        },
        {
          to: '/map-editor',
          title: 'Map Editor',
          sub: 'Paint your own battlegrounds',
        },
        {
          to: '/wizard-editor',
          title: 'Wizard Editor',
          sub: 'Shape spellbooks and stats',
        },
      ],
    },
  ]
}

export default function GameModes() {
  const [videoFailed, setVideoFailed] = useState(false)
  const [panel, setPanel] = useState(null) // continue | random | select | loot
  const groups = buildGroups(listResumableRuns()[0], listAllRuns().length)

  return (
    <div className='home-container gm-page'>
      {!videoFailed && (
        <video
          className='home-video-bg'
          src='/video/HomePage.mp4'
          autoPlay
          loop
          muted
          playsInline
          onError={() => setVideoFailed(true)}
        />
      )}

      <div className='home-overlay' />

      <div className='gm-content'>
        <header className='gm-header'>
          <Link to='/' className='gm-back'>
            ‹ Home
          </Link>
          <h1 className='gm-title'>Choose your path</h1>
          <span className='gm-header-spacer' />
        </header>

        <div className='gm-scroll'>
          {groups.map((group) => (
            <section key={group.heading} className='gm-group'>
              <h2 className='gm-heading'>{group.heading}</h2>

              <div className='gm-grid'>
                {group.items.map((item) => {
                  const body = (
                    <>
                      <span className='gm-card-title'>
                        {item.title}
                        {item.soon && (
                          <span className='gm-tag'>Coming soon</span>
                        )}
                        {item.test && (
                          <span className='gm-tag gm-tag-test'>Test</span>
                        )}
                      </span>
                      <span className='gm-card-sub'>{item.sub}</span>
                    </>
                  )

                  if (item.panel) {
                    return (
                      <button
                        key={item.title}
                        className={`gm-card ${item.highlight ? 'gm-highlight' : ''}`}
                        onClick={() => setPanel(item.panel)}
                      >
                        {body}
                      </button>
                    )
                  }

                  return item.soon ? (
                    <div
                      key={item.title}
                      className='gm-card gm-soon'
                      aria-disabled='true'
                    >
                      {body}
                    </div>
                  ) : (
                    <Link
                      key={item.title}
                      to={item.to}
                      className={`gm-card ${item.highlight ? 'gm-highlight' : ''}`}
                    >
                      {body}
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {(panel === 'continue' || panel === 'loot') && (
        <SavesPanel kind={panel} onClose={() => setPanel(null)} />
      )}
      {panel === 'random' && <RandomPanel onClose={() => setPanel(null)} />}
      {panel === 'select' && <SelectPanel onClose={() => setPanel(null)} />}
    </div>
  )
}
