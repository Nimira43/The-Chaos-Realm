import { useState } from 'react'
import { Link } from 'react-router-dom'

// Link to HomePage.mp4 to go here...

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
        <h1 className='home-logo'>
          The Chaos Realm
        </h1>

        <div className='home-wrapper'>
          <Link to='/game'>
            <button className='home-btn'>
              Game Engine
            </button>
          </Link>
          <Link to='/map-editor'>
            <button className='home-btn'>
              Map Editor
            </button>
          </Link>
          <Link to='/wizard-editor'>
            <button className='home-btn'>
              Wizard Editor
            </button>
          </Link>
        </div>

        {videoFailed && VIDEO_DOWNLOAD_URL && (
          <a className='home-video-download' href={VIDEO_DOWNLOAD_URL} target='_blank' rel='noreferrer'>
            Get the background video
          </a>
        )}
      </div>
    </div>
  )
}


// import { Link } from 'react-router-dom'

// export default function Home() {
//   return (
//     <div className='home-container'>
//       <h1 className='home-logo'>
//         The Chaos Realm
//       </h1>
//       <div className='home-wrapper'>
//         <Link to='/game'>
//           <button className='home-btn'>
//             Game Engine
//           </button>
//         </Link>
//         <Link to='/map-editor'>
//           <button className='home-btn'>
//             Map Editor
//           </button>
//         </Link>
//         <Link to='/wizard-editor'>
//           <button className='home-btn'>
//             Wizard Editor
//           </button>
//         </Link>
//       </div>
//     </div>
//   )
// }
