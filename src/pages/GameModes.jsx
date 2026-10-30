import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listResumableRuns } from '../data/campaignRun.js'
import '../ui/gameModes.css'

function buildGroups(resumable) {
  const campaigns = []

  if (resumable) {
    campaigns.push({
      to: `/game?run=${resumable.id}`,
      title: 'Continue Campaign',
      sub: `${resumable.wizardName} · level ${resumable.index + 1} of ${resumable.levels.length}`,
      highlight: true,
    })
  }

  campaigns.push(
    {
      to: '/game?campaign=main',
      title: 'Main Campaign',
      sub: 'Fifty levels, a shop between each, and a wizard who grows with you',
    },
    {
      title: 'Random Mode',
      sub: 'A run through levels drawn at random',
      soon: true,
    },
    {
      title: 'Select Mode',
      sub: 'Choose the levels you want to fight through',
      soon: true,
    },
    {
      title: 'Loot Mode',
      sub: 'Gather treasure, and nothing else matters',
      soon: true,
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
  const groups = buildGroups(listResumableRuns()[0])

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
    </div>
  )
}
