import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>The Chaos Realm</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
        <Link to='/game'>
          <button style={{ padding: '20px', fontSize: '20px', width: '300px' }}>
            Game Engine
          </button>
        </Link>

        <Link to='/map-editor'>
          <button style={{ padding: '20px', fontSize: '20px', width: '300px' }}>
            Map Editor
          </button>
        </Link>

        <Link to='/wizard-editor'>
          <button style={{ padding: '20px', fontSize: '20px', width: '300px' }}>
            Wizard Editor
          </button>
        </Link>
      </div>
    </div>
  )
}
