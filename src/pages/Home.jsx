import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listResumableRuns } from '../data/campaignRun.js'

const VIDEO_DOWNLOAD_URL = null

const MENU = [
  {
    to: '/game',
    title: 'Game Engine',
    sub: 'Race the enemy wizard to the portal',
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
]

export default function Home() {
  const [videoFailed, setVideoFailed] = useState(false)
  const resumable = listResumableRuns()[0]
  const menu = [
    ...(resumable
      ? [
          {
            to: `/game?run=${resumable.id}`,
            title: 'Continue Campaign',
            sub: `${resumable.wizardName} · level ${resumable.index + 1} of ${resumable.levels.length}`,
          },
        ]
      : []),
    {
      to: '/game?campaign=main',
      title: 'Main Campaign',
      sub: 'Fifty levels, a shop between each, and a wizard who grows with you',
    },
    {
      to: '/game?campaign=new',
      title: '3 Level Campaign',
      sub: 'Test run: pick a wizard, play three levels, visit the shop',
    },
    ...MENU,
  ]

  return (
    <div className='home-container'>
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

      <div className='home-content'>
        <h1 className='home-logo'>The Chaos Realm</h1>
        <p className='home-tagline'>Summon. Conquer. Vanquish.</p>

        <nav className='home-wrapper'>
          {menu.map((item) => (
            <Link key={item.to} to={item.to}>
              <button className='home-btn'>
                {item.title}
                <span className='home-btn-sub'>{item.sub}</span>
              </button>
            </Link>
          ))}
        </nav>

        {videoFailed && VIDEO_DOWNLOAD_URL && (
          <a
            className='home-video-download'
            href={VIDEO_DOWNLOAD_URL}
            target='_blank'
            rel='noreferrer'
          >
            Get the background video
          </a>
        )}
      </div>
    </div>
  )
}
