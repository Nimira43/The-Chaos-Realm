import { useRef, useState } from 'react'
import { SPELLBOOK } from '../data/spellbook.js'
import { PLAYER } from '../data/player.js'
import useGameEngine  from '../engine/useGameEngine.js'
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
  } = useGameEngine()

  useViewportRenderer(canvasRef, terrainLayer, objectLayer, cursor, selected)

  function handleCastClick() {
    if (!selectedSpell) return
    castSpellForPlayer(selectedSpell)
    setSelectedSpell(null)
  }

  return (
    <div id='game-container'>
      <div id='left-panel'>
        <div
          id='title-area'
          className='logo-text'
        >
          The Chaos Realm
        </div>

        <div id='left-lower'>
          <h1 className='spellbook-title'>
            Spellbook
          </h1>

        <div className='spellbook-list'>
          {SPELLBOOK.map((spell, i) => (
            <div
              key={i}
              className={
                `spell-entry ${selectedSpell?.name === spell.name ? 'selected' : ''}`
              }
              onClick={
                () => setSelectedSpell(spell)
              }
            >
              <div className='spell-name'>
                {spell.name}
              </div>
              <div className='spell-units'>
                Lv: {spell.currentSpellLevel}
              </div>
              <div className='spell-cost'>
                {spell.manaCost * (spell.currentSpellLevel || 1)}
              </div>
            </div>
          ))}
        </div>

        <button
          className={
              `cast-btn ${selectedSpell ? 'active' : 'disabled'}`
            }
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
        <div id='right-middle'>
          <div id='turn-counter'>
            Turn {round} / 30
          </div>
        </div>
        <div id='player-ui'>
          <div id='player-stats'>
            <div>
              AP: {ap}
            </div>
            <div>
              Mana: {PLAYER.current_mana}/{PLAYER.max_mana}
            </div>
          </div>

          <button
            id='end-turn-btn'
            onClick={endTurn}
          >
            End Turn
          </button>
        </div>

        {selected?.type === 'creature' && (
          <div className='creature-info'>
            <div className='creature-info-row'>
              <span className='creature-label'>
                Creature:
              </span>
              <span className='creature-value'>
                {objectLayer[selected.y][selected.x]?.name || 'Unknown'}
              </span>
            </div>

            <div className='creature-info-row'>
              <span className='creature-label'>
                AP:
              </span>
              <span className='creature-value'>
                {objectLayer[selected.y][selected.x]?.ap} / {objectLayer[selected.y][selected.x]?.stats.action_points_ground}
              </span>
            </div>
          </div>
        )}

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
              onClick={
                () => setShowLoadModal(true)
              }
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

              <button onClick={loadMapFromFile}>
                Load
              </button>
              <button onClick={
                () => setShowLoadModal(false)
              }>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
