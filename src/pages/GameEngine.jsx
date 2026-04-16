import { useEffect, useRef, useState } from 'react'
import { generateProceduralMap } from '../engine/map.js'
import { PLAYER } from '../data/player.js'
import { tryMove } from '../engine/movement.js'
import { drawViewport } from '../ui/viewport.js'
import '../index.css'

export default function GameEngine() {
  const canvasRef = useRef(null)

  const [ap, setAp] = useState(PLAYER.ap)
  const [round, setRound] = useState(1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')

    const TILE_SIZE = 48
    const VIEW_TILES = 15

    const map = generateProceduralMap()

    function render() {
      drawViewport(ctx, map, PLAYER, TILE_SIZE, VIEW_TILES)
    }

    render()

    function handleKey(e) {
      let dx = 0
      let dy = 0

      if (e.key === 'ArrowUp') dy = -1
      else if (e.key === 'ArrowDown') dy = 1
      else if (e.key === 'ArrowLeft') dx = -1
      else if (e.key === 'ArrowRight') dx = 1
      else return

      if (tryMove(PLAYER, dx, dy, map)) {
        setAp(PLAYER.ap)
        render()
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  function endTurn() {
    PLAYER.ap = PLAYER.max_ap
    setAp(PLAYER.ap)

    setRound(prev => prev + 1)
  }

  return (
    <div id='game-container'>
      <div id='left-panel'>
        <div id='player-ui'>
          <div id='ap-display'>AP: {ap}</div>
          <button id='end-turn-btn' onClick={endTurn}>End Turn</button>
        </div>

        <div id='left-lower'>Left Lower</div>
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
        <div id='title-area' className='logo-text'>The Chaos Realm</div>

        <div id='right-middle'>
          <div id='turn-counter'>Turn {round} / 30</div>
        </div>

        <div id='right-lower'>Right Lower</div>
      </div>
    </div>
  )
}
