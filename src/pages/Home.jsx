import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className='home-container'>
      <h1 className='home-logo'>
        The Chaos Realm
      </h1>
      <div clasName='home-wrapper'>
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
    </div>
  )
}
