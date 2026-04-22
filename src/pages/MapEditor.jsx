import { useState, useRef, useEffect } from 'react'
import '../index.css'
import { terrainColours } from '../engine/terrain.js'

export default function MapEditor() {
  const canvasRef = useRef(null)

  const TILE_SIZE = 32
  const WIDTH = 32
  const HEIGHT = 32

  // --- Map state (2D array of terrain types) ---
  const [map, setMap] = useState(
    Array.from({ length: HEIGHT }, () =>
      Array.from({ length: WIDTH }, () => 'grass')
    )
  )

  // --- Selected terrain from palette ---
  const [selectedTerrain, setSelectedTerrain] = useState('grass')

  // --- Draw map whenever it changes ---
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const tile = map[y][x]

        ctx.fillStyle = terrainColours[tile] || 'magenta'
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)

        ctx.strokeStyle = '#222'
        ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
      }
    }
  }, [map])

  // --- Handle painting tiles ---
  function handleCanvasClick(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    // Calculate scale between CSS size and actual canvas size
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    // Corrected mouse position
    const x = Math.floor((e.clientX - rect.left) * scaleX / TILE_SIZE)
    const y = Math.floor((e.clientY - rect.top) * scaleY / TILE_SIZE)

    setMap(prev => {
      const newMap = prev.map(row => [...row])
      newMap[y][x] = selectedTerrain
      return newMap
    })
  }

  // --- Load map from JSON ---
  function loadMap() {
    const json = prompt('Paste map JSON:')
    if (!json) return

    try {
      const parsed = JSON.parse(json)
      setMap(parsed)
    } catch {
      alert('Invalid JSON')
    }
  }

  // --- Save map to backend ---
  async function saveToServer() {
    const name = prompt('Enter map name:', 'chaos-map')
    if (!name) return

    try {
      const res = await fetch('http://localhost:5000/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          data: map
        })
      })

      const json = await res.json()

      if (json.success) {
        alert(`Map saved to /public/created-maps/${name}.json`)
      } else {
        alert('Failed to save map')
      }
    } catch (err) {
      console.error(err)
      alert('Error saving map')
    }
  }

  return (
    <div id='map-editor-container'>
      
      {/* LEFT PANEL: TERRAIN PALETTE */}
      <div id='editor-left'>
        <h2>Terrain</h2>

        <div className='terrain-grid'>
          {Object.keys(terrainColours).map(t => (
            <button
              key={t}
              className={
                `terrain-btn ${selectedTerrain === t ? 'selected' : ''}`
              }
              onClick={() => setSelectedTerrain(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <button className='save-btn' onClick={saveToServer}>Save Map</button>
        <button className='load-btn' onClick={loadMap}>Load Map</button>
      </div>

      {/* MIDDLE PANEL: CANVAS */}
      <div id='editor-middle'>
        <canvas
          ref={canvasRef}
          width={WIDTH * TILE_SIZE}
          height={HEIGHT * TILE_SIZE}
          onClick={handleCanvasClick}
        />
      </div>

      {/* RIGHT PANEL: FUTURE TOOLS */}
      <div id='editor-right'>
        <h2>Tools</h2>
        <p>Coming soon…</p>
      </div>
    </div>
  )
}
