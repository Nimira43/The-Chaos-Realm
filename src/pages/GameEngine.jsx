import { useRef, useState } from 'react'
import { SPELLBOOK } from '../data/spellbook.js'
import { useMapAndPlayer } from '../engine/useMapAndPlayer.js'
import { useViewportRenderer } from '../ui/useViewportRenderer.js'
import '../index.css'

export default function GameEngine() {
  const canvasRef = useRef(null)
  const [selectedSpell, setSelectedSpell] = useState(null)

  const {
    ap,
    round,
    terrainLayer,
    objectLayer,
    cursor,
    selected,
    info,
    showLoadModal,
    mapFilename,
    castSpellForPlayer,
    setShowLoadModal,
    setMapFilename,
    endTurn,
    restartGame,
    loadMapFromFile
  } = useMapAndPlayer()

  useViewportRenderer(canvasRef, terrainLayer, objectLayer, cursor, selected)

  function handleCastClick() {
    if (!selectedSpell) return
    castSpellForPlayer(selectedSpell)
    setSelectedSpell(null)
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
            {SPELLBOOK.map((spell, i) => (
              <div
                key={i}
                className='spell-entry'
                onClick={() => setSelectedSpell(spell)}
                style={{
                  cursor: 'pointer',
                  background:
                    selectedSpell?.name === spell.name ? '#444' : 'transparent'
                }}
              >
                <div className='spell-name'>
                  {spell.name}
                </div>
                <div className='spell-units'>
                  Level: {spell.currentSpellLevel}
                </div>
                <div className='spell-cost'>
                  Mana Cost: {spell.manaCost * (spell.currentSpellLevel || 1)}
                </div>
              </div>
            ))}
          </div>

          <button
            style={{
              marginTop: '10px',
              padding: '10px',
              width: '100%',
              cursor: selectedSpell ? 'pointer' : 'not-allowed',
              opacity: selectedSpell ? 1 : 0.5
            }}
            onClick={handleCastClick}
            disabled={!selectedSpell}
          >
            Cast Selected Spell
          </button>
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

            <button
              className='load-map-btn'
              onClick={() => setShowLoadModal(true)}
            >
              Load Map
            </button>

            <button
              className='generate-map-btn'
              onClick={restartGame}
            >
              Generate Map
            </button>
          </div>
        </div>

        {showLoadModal && (
          <div className='modal'>
            <div className='modal-content'>
              <h2>Load Map</h2>

              <input
                type='text'
                placeholder='Enter filename (without .json)'
                value={mapFilename}
                onChange={e => setMapFilename(e.target.value)}
              />

              <button onClick={loadMapFromFile}>Load</button>
              <button onClick={() => setShowLoadModal(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
