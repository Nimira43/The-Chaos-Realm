import { useRef, useState } from 'react'
import { SPELLBOOK } from '../data/spellbook.js'
import { PLAYER } from '../data/player.js'
import useGameEngine from '../engine/useGameEngine.js'
import { useViewportRenderer } from '../ui/useViewportRenderer.js'
import { getMovementCost } from '../engine/terrain.js'
import { MAX_ROUNDS, PORTAL_TURN } from '../engine/useTurnSystem.js'
import '../index.css'
import { useEffect } from 'react'

export default function GameEngine() {
  const canvasRef = useRef(null)
  const [selectedSpell, setSelectedSpell] = useState(null)

  const {
    ap,
    round,
    terrainLayer,
    objectLayer,
    effectLayer,
    cursor,
    selected,
    info,
    showLoadModal,
    mapFilename,
    portalPosition,
    gameStatus,
    gameOverMessage,
    isAnimating,
    castSpellForPlayer,
    setShowLoadModal,
    setMapFilename,
    endTurn,
    restartGame,
    loadMapFromFile
  } = useGameEngine()

  const gameOver = gameStatus !== 'playing'
  const actionsLocked = gameOver || isAnimating

  useEffect(() => {
    restartGame()
  }, [])

  useViewportRenderer(canvasRef, terrainLayer, objectLayer, cursor, selected, effectLayer)

  function handleCastClick(e) {
    if (!selectedSpell || actionsLocked) return
    castSpellForPlayer(selectedSpell)
    setSelectedSpell(null)
    e.currentTarget.blur()
  }

  function handleEndTurnClick(e) {
    if (actionsLocked) return
    endTurn()
    e.currentTarget.blur()
  }

  function handleRestartClick(e) {
    restartGame()
    e.currentTarget.blur()
  }

  function handleLoadClick(e) {
    loadMapFromFile()
    e.currentTarget.blur()
  }

  return (
    <div id='game-container'>
      <div id='left-panel'>
        <div id='title-area' className='logo-text'>
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
                className={`spell-entry ${selectedSpell?.name === spell.name ? 'selected' : ''}`}
                onClick={() => setSelectedSpell(spell)}
              >
                <div className='spell-name'>{spell.name}</div>
                <div className='spell-units'>Lv: {spell.currentSpellLevel}</div>
                <div className='spell-cost'>
                  {spell.manaCost * (spell.currentSpellLevel || 1)}
                </div>
              </div>
            ))}
          </div>

          <button
            className={`cast-btn ${selectedSpell && !actionsLocked ? 'active' : 'disabled'}`}
            onClick={handleCastClick}
            disabled={!selectedSpell || actionsLocked}
          >
            Cast Selected Spell
          </button>
        </div>
      </div>

      <div id='middle-panel'>
        <canvas ref={canvasRef} id='map' width={720} height={720}></canvas>
      </div>

      <div id='right-panel'>
        <div id='right-middle'>
          <div id='turn-counter'>
            Turn {round} / {MAX_ROUNDS}
          </div>
          {isAnimating && !gameOver && (
            <div style={{ textAlign: 'center', color: 'var(--grey-3)', fontSize: '16px', marginTop: '4px' }}>
              Enemy turn…
            </div>
          )}
          {!isAnimating && !portalPosition && !gameOver && (
            <div style={{ textAlign: 'center', color: 'var(--grey-3)', fontSize: '16px', marginTop: '4px' }}>
              Portal appears: Turn {PORTAL_TURN}
            </div>
          )}
          {!isAnimating && portalPosition && !gameOver && (
            <div style={{ textAlign: 'center', color: 'var(--main)', fontSize: '16px', marginTop: '4px' }}>
              The portal has opened!
            </div>
          )}
        </div>

        <div id='player-ui'>
          <div id='player-stats'>
            <div>
              AP: {ap}
            </div>
            <div>
              Mana: {PLAYER.current_mana}/{PLAYER.max_mana}
            </div>
            <div>
              HP: {PLAYER.current_health}/{PLAYER.constitution}
            </div>
          </div>

          <button id='end-turn-btn' onClick={handleEndTurnClick} disabled={actionsLocked}>
            {isAnimating ? 'Enemy Turn…' : 'End Turn'}
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
                {objectLayer[selected.y][selected.x]?.ap} /
                {objectLayer[selected.y][selected.x]?.stats.action_points_ground}
              </span>
            </div>

            <div className='creature-info-row'>
              <span className='creature-label'>
                HP:
              </span>
              <span className='creature-value'>
                {objectLayer[selected.y][selected.x]?.current_health} /
                {objectLayer[selected.y][selected.x]?.stats.constitution}
              </span>
            </div>

            <div className='creature-info-row'>
              <span className='creature-label'>
                Terrain:
              </span>
              <span className='creature-value'>
                {terrainLayer[selected.y][selected.x]}
              </span>
            </div>

            <div className='creature-info-row'>
              <span className='creature-label'>
                Move Cost:
              </span>
              <span className='creature-value'>
                {getMovementCost(terrainLayer[selected.y][selected.x], objectLayer[selected.y][selected.x]?.stats)}
              </span>
            </div>
          </div>
        )}

        <div id='right-lower'>
          <div className='info-panel'>
            <div>
              Terrain: {info.terrain}
            </div>

            {info.occupiers.length === 0 && <div>Occupier: None</div>}

            {info.occupiers.map((o, i) => (
              <div key={i}>
                {o.type === 'player' && 'Occupier: Player (ours)'}
              </div>
            ))}

            <button
              className='load-map-btn'
              onClick={
                (e) => { setShowLoadModal(true); e.currentTarget.blur() }
              }
            >
              Load Map
            </button>

            <button
              className='generate-map-btn'
              onClick={handleRestartClick}
            >
              Generate Map
            </button>
          </div>
        </div>

        {showLoadModal && (
          <div className='modal'>
            <div className='modal-content'>
              <h2>
                Load Map
              </h2>

              <input
                type='text'
                placeholder='Enter filename (without .json)'
                value={mapFilename}
                onChange={
                  e => setMapFilename(e.target.value)
                }
              />

              <button onClick={handleLoadClick}>
                Load
              </button>
              <button onClick={
                (e) => { setShowLoadModal(false); e.currentTarget.blur() }
              }>
                Cancel
              </button>
            </div>
          </div>
        )}

        {gameOver && (
          <div className='modal'>
            <div className={`modal-content game-over-content ${gameStatus === 'won' ? 'victory' : 'defeat'}`}>
              <h2>
                {gameStatus === 'won' ? 'Victory!' : 'Defeated'}
              </h2>

              <p style={{ textAlign: 'center', fontSize: '20px', margin: 0 }}>
                {gameOverMessage}
              </p>

              <button onClick={handleRestartClick}>
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}