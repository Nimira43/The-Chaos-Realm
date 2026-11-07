import { useRef, useState } from 'react'
import { SPELLBOOK } from '../data/spellbook.js'
import { PLAYER } from '../data/player.js'
import useGameEngine from '../engine/useGameEngine.js'
import { useViewportRenderer } from '../ui/useViewportRenderer.js'
import { getMovementCost } from '../engine/terrain.js'
import { MAX_ROUNDS, PORTAL_TURN } from '../engine/useTurnSystem.js'
import {
  RANGED_SPELL_BASE_RANGE,
  HEALING_RANGE,
} from '../engine/spellCaster.js'
import {
  getMaxAp,
  getMoverStats,
  getMoverAp,
  getMoverMaxAp,
  getMountDescription,
} from '../engine/mounts.js'
import { getBowInfo, getThrowInfo } from '../engine/useItemActions.js'
import '../index.css'
import { useEffect } from 'react'
import WizardPicker from '../ui/WizardPicker.jsx'
import { applyWizardToGame } from '../data/applyWizard.js'
import { applyEnemyToGame } from '../data/applyEnemy.js'
import { enemyForLevel } from '../data/enemyForLevel.js'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CampaignComplete,
  CampaignDefeat,
  CampaignShop,
  LootResult,
  NameRunDialog,
} from '../ui/CampaignScreens.jsx'
import {
  MODE_LABELS,
  TEST_CAMPAIGN_LEVELS,
  applyPurchases,
  bankLoot,
  buildRandomLevels,
  buildSelectedLevels,
  canLoot,
  createRun,
  deleteRun,
  getBank,
  getRun,
  isSaveNameTaken,
  pickPlayableLevels,
  buildMainCampaign,
  runTitle,
  saveRun,
  winLevel,
} from '../data/campaignRun.js'

const CAMPAIGN_MODES = { main: 'main', new: 'campaign3', random: 'random', select: 'select' }

function getHoverInfo(objectLayer, terrainLayer, cursor) {
  if (!terrainLayer.length || !objectLayer.length) return null

  const cell = objectLayer[cursor.y]?.[cursor.x]
  if (!cell) return null

  const terrain = terrainLayer[cursor.y][cursor.x]

  const withMountInfo = (info, riderStats, riderAp, riderMaxAp) => {
    const moverStats = getMoverStats(cell, riderStats)
    return {
      ...info,
      ap: getMoverAp(cell, riderAp),
      apMax: cell.mount ? getMoverMaxAp(cell, riderStats) : riderMaxAp,
      moveCost: getMovementCost(terrain, moverStats),
      riding: getMountDescription(info.name, cell),
      mountHp: cell.mount?.current_health,
      mountHpMax: cell.mount?.stats.constitution,
      terrain,
    }
  }

  if (cell.type === 'creature') {
    const ownMaxAp =
      !cell.mount && cell.flying
        ? cell.stats.action_points_flying
        : getMaxAp(cell.stats)

    return withMountInfo(
      {
        name: cell.name,
        owner: cell.owner,
        label: cell.owner === 'enemy' ? 'Enemy' : 'Creature',
        hp: cell.current_health,
        hpMax: cell.stats.constitution,
        inventory: cell.inventory || [],
      },
      cell.stats,
      cell.ap,
      ownMaxAp,
    )
  }

  if (cell.type === 'enemyWizard') {
    const ref = cell.ref
    return withMountInfo(
      {
        name: 'Enemy Wizard',
        owner: 'enemy',
        label: 'Enemy',
        hp: ref.current_health,
        hpMax: ref.constitution,
        inventory: ref.inventory || [],
      },
      ref,
      ref.ap,
      ref.max_ap,
    )
  }

  if (cell.type === 'player' && cell.mount) {
    return withMountInfo(
      {
        name: 'Wizard',
        owner: 'player',
        label: 'Player',
        hp: PLAYER.current_health,
        hpMax: PLAYER.constitution,
        inventory: PLAYER.inventory || [],
      },
      PLAYER,
      PLAYER.ap,
      PLAYER.max_ap,
    )
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
    zapEffects,
    score,
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
    dropWeapon,
    shootBow,
    throwWeapon,
    itemActionAvailability,
    rideMount,
    dismountMount,
    takeFlight,
    land,
    mountActionAvailability,
    setShowLoadModal,
    setMapFilename,
    endTurn,
    restartGame,
    loadMapFromFile,
    loadMapByName,
    loadLootMap,
  } = useGameEngine()

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const runParam = searchParams.get('run')
  const campaignKind = searchParams.get('campaign')          
  const startingCampaign = campaignKind in CAMPAIGN_MODES
  const lootParam = searchParams.get('loot')                 

  const [run, setRun] = useState(null)
  const [phase, setPhase] = useState('play') 
  const [lastResult, setLastResult] = useState(null)
  const [pendingClone, setPendingClone] = useState(null)  
  const [lootResult, setLootResult] = useState(null)
  const lootStartedRef = useRef(false)
  const lootDoneRef = useRef(false)
  const [campaignError, setCampaignError] = useState(null)
  const levelHandledRef = useRef(false)
  const resumedRef = useRef(false)

  const inCampaign = !!run
  const lootMode = phase === 'loot' || phase === 'lootDone'
  const gameOver = gameStatus !== 'playing'
  const actionsLocked =
    gameOver || isAnimating || (inCampaign && phase !== 'play' && phase !== 'loot')

  const bowInfo = getBowInfo(objectLayer)
  const throwInfo = getThrowInfo(objectLayer)

  const rangeHighlight = selectedSpell?.healing
    ? { origin: playerPosition, radius: HEALING_RANGE }
    : selectedSpell?.category === 'offensive'
      ? { origin: playerPosition, radius: selectedSpell.currentSpellLevel }
      : selectedSpell?.ranged
        ? {
            origin: playerPosition,
            radius: RANGED_SPELL_BASE_RANGE + selectedSpell.currentSpellLevel,
          }
        : bowInfo.hasBow
          ? { origin: bowInfo.origin, radius: bowInfo.range }
          : throwInfo.hasThrowable
            ? { origin: throwInfo.origin, radius: throwInfo.range }
            : null

  const hoverInfo = getHoverInfo(objectLayer, terrainLayer, cursor)
  const playerMount = objectLayer[PLAYER.y]?.[PLAYER.x]?.mount

  const [pickerOpen, setPickerOpen] = useState(!runParam && !lootParam)
  const [wizardName, setWizardName] = useState(null)
  const [enemyName, setEnemyName] = useState(null)

  useEffect(() => {
    if (!lootParam) restartGame()
  }, [])

  async function beginLevel(r) {
    setPhase('loading')
    applyWizardToGame(r.clone)
    const foe = enemyForLevel(r.index + 1, { seed: `${r.id}:${r.index}` })
    applyEnemyToGame(foe)
    setEnemyName(foe.name)
    try {
      await loadMapByName(r.levels[r.index])
      levelHandledRef.current = false
      setPhase('play')
    } catch (err) {
      console.error(err)
      setCampaignError(`Could not load ${r.levels[r.index]}.`)
    }
  }

  async function startCampaign(clone, saveName) {
    setPickerOpen(false)
    setPhase('loading')
    const mode = CAMPAIGN_MODES[campaignKind]
    let levels = []
    let missing = []

    if (mode === 'main') {
      const built = await buildMainCampaign()
      levels = built.levels
      missing = built.missing
      if (missing.length) console.warn('Main Campaign: skipped unplayable levels:', missing.join(', '))
      if (levels.length === 0) {
        setCampaignError('Could not find any playable levels in /created-maps.')
        return
      }
    } else if (mode === 'random') {
      const count = Math.min(50, Math.max(1, parseInt(searchParams.get('count'), 10) || 1))
      levels = await buildRandomLevels(count, searchParams.get('tier'))
      if (levels.length === 0) {
        setCampaignError('Could not find any playable levels in that tier.')
        return
      }
    } else if (mode === 'select') {
      const picks = (searchParams.get('levels') || '').split(',').filter(Boolean)
      const built = await buildSelectedLevels(picks)
      levels = built.levels
      missing = built.missing
      if (levels.length === 0) {
        setCampaignError('None of the levels you picked could be played.')
        return
      }
    } else {
      levels = await pickPlayableLevels(TEST_CAMPAIGN_LEVELS)
      if (levels.length < TEST_CAMPAIGN_LEVELS) {
        setCampaignError('Could not find enough playable levels in /created-maps.')
        return
      }
    }

    const newRun = saveRun(createRun({ clone, levels, missing, mode, saveName }))
    setRun(newRun)
    setWizardName(clone.name)
    navigate(`/game?run=${newRun.id}`, { replace: true })
    await beginLevel(newRun)
  }

  function suggestSaveName(clone) {
    const base = `${clone.name}'s ${MODE_LABELS[CAMPAIGN_MODES[campaignKind]] || 'Run'}`
    let name = base
    for (let n = 2; isSaveNameTaken(name); n++) name = `${base} ${n}`
    return name
  }

  useEffect(() => {
    if (!lootParam || lootStartedRef.current) return
    lootStartedRef.current = true

    const saved = getRun(lootParam)
    if (!saved || !canLoot(saved)) {
      navigate('/game-modes', { replace: true })
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot, guarded transition; it syncs with saved runs / the engine, not a render loop
    setRun(saved)
    setWizardName(saved.wizardName)
    setPickerOpen(false)
    applyWizardToGame(saved.clone)
    loadLootMap()
    levelHandledRef.current = false
    setPhase('loot')
  }, [lootParam])

  function finishLoot(outOfAp) {
    if (lootDoneRef.current || !run) return
    lootDoneRef.current = true
    setSelectedSpell(null)
    const updated = saveRun(bankLoot(run, score))
    setRun(updated)
    setLootResult({ earned: score, outOfAp })
    setPhase('lootDone')
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot, guarded transition; it syncs with saved runs / the engine, not a render loop
    if (phase === 'loot' && (ap <= 0 || gameStatus !== 'playing')) finishLoot(true)
  }, [phase, ap, gameStatus])

  function resumeAfterLoot() {
    const r = run
    resumedRef.current = true
    lootStartedRef.current = true
    setLootResult(null)
    setLastResult(null)
    navigate(`/game?run=${r.id}`, { replace: true })
    if (r.status === 'shopping') {
      applyWizardToGame(r.clone)
      setPhase('shop')
    } else {
      beginLevel(r)
    }
  }

  useEffect(() => {
    if (!runParam || resumedRef.current || run?.id === runParam) return
    resumedRef.current = true

    const saved = getRun(runParam)
    if (!saved || saved.status === 'complete') {
      navigate('/', { replace: true })
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot, guarded transition; it syncs with saved runs / the engine, not a render loop
    setRun(saved)
    setWizardName(saved.wizardName)
    setPickerOpen(false)

    if (saved.status === 'shopping') {
      applyWizardToGame(saved.clone)
      setPhase('shop')
    } else {
      beginLevel(saved)
    }
  }, [runParam])

  useEffect(() => {
    if (!run || phase !== 'play' || levelHandledRef.current) return

    if (gameStatus === 'won') {
      levelHandledRef.current = true
      const updated = saveRun(winLevel(run, score))
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot, guarded transition; it syncs with saved runs / the engine, not a render loop
      setRun(updated)
      setLastResult({ earned: score, message: gameOverMessage })
      setPhase(updated.status === 'complete' ? 'complete' : 'shop')
    } else if (gameStatus !== 'playing') {
      levelHandledRef.current = true
      deleteRun(run.id)
      setPhase('failed')
    }
  }, [gameStatus, phase, run, score, gameOverMessage])

  function handleShopContinue(draft) {
    const bought = applyPurchases(run, draft)
    if (!bought.ok) {
      setCampaignError(bought.error)
      return
    }
    const next = saveRun(bought.run)
    setRun(next)
    setLastResult(null)
    beginLevel(next)
  }

  function handleWizardChosen(clone) {
    if (startingCampaign && !run) {
      setPickerOpen(false)
      setPendingClone(clone)   
      return
    }
    applyWizardToGame(clone)
    const foe = enemyForLevel(1, { seed: `free${Date.now()}` })
    applyEnemyToGame(foe)
    setEnemyName(foe.name)
    setWizardName(clone.name)
    setPickerOpen(false)
    restartGame()
  }

  useViewportRenderer(
    canvasRef,
    terrainLayer,
    objectLayer,
    cursor,
    selected,
    effectLayer,
    rangeHighlight,
    itemLayer,
    zapEffects,
  )

  function handleCastClick(e) {
    if (!selectedSpell || actionsLocked || lootMode) return
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

  function handleShootClick() {
    if (actionsLocked) return
    shootBow(cursor)
  }

  function makeItemActionHandler(fn) {
    return (e) => {
      if (actionsLocked) return
      fn()
      e.currentTarget.blur()
    }
  }

  const showMountActions =
    selected &&
    !actionsLocked &&
    (mountActionAvailability.canRide ||
      mountActionAvailability.canDismount ||
      mountActionAvailability.canFly ||
      mountActionAvailability.canLand)

  const showItemActions =
    selected &&
    !actionsLocked &&
    (itemActionAvailability.canPickUp ||
      itemActionAvailability.canUse ||
      itemActionAvailability.canOpen ||
      itemActionAvailability.canClose)

  return (
    <div id='game-container'>
      <div id='left-panel'>
        <div id='title-area' className='logo-text'>
          The Chaos Realm
        </div>

        <div id='left-lower'>
          <h1 className='spellbook-title'>Spellbook</h1>

          <div className='spellbook-head'>
            <span>Spell</span>
            <span>Lv</span>
            <span>Mana</span>
          </div>

          {lootMode && <div className='turn-note'>The spellbook is sealed in Loot Mode.</div>}

          <div className='spellbook-list' style={lootMode ? { opacity: 0.35, pointerEvents: 'none' } : undefined}>
            {SPELLBOOK.map((spell, i) => (
              <div
                key={i}
                className={`spell-entry ${selectedSpell?.name === spell.name ? 'selected' : ''}`}
                onClick={() => !lootMode && setSelectedSpell(spell)}
              >
                <div className='spell-name'>{spell.name}</div>
                <div className='spell-units'>{spell.currentSpellLevel}</div>
                <div className='spell-cost'>
                  {spell.manaCost * (spell.currentSpellLevel || 1)}
                </div>
              </div>
            ))}
          </div>

          <button
            className={`cast-btn ${selectedSpell && !actionsLocked && !lootMode ? 'active' : 'disabled'}`}
            onClick={handleCastClick}
            disabled={!selectedSpell || actionsLocked || lootMode}
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
            {lootMode ? 'Loot Mode' : `Turn ${round} / ${MAX_ROUNDS}`}
          </div>
          <div id='score-display'>{lootMode ? 'Looted' : 'Score'}: {score}</div>
          {lootMode && run && (
            <div className='turn-note'>
              {runTitle(run)} · Bank {getBank(run)}
            </div>
          )}
          {inCampaign && !lootMode && (
            <div className='turn-note'>
              Level {Math.min(run.index + 1, run.levels.length)} of{' '}
              {run.levels.length}
              {run.missing?.length ? ` (${run.missing.length} missing)` : ''} · {run.levels[run.index]} · Bank{' '}
              {getBank(run)}
            </div>
          )}
          {isAnimating && !gameOver && (
            <div className='turn-note'>Enemy turn…</div>
          )}
          {!lootMode && !isAnimating && !portalPosition && !gameOver && (
            <div className='turn-note'>Portal appears: Turn {PORTAL_TURN}</div>
          )}
          {!lootMode && !isAnimating && portalPosition && !gameOver && (
            <div className='turn-note accent'>The portal has opened!</div>
          )}
        </div>

        <div id='player-ui'>
          <div id='player-stats'>
            <div className='stat'>
              <span className='stat-label'>AP</span>
              <span className='stat-value'>{ap}</span>
            </div>
            <div className='stat mana'>
              <span className='stat-label'>Mana</span>
              <span className='stat-value'>
                {PLAYER.current_mana}/{PLAYER.max_mana}
              </span>
            </div>
            <div className='stat hp'>
              <span className='stat-label'>Health</span>
              <span className='stat-value'>
                {PLAYER.current_health}/{PLAYER.constitution}
              </span>
            </div>
          </div>

          {playerMount && (
            <div className='player-note'>
              Riding {playerMount.name} (AP: {playerMount.ap}/
              {getMaxAp(playerMount.stats)}, HP: {playerMount.current_health}/
              {playerMount.stats.constitution})
            </div>
          )}

          {PLAYER.inventory && PLAYER.inventory.length > 0 && (
            <div className='player-note'>
              Carrying:{' '}
              {PLAYER.inventory.map((item, i) => (
                <span key={item.id}>
                  {i > 0 && ', '}
                  {item.name}
                  {item.type === 'weapon' &&
                    item.thrown > 0 &&
                    !actionsLocked && (
                      <button
                        className='throw-weapon-btn'
                        onClick={() => throwWeapon(item.id, cursor)}
                      >
                        throw
                      </button>
                    )}
                  {item.type === 'weapon' && !actionsLocked && (
                    <button
                      className='drop-weapon-btn'
                      onClick={() => dropWeapon(item.id)}
                    >
                      drop
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {lootMode ? (
            <button
              id='end-turn-btn'
              onClick={(e) => {
                finishLoot(false)
                e.currentTarget.blur()
              }}
              disabled={phase !== 'loot'}
            >
              Bank {score} {score === 1 ? 'point' : 'points'}
            </button>
          ) : (
            <button
              id='end-turn-btn'
              onClick={handleEndTurnClick}
              disabled={actionsLocked}
            >
              {isAnimating ? 'Enemy Turn…' : 'End Turn'}
            </button>
          )}
        </div>

        {hoverInfo && (
          <div
            className='creature-info'
            style={{
              borderColor: hoverInfo.owner === 'enemy' ? '#ff0e0e' : undefined,
            }}
          >
            <div className='creature-info-row'>
              <span className='creature-label'>{hoverInfo.label}:</span>
              <span className='creature-value'>{hoverInfo.name}</span>
            </div>

            {hoverInfo.riding && (
              <div className='creature-info-riding'>{hoverInfo.riding}</div>
            )}

            <div className='creature-info-row'>
              <span className='creature-label'>AP:</span>
              <span className='creature-value'>
                {hoverInfo.ap} / {hoverInfo.apMax}
              </span>
            </div>

            <div className='creature-info-row'>
              <span className='creature-label'>HP:</span>
              <span className='creature-value'>
                {hoverInfo.hp} / {hoverInfo.hpMax}
              </span>
            </div>

            {hoverInfo.riding && (
              <div className='creature-info-row'>
                <span className='creature-label'>Mount HP:</span>
                <span className='creature-value'>
                  {hoverInfo.mountHp} / {hoverInfo.mountHpMax}
                </span>
              </div>
            )}

            <div className='creature-info-row'>
              <span className='creature-label'>Terrain:</span>
              <span className='creature-value'>{hoverInfo.terrain}</span>
            </div>

            <div className='creature-info-row'>
              <span className='creature-label'>Move Cost:</span>
              <span className='creature-value'>{hoverInfo.moveCost}</span>
            </div>

            {hoverInfo.inventory.length > 0 && (
              <div className='creature-info-row'>
                <span className='creature-label'>Carrying:</span>
                <span className='creature-value'>
                  {hoverInfo.inventory.map((item, i) => (
                    <span key={item.id}>
                      {i > 0 && ', '}
                      {item.name}
                      {item.type === 'weapon' &&
                        !actionsLocked &&
                        selected &&
                        hoverInfo.owner === 'player' && (
                          <button
                            className='drop-weapon-btn'
                            onClick={() => dropWeapon(item.id)}
                          >
                            drop
                          </button>
                        )}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
        )}

        {showMountActions && (
          <div className='item-actions'>
            {mountActionAvailability.canRide && (
              <button onClick={makeItemActionHandler(rideMount)}>Ride</button>
            )}
            {mountActionAvailability.canDismount && (
              <button onClick={makeItemActionHandler(dismountMount)}>
                Dismount
              </button>
            )}
            {mountActionAvailability.canFly && (
              <button onClick={makeItemActionHandler(takeFlight)}>Fly</button>
            )}
            {mountActionAvailability.canLand && (
              <button onClick={makeItemActionHandler(land)}>Land</button>
            )}
          </div>
        )}

        {showItemActions && (
          <div className='item-actions'>
            {itemActionAvailability.canPickUp && (
              <button onClick={makeItemActionHandler(pickUpItem)}>
                Pick Up
              </button>
            )}
            {itemActionAvailability.canUse && (
              <button onClick={makeItemActionHandler(useKeyOnDoor)}>Use</button>
            )}
            {itemActionAvailability.canOpen && (
              <button onClick={makeItemActionHandler(openDoor)}>Open</button>
            )}
            {itemActionAvailability.canClose && (
              <button onClick={makeItemActionHandler(closeDoor)}>Close</button>
            )}
          </div>
        )}
        {bowInfo.hasBow && !actionsLocked && (
          <div className='item-actions'>
            <button onClick={handleShootClick}>Shoot</button>
          </div>
        )}

        <div id='right-lower'>
          <div className='info-panel'>
            <div>Terrain: {info.terrain}</div>

            {info.occupiers.length === 0 && <div>Occupier: None</div>}

            {info.occupiers.map((o, i) => (
              <div key={i}>
                {o.type === 'player' && 'Occupier: Player (ours)'}
              </div>
            ))}

            {info.items.length > 0 && (
              <div>Item: {info.items.map((item) => item.name).join(', ')}</div>
            )}

            {lootMode && run ? (
              <>
                <div>Loot for: {run.wizardName}</div>
                <button onClick={() => navigate('/game-modes')}>Leave without banking</button>
              </>
            ) : inCampaign ? (
              <>
                <div>Campaign: {run.wizardName}{enemyName ? ` vs ${enemyName}` : ''}</div>
                <button onClick={() => navigate('/')}>Leave campaign</button>
              </>
            ) : (
              <>
                <button
                  className='load-map-btn'
                  onClick={(e) => {
                    setShowLoadModal(true)
                    e.currentTarget.blur()
                  }}
                >
                  Load Map
                </button>

                <button className='generate-map-btn' onClick={handleRestartClick}>
                  Generate Map
                </button>

                <button
                  className='load-map-btn'
                  onClick={(e) => {
                    setPickerOpen(true)
                    e.currentTarget.blur()
                  }}
                >
                  Wizard{wizardName ? `: ${wizardName}` : ''}
                </button>
              </>
            )}
          </div>
        </div>

        {pickerOpen && (
          <WizardPicker
            canClose={wizardName !== null || startingCampaign}
            onClose={() =>
              startingCampaign && !run ? navigate('/game-modes') : setPickerOpen(false)
            }
            onConfirm={handleWizardChosen}
          />
        )}

        {pendingClone && !run && (
          <NameRunDialog
            defaultName={suggestSaveName(pendingClone)}
            onBack={() => {
              setPendingClone(null)
              setPickerOpen(true)
            }}
            onConfirm={(name) => {
              const clone = pendingClone
              setPendingClone(null)
              startCampaign(clone, name)
            }}
          />
        )}

        {inCampaign && phase === 'lootDone' && lootResult && (
          <LootResult
            run={run}
            earned={lootResult.earned}
            outOfAp={lootResult.outOfAp}
            onReturn={resumeAfterLoot}
          />
        )}

        {inCampaign && phase === 'shop' && (
          <CampaignShop
            run={run}
            result={lastResult}
            nextEnemy={enemyForLevel(run.index + 1, { seed: `${run.id}:${run.index}` })}
            onContinue={handleShopContinue}
          />
        )}

        {inCampaign && phase === 'complete' && <CampaignComplete run={run} />}

        {inCampaign && phase === 'failed' && (
          <CampaignDefeat run={run} message={gameOverMessage} />
        )}

        {phase === 'loading' && <div className='toast'>Loading level…</div>}

        {campaignError && (
          <div className='modal'>
            <div className='modal-content'>
              <h2>Campaign problem</h2>
              <p>{campaignError}</p>
              <button
                onClick={() => {
                  setCampaignError(null)
                  navigate('/')
                }}
              >
                Back to Home
              </button>
            </div>
          </div>
        )}

        {showLoadModal && (
          <div className='modal'>
            <div className='modal-content'>
              <h2>Load Map</h2>

              <input
                type='text'
                placeholder='Enter filename (without .json)'
                value={mapFilename}
                onChange={(e) => setMapFilename(e.target.value)}
              />

              <div className='modal-actions'>
                <button
                  onClick={(e) => {
                    setShowLoadModal(false)
                    e.currentTarget.blur()
                  }}
                >
                  Cancel
                </button>
                <button onClick={handleLoadClick}>Load</button>
              </div>
            </div>
          </div>
        )}

        {gameOver && !inCampaign && (
          <div className='modal'>
            <div
              className={`modal-content game-over-content ${gameStatus === 'won' ? 'victory' : 'defeat'}`}
            >
              <h2>{gameStatus === 'won' ? 'Victory!' : 'Defeated'}</h2>

              <p>{gameOverMessage}</p>
              <p>Final score: {score}</p>

              <button onClick={handleRestartClick}>Play Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
