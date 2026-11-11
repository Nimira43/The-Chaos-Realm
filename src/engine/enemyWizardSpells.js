import {
  getQuestWant,
  getQuestReserve,
  getQuestKeep,
  getQuestOn,
  clearQuestWant,
} from './enemyQuest.js'
import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { ENEMY_SPELLBOOK } from '../data/enemySpellbook.js'
import { CREATURES } from '../data/creatures.js'
import { castSpell, RANGED_SPELL_BASE_RANGE } from './spellCaster.js'
import { applyMagicDamage } from './combat.js'
import { getMaxAp, canFly, isCurrentlyFlying } from './mounts.js'
import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { canTakeOffFrom } from './useMountActions.js'
import { isSealedIn } from './enemyEscape.js'
import { pickArmySpell, isFlyingMount } from './enemyArmy.js'
import {
  needsDifferentMount,
  findFittingAdjacentMount,
  mountFits,
} from './enemyMountPlan.js'
import {
  planBreach,
  markBreach,
  clearBreachMarks,
  ageBreachMarks,
  isBreachMark,
  isSiegeBreach,
} from './enemyBreach.js'
import {
  scanThreat,
  countTerrainAround,
  listPlayerUnitsInRange,
  findBestBlast,
} from './enemyScans.js'
import {
  createFireEffect,
  createBlobEffect,
  createVineEffect,
  createFloodEffect,
  isTileIgnitable as checkTileIgnitable,
  isTileSpreadableForBlob as checkTileSpreadableForBlob,
  isTileValidForVineCast as checkTileValidForVineCast,
  isTileValidForFloodCast as checkTileValidForFloodCast,
} from './environmentEffects.js'

export const ZAP_THRESHOLD = 60
export const HIGH_THREAT_THRESHOLD = 120

const MAX_CASTS_PER_TURN = 6
const MAX_ZAPS_PER_TURN = 2

export const MAX_ARMY_SIZE = 40
const HEAL_SELF_BELOW = 0.5
const HEAL_ALLY_BELOW = 0.4

const ADJACENT_OFFSETS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
]

export function getThreatTier(total) {
  if (total > HIGH_THREAT_THRESHOLD) return 'high'
  if (total >= ZAP_THRESHOLD) return 'zap'
  return 'calm'
}

function isTileFreeForCast(terrainLayer, objectLayer, effectLayer, x, y) {
  if (y < 0 || y >= terrainLayer.length) return false
  if (x < 0 || x >= terrainLayer[0].length) return false

  const terrain = terrainLayer[y][x]
  const blockedTerrain = [
    'wall',
    'water',
    'mountain',
    'lava',
    'doorLocked',
    'doorUnlocked',
  ]
  if (blockedTerrain.includes(terrain)) return false

  if (objectLayer[y][x] !== null) return false
  if (effectLayer[y][x] !== null) return false

  return true
}

function countFreeSummonTiles(S) {
  return ADJACENT_OFFSETS.filter((o) =>
    isTileFreeForCast(
      S.terrain,
      S.objects,
      S.effects,
      ENEMY_WIZARD.x + o.x,
      ENEMY_WIZARD.y + o.y,
    ),
  ).length
}

function countOwnMatching(objectLayer, pred) {
  let count = 0
  for (const row of objectLayer) {
    for (const cell of row) {
      if (!cell) continue
      if (
        cell.type === 'creature' &&
        cell.owner === 'enemy' &&
        pred(cell.stats)
      )
        count++
      if (cell.type === 'enemyWizard' && cell.mount && pred(cell.mount.stats))
        count++
    }
  }
  return count
}

function usableSpell(name) {
  const spell = ENEMY_SPELLBOOK.find((s) => s.name === name)
  if (!spell || spell.currentSpellLevel <= 0) return null
  if (ENEMY_WIZARD.current_mana < spell.manaCost * spell.currentSpellLevel)
    return null
  return spell
}

function chooseHeal(S) {
  const heal = usableSpell('Healing Potion')
  if (!heal) return null

  const wiz = ENEMY_WIZARD
  const here = S.objects[wiz.y][wiz.x]

  const wizardHurt = wiz.current_health <= wiz.constitution * HEAL_SELF_BELOW
  const mountHurt =
    !!here?.mount &&
    here.mount.current_health <=
      here.mount.stats.constitution * HEAL_SELF_BELOW

  if (wizardHurt || mountHurt) {
    return { kind: 'heal', spell: heal, aimPos: { x: wiz.x, y: wiz.y } }
  }

  for (const o of ADJACENT_OFFSETS) {
    const x = wiz.x + o.x
    const y = wiz.y + o.y
    const cell = S.objects[y]?.[x]
    if (cell?.type !== 'creature' || cell.owner !== 'enemy') continue

    const ratio = cell.current_health / cell.stats.constitution
    const mountRatio = cell.mount
      ? cell.mount.current_health / cell.mount.stats.constitution
      : 1
    if (Math.min(ratio, mountRatio) <= HEAL_ALLY_BELOW) {
      return { kind: 'heal', spell: heal, aimPos: { x, y } }
    }
  }

  return null
}

function hasValidAdjacentTile(isValid) {
  return ADJACENT_OFFSETS.some((o) =>
    isValid({ x: ENEMY_WIZARD.x + o.x, y: ENEMY_WIZARD.y + o.y }),
  )
}

function chooseZap(S, tier) {
  const wiz = ENEMY_WIZARD
  const caster = { x: wiz.x, y: wiz.y }

  const lightning = usableSpell('Magic Lightning')
  const bolt = usableSpell('Magic Bolt')
  const flood = usableSpell('Flood')
  const vine = usableSpell('Tangle Vine')

  const zap = (spell, pos) => ({
    kind: 'zap',
    spell,
    aimPos: { x: pos.x, y: pos.y },
  })

  let lightningBest = null
  if (lightning) {
    lightningBest = findBestBlast(
      S.objects,
      caster,
      lightning.currentSpellLevel,
      1,
    )
    if (
      lightningBest &&
      lightningBest.net > 0 &&
      lightningBest.hitPlayerUnits >= 2
    ) {
      return zap(lightning, lightningBest)
    }
  }

  if (flood) {
    const level = flood.currentSpellLevel
    const best = findBestBlast(
      S.objects,
      caster,
      RANGED_SPELL_BASE_RANGE + level,
      level,
      { mode: 'units', minClearance: 2 },
    )
    if (best && best.net > 0 && best.hitPlayerUnits >= 3)
      return zap(flood, best)
  }

  if (bolt) {
    const targets = listPlayerUnitsInRange(
      S.objects,
      wiz.x,
      wiz.y,
      bolt.currentSpellLevel,
    )
    if (targets.length > 0) return zap(bolt, targets[0])
  }

  if (lightningBest && lightningBest.net > 0)
    return zap(lightning, lightningBest)

  if (vine) {
    const level = vine.currentSpellLevel
    const best = findBestBlast(
      S.objects,
      caster,
      RANGED_SPELL_BASE_RANGE + level,
      level,
      { mode: 'units', minClearance: 2 },
    )
    if (best && best.net > 0 && best.hitPlayerUnits >= 2)
      return zap(vine, best)
  }

  if (tier === 'high') {
    const fire = usableSpell('Magic Fire')
    if (
      fire &&
      hasValidAdjacentTile((t) =>
        checkTileIgnitable(S.terrain, S.effects, t.x, t.y),
      )
    ) {
      return { kind: 'zap', spell: fire, aimPos: null }
    }

    const blob = usableSpell('Gooey Blob')
    if (
      blob &&
      hasValidAdjacentTile((t) =>
        checkTileSpreadableForBlob(S.terrain, S.effects, t.x, t.y),
      )
    ) {
      return { kind: 'zap', spell: blob, aimPos: null }
    }
  }

  return null
}

const ESCAPE_WATCH_RADIUS = 3

function hasPendingEscapeEffect(S) {
  for (let dy = -ESCAPE_WATCH_RADIUS; dy <= ESCAPE_WATCH_RADIUS; dy++) {
    for (let dx = -ESCAPE_WATCH_RADIUS; dx <= ESCAPE_WATCH_RADIUS; dx++) {
      const y = (ENEMY_WIZARD.y + dy + S.effects.length) % S.effects.length
      const x =
        (ENEMY_WIZARD.x + dx + S.effects[0].length) % S.effects[0].length
      const e = S.effects[y][x]
      if (e && (e.type === 'fire' || e.type === 'blob') && e.owner === 'enemy')
        return true
      if (
        e &&
        e.type === 'vine' &&
        e.owner === 'enemy' &&
        isBreachMark(S.effects, x, y)
      )
        return true
    }
  }
  return false
}

function pickEscapeVineAim(S, vine) {
  const level = vine.currentSpellLevel
  const range = RANGED_SPELL_BASE_RANGE + level
  const here = S.terrain[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
  let best = null
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy))
      if (d <= level || d > range) continue
      const x = (ENEMY_WIZARD.x + dx + MAP_WIDTH) % MAP_WIDTH
      const y = (ENEMY_WIZARD.y + dy + MAP_HEIGHT) % MAP_HEIGHT
      if (S.terrain[y][x] !== here) continue
      if (S.objects[y][x]) continue
      if (!checkTileValidForVineCast(S.terrain, S.effects, x, y)) continue
      if (!best || d < best.d) best = { x, y, d }
    }
  }
  return best ? { x: best.x, y: best.y } : null
}

function chooseEscape(S) {
  const wiz = ENEMY_WIZARD
  if (S.portal && getQuestReserve() > 0) return null
  const cell = S.objects[wiz.y][wiz.x]

  if (isCurrentlyFlying(cell)) return null

  const flierToHand =
    (!!cell?.mount && canFly(cell.mount.stats)) || hasAdjacentFlyingMount(S)
  if (flierToHand && canTakeOffFrom(S.terrain[wiz.y][wiz.x])) return null

  if (!isSealedIn(S.terrain, S.objects, S.items)) return null
  if (hasPendingEscapeEffect(S)) return null

  const fire = usableSpell('Magic Fire')
  const blob = usableSpell('Gooey Blob')
  const canFire =
    fire &&
    hasValidAdjacentTile((t) =>
      checkTileIgnitable(S.terrain, S.effects, t.x, t.y),
    )
  const canBlob =
    blob &&
    hasValidAdjacentTile((t) =>
      checkTileSpreadableForBlob(S.terrain, S.effects, t.x, t.y),
    )

  const penned = ADJACENT_OFFSETS.some((o) =>
    ['water', 'swamp', 'rock'].includes(
      S.terrain[ENEMY_WIZARD.y + o.y]?.[ENEMY_WIZARD.x + o.x],
    ),
  )

  if (canBlob && (penned || !canFire))
    return { kind: 'escape', spell: blob, aimPos: null }
  if (canFire) return { kind: 'escape', spell: fire, aimPos: null }
  if (canBlob) return { kind: 'escape', spell: blob, aimPos: null }

  const vine = usableSpell('Tangle Vine')
  if (vine) {
    const aim = pickEscapeVineAim(S, vine)
    if (aim) return { kind: 'escape', spell: vine, aimPos: aim }
  }

  return null
}

function hasAdjacentFlyingMount(S) {
  return ADJACENT_OFFSETS.some((o) => {
    const cell = S.objects[ENEMY_WIZARD.y + o.y]?.[ENEMY_WIZARD.x + o.x]
    return (
      cell?.type === 'creature' &&
      cell.owner === 'enemy' &&
      !cell.mount &&
      isFlyingMount(cell.stats)
    )
  })
}

function chooseRouteMount(S) {
  const ctx = {
    terrainLayer: S.terrain,
    objectLayer: S.objects,
    itemLayer: S.items,
    portal: S.portal,
  }
  if (!needsDifferentMount(ctx) || findFittingAdjacentMount(ctx)) return null

  const free = countFreeSummonTiles(S)
  let best = null
  for (const spell of ENEMY_SPELLBOOK) {
    if (spell.category !== 'creature' || spell.currentSpellLevel <= 0) continue
    const cost = spell.manaCost * spell.currentSpellLevel
    if (ENEMY_WIZARD.current_mana < cost) continue
    // One free tile is enough: he only needs a single ride.
    if (free < 1) continue
    const stats = CREATURES.find((c) => c.name === spell.name)
    if (!stats?.mount || !mountFits(ctx, stats)) continue
    if (!best || stats.combat > best.stats.combat) best = { spell, stats }
  }
  return best
}

function chooseBreach(S) {
  if (!S.portal) return null
  if (getQuestOn() && !isSiegeBreach()) return null
  const plan = planBreach({
    terrainLayer: S.terrain,
    objectLayer: S.objects,
    itemLayer: S.items,
    effectLayer: S.effects,
    portal: S.portal,
  })
  if (!plan || plan.pending || !plan.atSpot) return null
  return { kind: 'breach', spell: plan.spell, aimPos: plan.aim }
}

function chooseSummon(S) {
  const wiz = ENEMY_WIZARD

  if (countOwnMatching(S.objects, () => true) >= MAX_ARMY_SIZE) return null

  if (S.portal) {
    const wanted = getQuestWant()
    if (wanted && countFreeSummonTiles(S) >= 1) {
      const spell = ENEMY_SPELLBOOK.find(
        (sp) =>
          sp.category === 'creature' &&
          sp.name === wanted &&
          sp.currentSpellLevel > 0 &&
          ENEMY_WIZARD.current_mana >= sp.manaCost * sp.currentSpellLevel,
      )
      if (spell) return { kind: 'summon', spell, aimPos: null }
    }
    const ride = getQuestOn() ? null : chooseRouteMount(S)
    if (ride) return { kind: 'summon', spell: ride.spell, aimPos: null }
  }

  const mounted = !!S.objects[wiz.y][wiz.x]?.mount

  const pick = pickArmySpell({
    spellbook: S.portal
      ? ENEMY_SPELLBOOK.filter((sp) => !getQuestKeep().includes(sp.name))
      : ENEMY_SPELLBOOK,
    mana: wiz.current_mana,
    freeTileCount: Math.max(
      0,
      countFreeSummonTiles(S) - (S.portal && getQuestReserve() > 0 ? 1 : 0),
    ),
    terrainCounts: S.terrainCounts,
    wizardMounted: mounted,
    countOwn: (pred) => countOwnMatching(S.objects, pred),
    needsFlyingRide: !mounted && !hasAdjacentFlyingMount(S),
  })

  return pick ? { kind: 'summon', spell: pick.spell, aimPos: null } : null
}

function executeCast(S, { spell, aimPos }) {
  const wiz = ENEMY_WIZARD
  const cost = spell.manaCost * spell.currentSpellLevel

  const isTileFree = (tile) =>
    isTileFreeForCast(S.terrain, S.objects, S.effects, tile.x, tile.y)
  const isTileIgnitable = (tile) =>
    checkTileIgnitable(S.terrain, S.effects, tile.x, tile.y)
  const isTileSpreadableForBlob = (tile) =>
    checkTileSpreadableForBlob(S.terrain, S.effects, tile.x, tile.y)
  const isTileValidForVine = (tile) =>
    checkTileValidForVineCast(S.terrain, S.effects, tile.x, tile.y)
  const isTileValidForFlood = (tile) =>
    checkTileValidForFloodCast(S.terrain, S.effects, tile.x, tile.y)

  const isTileValidForHeal = (tile) => {
    const cell = S.objects[tile.y]?.[tile.x]
    return (
      !!cell &&
      (cell.type === 'enemyWizard' ||
        (cell.type === 'creature' && cell.owner === 'enemy'))
    )
  }

  const healTile = (tile) => {
    const cell = S.objects[tile.y][tile.x]
    if (!cell) return

    if (cell.type === 'enemyWizard') wiz.current_health = wiz.constitution

    if (cell.type === 'creature' || cell.mount) {
      let updated = cell
      if (cell.type === 'creature')
        updated = { ...updated, current_health: cell.stats.constitution }
      if (cell.mount)
        updated = {
          ...updated,
          mount: {
            ...cell.mount,
            current_health: cell.mount.stats.constitution,
          },
        }

      const copy = S.objects.map((row) => [...row])
      copy[tile.y][tile.x] = updated
      S.objects = copy
    }
  }

  const spawnCreature = (creatureName, tile) => {
    const creatureData = CREATURES.find((c) => c.name === creatureName)
    const copy = S.objects.map((row) => [...row])
    copy[tile.y][tile.x] = {
      type: 'creature',
      owner: 'enemy',
      name: creatureName,
      x: tile.x,
      y: tile.y,
      ap: getMaxAp(creatureData),
      current_health: creatureData.constitution,
      stats: creatureData,
      wanderTarget: null,
      inventory: [],
    }
    S.objects = copy
  }

  const placeEffect = (tile, create) => {
    const copy = S.effects.map((row) => [...row])
    copy[tile.y][tile.x] = create('enemy')
    S.effects = copy
  }

  const zapTile = (tile, level) => {
    const result = applyMagicDamage(S.objects, tile, level)
    S.objects = result.objectLayer
    S.zapEffects.push({ x: tile.x, y: tile.y })
  }

  castSpell({
    spell,
    casterPos: { x: wiz.x, y: wiz.y },
    aimPos,
    isTileFree,
    spawnCreature,
    isTileIgnitable,
    igniteTile: (tile) => placeEffect(tile, createFireEffect),
    isTileSpreadableForBlob,
    spreadBlobTile: (tile) => placeEffect(tile, createBlobEffect),
    isTileValidForVine,
    applyVineToTile: (tile) => placeEffect(tile, createVineEffect),
    isTileValidForFlood,
    applyFloodToTile: (tile) => placeEffect(tile, createFloodEffect),
    isTileValidForHeal,
    healTile,
    zapTile,
  })

  wiz.current_mana -= cost
  spell.currentSpellLevel = Math.max(0, spell.currentSpellLevel - 1)

  S.casts++
  S.frames.push(S.objects)
}

export function castEnemyWizardSpells(
  terrainLayer,
  objectLayer,
  effectLayer,
  itemLayer = null,
  portalPosition = null,
) {
  if (!portalPosition) clearBreachMarks()
  else ageBreachMarks()

  if (isCurrentlyFlying(objectLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x])) {
    return {
      objectLayer,
      effectLayer,
      zapEffects: [],
      frames: [],
      castCount: 0,
      startThreat: { total: 0, units: [] },
    }
  }

  const S = {
    terrain: terrainLayer,
    objects: objectLayer,
    effects: effectLayer,
    items: itemLayer,
    portal: portalPosition,
    zapEffects: [],
    frames: [],
    casts: 0,
    terrainCounts: countTerrainAround(
      terrainLayer,
      ENEMY_WIZARD.x,
      ENEMY_WIZARD.y,
    ),
  }

  const startThreat = scanThreat(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
  let zaps = 0

  for (let i = 0; i < MAX_CASTS_PER_TURN; i++) {
    const threat = scanThreat(S.objects, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
    const tier = getThreatTier(threat.total)

    let action = chooseHeal(S)
    if (!action && tier !== 'calm' && zaps < MAX_ZAPS_PER_TURN)
      action = chooseZap(S, tier)
    if (!action) action = chooseEscape(S)
    if (!action) action = chooseBreach(S)
    if (!action) action = chooseSummon(S)
    if (!action) break

    console.debug(
      `[enemy wizard] ${action.kind}: ${action.spell.name} (threat ${threat.total}, ${tier})`,
    )

    const before = S.effects
    executeCast(S, action)
    if (action.kind === 'summon' && action.spell.name === getQuestWant())
      clearQuestWant()
    if (action.kind === 'zap') zaps++
    if (
      action.kind === 'breach' ||
      (action.kind === 'escape' && action.spell.name === 'Tangle Vine')
    ) {
      for (let y = 0; y < S.effects.length; y++)
        for (let x = 0; x < S.effects[y].length; x++)
          if (S.effects[y][x] && S.effects[y][x] !== before[y][x])
            markBreach(x, y, S.effects[y][x].type)
    }
  }

  return {
    objectLayer: S.objects,
    effectLayer: S.effects,
    zapEffects: S.zapEffects,
    frames: S.frames,
    castCount: S.casts,
    startThreat,
  }
}
