import { useState } from 'react'
import { Link } from 'react-router-dom'

const VIDEO_DOWNLOAD_URL = null

const MENU = [
  { to: '/game', title: 'Game Engine', sub: 'Race the enemy wizard to the portal' },
  { to: '/map-editor', title: 'Map Editor', sub: 'Paint your own battlegrounds' },
  { to: '/wizard-editor', title: 'Wizard Editor', sub: 'Shape spellbooks and stats' }
]

export default function Home() {
  const [videoFailed, setVideoFailed] = useState(false)

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
          {MENU.map(item => (
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
            target='_blank' rel='noreferrer'
          >
            Get the background video
          </a>
        )}
      </div>
    </div>
  )
}