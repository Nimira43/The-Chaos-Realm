import { useRef, useState } from 'react'
import { SPELLBOOK } from '../data/spellbook.js'
import { PLAYER } from '../data/player.js'
import useGameEngine from '../engine/useGameEngine.js'
import { useViewportRenderer } from '../ui/useViewportRenderer.js'
import { getMovementCost } from '../engine/terrain.js'
import { MAX_ROUNDS, PORTAL_TURN } from '../engine/useTurnSystem.js'
import { RANGED_SPELL_BASE_RANGE, HEALING_RANGE} from '../engine/spellCaster.js'
import { getMaxAp, getMoverStats, getMoverAp, getMountDescription } from '../engine/mounts.js'
import '../index.css'
import { useEffect } from 'react'

function getHoverInfo(objectLayer, terrainLayer, cursor) {
  if (!terrainLayer.length || !objectLayer.length) return null

  const cell = objectLayer[cursor.y]?.[cursor.x]
  if (!cell) return null

  const terrain = terrainLayer[cursor.y][cursor.x]

  // Whilst mounted, AP and move cost are the mount's, as it does the moving.
  const withMountInfo = (info, riderStats, riderAp, riderMaxAp) => {
    const moverStats = getMoverStats(cell, riderStats)
    return {
      ...info,
      ap: getMoverAp(cell, riderAp),
      apMax: cell.mount ? getMaxAp(cell.mount.stats) : riderMaxAp,
      moveCost: getMovementCost(terrain, moverStats),
      riding: getMountDescription(info.name, cell),
      mountHp: cell.mount?.current_health,
      mountHpMax: cell.mount?.stats.constitution,
      terrain
    }
  }

  if (cell.type === 'creature') {
    return withMountInfo({
      name: cell.name,
      owner: cell.owner,
      label: cell.owner === 'enemy' ? 'Enemy' : 'Creature',
      hp: cell.current_health,
      hpMax: cell.stats.constitution,
      inventory: cell.inventory || []
    }, cell.stats, cell.ap, getMaxAp(cell.stats))
  }

  if (cell.type === 'enemyWizard') {
    const ref = cell.ref
    return withMountInfo({
      name: 'Enemy Wizard',
      owner: 'enemy',
      label: 'Enemy',
      hp: ref.current_health,
      hpMax: ref.constitution,
      inventory: ref.inventory || []
    }, ref, ref.ap, ref.max_ap)
  }

  if (cell.type === 'player' && cell.mount) {
    return withMountInfo({
      name: 'Wizard',
      owner: 'player',
      label: 'Player',
      hp: PLAYER.current_health,
      hpMax: PLAYER.constitution,
      inventory: PLAYER.inventory || []
    }, PLAYER, PLAYER.ap, PLAYER.max_ap)
  }

  return null
}

export default function GameEngine() {
  const canvasRef = useRef(null)
  const [selectedSpell, setSelectedSpell] = useState(null)

  const {
    playerPosition,
    ap,
    round,
    terrainLayer,
    objectLayer,
    effectLayer,
    itemLayer,
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
    pickUpItem,
    useKeyOnDoor,
    openDoor,
    closeDoor,
    itemActionAvailability,
    rideMount,
    dismountMount,
    mountActionAvailability,
    setShowLoadModal,
    setMapFilename,
    endTurn,
    restartGame,
    loadMapFromFile
  } = useGameEngine()

  const gameOver = gameStatus !== 'playing'
  const actionsLocked = gameOver || isAnimating

  const rangeHighlight = selectedSpell?.healing
  ? { origin: playerPosition, radius: HEALING_RANGE }
  : selectedSpell?.ranged
    ? { origin: playerPosition, radius: RANGED_SPELL_BASE_RANGE + selectedSpell.currentSpellLevel }
    : null

  const hoverInfo = getHoverInfo(objectLayer, terrainLayer, cursor)
  const playerMount = objectLayer[PLAYER.y]?.[PLAYER.x]?.mount

  useEffect(() => {
    restartGame()
  }, [])

  useViewportRenderer(canvasRef, terrainLayer, objectLayer, cursor, selected, effectLayer, rangeHighlight, itemLayer)

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

  function makeItemActionHandler(fn) {
    return (e) => {
      if (actionsLocked) return
      fn()
      e.currentTarget.blur()
    }
  }

  const showMountActions = selected && !actionsLocked && (
    mountActionAvailability.canRide ||
    mountActionAvailability.canDismount
  )

  const showItemActions = selected && !actionsLocked && (
    itemActionAvailability.canPickUp ||
    itemActionAvailability.canUse ||
    itemActionAvailability.canOpen ||
    itemActionAvailability.canClose
  )

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

          {playerMount && (
            <div style={{ textAlign: 'center', fontSize: '14px', color: 'var(--grey-3)', marginBottom: '10px' }}>
              Riding {playerMount.name} (AP: {playerMount.ap}/{getMaxAp(playerMount.stats)}, HP: {playerMount.current_health}/{playerMount.stats.constitution})
            </div>
          )}

          {PLAYER.inventory && PLAYER.inventory.length > 0 && (
            <div style={{ textAlign: 'center', fontSize: '14px', color: 'var(--grey-3)', marginBottom: '10px' }}>
              Carrying: {PLAYER.inventory.map(item => item.name).join(', ')}
            </div>
          )}

          <button id='end-turn-btn' onClick={handleEndTurnClick} disabled={actionsLocked}>
            {isAnimating ? 'Enemy Turn…' : 'End Turn'}
          </button>
        </div>

        {hoverInfo && (
          <div
            className='creature-info'
            style={{ borderColor: hoverInfo.owner === 'enemy' ? '#ff0e0e' : undefined }}
          >
            <div className='creature-info-row'>
              <span className='creature-label'>
                {hoverInfo.label}:
              </span>
              <span className='creature-value'>
                {hoverInfo.name}
              </span>
            </div>

            {hoverInfo.riding && (
              <div className='creature-info-riding'>
                {hoverInfo.riding}
              </div>
            )}

            <div className='creature-info-row'>
              <span className='creature-label'>
                AP:
              </span>
              <span className='creature-value'>
                {hoverInfo.ap} / {hoverInfo.apMax}
              </span>
            </div>

            <div className='creature-info-row'>
              <span className='creature-label'>
                HP:
              </span>
              <span className='creature-value'>
                {hoverInfo.hp} / {hoverInfo.hpMax}
              </span>
            </div>

            {hoverInfo.riding && (
              <div className='creature-info-row'>
                <span className='creature-label'>
                  Mount HP:
                </span>
                <span className='creature-value'>
                  {hoverInfo.mountHp} / {hoverInfo.mountHpMax}
                </span>
              </div>
            )}

            <div className='creature-info-row'>
              <span className='creature-label'>
                Terrain:
              </span>
              <span className='creature-value'>
                {hoverInfo.terrain}
              </span>
            </div>

            <div className='creature-info-row'>
              <span className='creature-label'>
                Move Cost:
              </span>
              <span className='creature-value'>
                {hoverInfo.moveCost}
              </span>
            </div>

            {hoverInfo.inventory.length > 0 && (
              <div className='creature-info-row'>
                <span className='creature-label'>
                  Carrying:
                </span>
                <span className='creature-value'>
                  {hoverInfo.inventory.map(item => item.name).join(', ')}
                </span>
              </div>
            )}
          </div>
        )}

        {showMountActions && (
          <div className='item-actions'>
            {mountActionAvailability.canRide && (
              <button
                onClick={makeItemActionHandler(rideMount)}
              >
                Ride
              </button>
            )}
            {mountActionAvailability.canDismount && (
              <button
                onClick={makeItemActionHandler(dismountMount)}
              >
                Dismount
              </button>
            )}
          </div>
        )}

        {showItemActions && (
          <div className='item-actions'>
            {itemActionAvailability.canPickUp && (
              <button
                onClick={makeItemActionHandler(pickUpItem)}
              >
                Pick Up
              </button>
            )}
            {itemActionAvailability.canUse && (
              <button
                onClick={makeItemActionHandler(useKeyOnDoor)}
              >
                Use
              </button>
            )}
            {itemActionAvailability.canOpen && (
              <button
                onClick={makeItemActionHandler(openDoor)}
              >
                Open
              </button>
            )}
            {itemActionAvailability.canClose && (
              <button
                onClick={makeItemActionHandler(closeDoor)}
              >
                Close
              </button>
            )}
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

            {info.items.length > 0 && (
              <div>
                Item: {info.items.map(item => item.name).join(', ')}
              </div>
            )}

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