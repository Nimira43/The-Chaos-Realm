import { useEffect, useRef, useState } from 'react'
import { generateProceduralMap } from '../engine/map.js'
import { TESTING_SPELLBOOK } from '../data/spellbook.js'
import { PLAYER } from '../data/player.js'
import { tryMove } from '../engine/movement.js'
import { drawViewport } from '../ui/viewport.js'
import { wrap } from '../engine/utils.js'
import '../index.css'

export default function GameEngine() {
  const canvasRef = useRef(null)
  const [ap, setAp] = useState(PLAYER.ap)
  const [round, setRound] = useState(1)
  const [cursor, setCursor] = useState({ x: PLAYER.x, y: PLAYER.y })
  const [selected, setSelected] = useState(null) 

  const [info, setInfo] = useState({
    terrain: 'grass',
    occupiers: []
  })

  const mapRef = useRef(null)

  useEffect(() => {
    mapRef.current = generateProceduralMap()
  }, [])

  useEffect(() => {
    if (!mapRef.current) return

    const terrain = mapRef.current[cursor.y][cursor.x]
    const occupiers = []

    if (cursor.x === PLAYER.x && cursor.y === PLAYER.y) {
      occupiers.push({ type: 'player', owner: 'us' })
    }

    setInfo({ terrain, occupiers })
  }, [cursor])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !mapRef.current) return

    const ctx = canvas.getContext('2d')
    const TILE_SIZE = 48
    const VIEW_TILES = 15

    function render() {
      drawViewport(
        ctx,
        mapRef.current,
        PLAYER,
        TILE_SIZE,
        VIEW_TILES,
        cursor,
        selected
      )
    }

    render()

    const interval = setInterval(render, 100)
    return () => clearInterval(interval)
  }, [cursor, selected])

  useEffect(() => {
    function handleKey(e) {
      const map = mapRef.current
      if (!map) return

      let dx = 0
      let dy = 0

      if (e.key === 'ArrowUp') dy = -1
      else if (e.key === 'ArrowDown') dy = 1
      else if (e.key === 'ArrowLeft') dx = -1
      else if (e.key === 'ArrowRight') dx = 1

      if (e.key === ' ') {
        if (!selected) {
          if (cursor.x === PLAYER.x && cursor.y === PLAYER.y) {
            setSelected({ type: 'player' })
          }
        } else {
          setSelected(null)
        }
        return
      }

      if (!selected) {
        if (dx !== 0 || dy !== 0) {
          setCursor(c => ({
            x: wrap(c.x + dx, map[0].length),
            y: wrap(c.y + dy, map.length)
          }))
        }
        return
      }

      if (selected.type === 'player') {
        if (tryMove(PLAYER, dx, dy, map)) {
          setAp(PLAYER.ap)
          setCursor({ x: PLAYER.x, y: PLAYER.y })
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cursor, selected])

  function endTurn() {
    PLAYER.ap = PLAYER.max_ap
    setAp(PLAYER.ap)
    setRound(prev => prev + 1)
  }

  return (
    <div id='game-container'>
      <div id='left-panel'>
        <div id='player-ui'>
          <div id='ap-display'>
            AP: {ap}
          </div>
          <button
            id='end-turn-btn'
            onClick={endTurn}
          >
            End Turn
          </button>
        </div>

        <div id='left-lower'>
          <h1 className='spellbook-title'>
            Spellbook
          </h1>
          <div className='spellbook-list'>
            {TESTING_SPELLBOOK.map((spell, i) => (
              <div key={i} className='spell-entry'>
                <div className='spell-name'>
                  {spell.name}
                </div>
                <div className='spell-units'>
                  Units: {spell.remainingUnits}/{spell.maxUnits}
                </div>
                <div className='spell-cost'>
                  Mana Required: {spell.manaCost * spell.remainingUnits}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id='middle-panel'>
        <canvas
          ref={canvasRef}
          id='map'
          width={720}
          height={720}
        ></canvas>
      </div>

      <div id='right-panel'>
        <div id='title-area' className='logo-text'>
          The Chaos Realm
        </div>

        <div id='right-middle'>
          <div id='turn-counter'>
            Turn {round} / 30
          </div>
        </div>

        <div id='right-lower'>
          <div className='info-panel'>
            <div>
              Terrain: {info.terrain}
            </div>

            {info.occupiers.length === 0 && (
              <div>
                Occupier: None
              </div>
            )}

            {info.occupiers.map((o, i) => (
              <div key={i}>
                {o.type === 'player' && 'Occupier: Player (ours)'}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

