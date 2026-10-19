import { useState, useRef, useEffect, useCallback } from 'react'
import '../index.css'
import { terrainColours } from '../engine/terrain.js'
import EditorShell from '../ui/EditorShell.jsx'

const TILE_SIZE = 32
const WIDTH = 32
const HEIGHT = 32
const MAX_UNDO = 60

const GROUPS = [
  {
    title: 'Ground',
    tiles: ['grass', 'rough', 'road', 'forest', 'swamp', 'rock', 'wasteland'],
  },
  { title: 'Hazards', tiles: ['water', 'lava', 'mountain'] },
  {
    title: 'Buildings',
    tiles: ['wall', 'floor', 'doorLocked', 'doorUnlocked', 'doorOpen'],
  },
  { title: 'Markers', tiles: ['playerWizard', 'enemyWizard', 'portal', 'key'] },
]

const NOT_PLACEABLE = ['creature']
const SINGLE_MARKERS = ['playerWizard', 'enemyWizard', 'portal']

const LABELS = {
  doorLocked: 'Locked door',
  doorUnlocked: 'Door',
  doorOpen: 'Open door',
  playerWizard: 'Player start',
  enemyWizard: 'Enemy start',
  portal: 'Portal',
  key: 'Key',
}

const MARKER_GLYPHS = {
  playerWizard: 'P',
  enemyWizard: 'E',
  portal: '◎',
  key: '⚷',
}

function labelFor(tile) {
  if (LABELS[tile]) return LABELS[tile]
  return (
    tile.charAt(0).toUpperCase() + tile.slice(1).replace(/([A-Z])/g, ' $1')
  )
}

function makeBlankMap(tile = 'grass') {
  return Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => tile),
  )
}

export default function MapEditor() {
  const canvasRef = useRef(null)
  const paintingRef = useRef(false)
  const lastPaintedRef = useRef(null)

  const [map, setMap] = useState(() => makeBlankMap())
  const [selectedTerrain, setSelectedTerrain] = useState('grass')
  const [hover, setHover] = useState(null)
  const [showGrid, setShowGrid] = useState(true)
  const [history, setHistory] = useState([])
  const [dialog, setDialog] = useState(null)
  const [saveName, setSaveName] = useState('chaos-map')
  const [loadText, setLoadText] = useState('')
  const [toast, setToast] = useState(null)

  const available = Object.keys(terrainColours).filter(
    (t) => !NOT_PLACEABLE.includes(t),
  )
  const listed = GROUPS.flatMap((g) => g.tiles)
  const groups = [
    ...GROUPS.map((g) => ({
      ...g,
      tiles: g.tiles.filter((t) => available.includes(t)),
    })),
    { title: 'Other', tiles: available.filter((t) => !listed.includes(t)) },
  ].filter((g) => g.tiles.length > 0)

  function showToast(message, isError = false) {
    setToast({ message, isError })
    setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const tile = map[y][x]

        ctx.fillStyle = terrainColours[tile] || 'magenta'
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)

        if (showGrid) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
          ctx.strokeRect(
            x * TILE_SIZE + 0.5,
            y * TILE_SIZE + 0.5,
            TILE_SIZE - 1,
            TILE_SIZE - 1,
          )
        }

        const glyph = MARKER_GLYPHS[tile]
        if (glyph) {
          ctx.font = '700 22px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = tile === 'playerWizard' ? '#000' : '#fff'
          ctx.fillText(
            glyph,
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2 + 1,
          )
        }
      }
    }

    if (hover) {
      ctx.strokeStyle = '#ff4500'
      ctx.lineWidth = 2
      ctx.strokeRect(
        hover.x * TILE_SIZE + 1,
        hover.y * TILE_SIZE + 1,
        TILE_SIZE - 2,
        TILE_SIZE - 2,
      )
      ctx.lineWidth = 1
    }
  }, [map, showGrid, hover])

  const undo = useCallback(() => {
    if (history.length === 0) return
    setMap(history[history.length - 1])
    setHistory(history.slice(0, -1))
  }, [history])

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  function remember(snapshot) {
    setHistory((prev) => [...prev.slice(-(MAX_UNDO - 1)), snapshot])
  }

  function tileFromEvent(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(
      ((e.clientX - rect.left) * canvas.width) / rect.width / TILE_SIZE,
    )
    const y = Math.floor(
      ((e.clientY - rect.top) * canvas.height) / rect.height / TILE_SIZE,
    )

    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return null
    return { x, y }
  }

  function paintTile({ x, y }) {
    setMap((prev) => {
      if (prev[y][x] === selectedTerrain) return prev

      const next = prev.map((row) => [...row])

      if (SINGLE_MARKERS.includes(selectedTerrain)) {
        for (let yy = 0; yy < HEIGHT; yy++) {
          for (let xx = 0; xx < WIDTH; xx++) {
            if (next[yy][xx] === selectedTerrain) next[yy][xx] = 'grass'
          }
        }
      }

      next[y][x] = selectedTerrain
      return next
    })
  }

  function handlePointerDown(e) {
    const tile = tileFromEvent(e)
    if (!tile) return

    e.currentTarget.setPointerCapture(e.pointerId)
    paintingRef.current = true
    lastPaintedRef.current = `${tile.x},${tile.y}`
    remember(map)
    paintTile(tile)
  }

  function handlePointerMove(e) {
    const tile = tileFromEvent(e)
    setHover(tile)

    if (!paintingRef.current || !tile) return

    const key = `${tile.x},${tile.y}`
    if (key === lastPaintedRef.current) return

    lastPaintedRef.current = key
    paintTile(tile)
  }

  function stopPainting() {
    paintingRef.current = false
    lastPaintedRef.current = null
  }

  function fillMap() {
    if (SINGLE_MARKERS.includes(selectedTerrain)) {
      showToast('Pick a terrain to fill with, not a marker', true)
      return
    }
    remember(map)
    setMap(makeBlankMap(selectedTerrain))
  }

  function loadMap() {
    try {
      const parsed = JSON.parse(loadText)
      const valid =
        Array.isArray(parsed) &&
        parsed.length === HEIGHT &&
        parsed.every((r) => Array.isArray(r) && r.length === WIDTH)
      if (!valid) throw new Error('wrong shape')

      remember(map)
      setMap(parsed)
      setDialog(null)
      setLoadText('')
      showToast('Map loaded')
    } catch {
      showToast('That is not a valid 32 × 32 map', true)
    }
  }

  async function saveToServer() {
    const name = saveName.trim()
    if (!name) return

    try {
      const res = await fetch('http://localhost:5000/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data: map }),
      })

      const json = await res.json()

      if (json.success) {
        setDialog(null)
        showToast(`Saved to /public/created-maps/${name}.json`)
      } else {
        showToast('Failed to save map', true)
      }
    } catch (err) {
      console.error(err)
      showToast('Could not reach the save server', true)
    }
  }

  const hoverTile = hover ? map[hover.y][hover.x] : null

  return (
    <EditorShell
      title='Map Editor'
      subtitle='32 × 32'
      actions={
        <>
          <button
            className='btn btn-ghost'
            onClick={undo}
            disabled={history.length === 0}
          >
            Undo
          </button>
          <button className='btn btn-ghost' onClick={fillMap}>
            Fill map
          </button>
          <button className='btn btn-ghost' onClick={() => setDialog('load')}>
            Load
          </button>
          <button className='btn btn-primary' onClick={() => setDialog('save')}>
            Save
          </button>
        </>
      }
    >
      <div className='editor-body'>
        <aside className='editor-sidebar'>
          <section>
            {groups.map((group) => (
              <div className='palette-group' key={group.title}>
                <h3>{group.title}</h3>
                <div className='terrain-grid'>
                  {group.tiles.map((t) => (
                    <button
                      key={t}
                      className={`terrain-btn ${selectedTerrain === t ? 'selected' : ''}`}
                      onClick={() => setSelectedTerrain(t)}
                    >
                      <span
                        className='swatch'
                        style={{ background: terrainColours[t] }}
                      />
                      {labelFor(t)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </aside>

        <main className='editor-stage'>
          <div className='editor-canvas-wrap'>
            <canvas
              ref={canvasRef}
              className='map-canvas'
              width={WIDTH * TILE_SIZE}
              height={HEIGHT * TILE_SIZE}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopPainting}
              onPointerCancel={stopPainting}
              onPointerLeave={() => {
                setHover(null)
                stopPainting()
              }}
            />
          </div>

          <div className='editor-statusbar'>
            <span>
              Painting with <strong>{labelFor(selectedTerrain)}</strong>
            </span>
            <span>
              Click or drag to paint · <kbd>Ctrl</kbd> + <kbd>Z</kbd> to undo ·
              start points and the portal can be placed once
            </span>
            <span className='spacer' />
            <label className='toggle'>
              <input
                type='checkbox'
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              Grid
            </label>
            {hover && (
              <span>
                <strong>
                  {hover.x}, {hover.y}
                </strong>{' '}
                · {labelFor(hoverTile)}
              </span>
            )}
          </div>
        </main>
      </div>

      {dialog === 'save' && (
        <div className='modal' onClick={() => setDialog(null)}>
          <div className='modal-content' onClick={(e) => e.stopPropagation()}>
            <h2>Save map</h2>
            <input
              autoFocus
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveToServer()
              }}
              placeholder='Map name'
            />
            <p style={{ fontSize: 15 }}>
              Saved to /public/created-maps/{saveName.trim() || '…'}.json
            </p>
            <div className='modal-actions'>
              <button className='btn btn-ghost' onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className='btn btn-primary' onClick={saveToServer}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog === 'load' && (
        <div className='modal' onClick={() => setDialog(null)}>
          <div
            className='modal-content wide'
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Load map</h2>
            <textarea
              autoFocus
              value={loadText}
              onChange={(e) => setLoadText(e.target.value)}
              placeholder='Paste the map JSON here…'
            />
            <div className='modal-actions'>
              <button className='btn btn-ghost' onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button
                className='btn btn-primary'
                onClick={loadMap}
                disabled={!loadText.trim()}
              >
                Load
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.isError ? 'error' : ''}`}>
          {toast.message}
        </div>
      )}
    </EditorShell>
  )
}
