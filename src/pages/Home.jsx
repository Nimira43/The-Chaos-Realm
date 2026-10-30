import { useState } from 'react'
import { Link } from 'react-router-dom'

const VIDEO_DOWNLOAD_URL = null

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
          <Link to='/game-modes'>
            <button className='home-btn home-start'>Start</button>
          </Link>
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
