import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { ENEMY_SPELLBOOK } from '../data/enemySpellbook.js'
import { CREATURES } from '../data/creatures.js'
import { castSpell, RANGED_SPELL_BASE_RANGE } from './spellCaster.js'
import { applyMagicDamage } from './combat.js'
import { getMaxAp } from './mounts.js'
import { pickArmySpell } from './enemyArmy.js'
import { scanThreat, countTerrainAround, listPlayerUnitsInRange, findBestBlast } from './enemyScans.js'
import {
  createFireEffect,
  createBlobEffect,
  createVineEffect,
  createFloodEffect,
  isTileIgnitable as checkTileIgnitable,
  isTileSpreadableForBlob as checkTileSpreadableForBlob,
  isTileValidForVineCast as checkTileValidForVineCast,
  isTileValidForFloodCast as checkTileValidForFloodCast
} from './environmentEffects.js'

export const ZAP_THRESHOLD = 60
export const HIGH_THREAT_THRESHOLD = 120

const MAX_CASTS_PER_TURN = 6
const MAX_ZAPS_PER_TURN = 2

export const MAX_ARMY_SIZE = 40
const HEAL_SELF_BELOW = 0.5
const HEAL_ALLY_BELOW = 0.4

const ADJACENT_OFFSETS = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
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
  const blockedTerrain = ['wall', 'water', 'mountain', 'lava', 'doorLocked', 'doorUnlocked']
  if (blockedTerrain.includes(terrain)) return false

  if (objectLayer[y][x] !== null) return false
  if (effectLayer[y][x] !== null) return false

  return true
}

function countFreeSummonTiles(S) {
  return ADJACENT_OFFSETS.filter(o =>
    isTileFreeForCast(S.terrain, S.objects, S.effects, ENEMY_WIZARD.x + o.x, ENEMY_WIZARD.y + o.y)
  ).length
}

function countOwnMatching(objectLayer, pred) {
  let count = 0
  for (const row of objectLayer) {
    for (const cell of row) {
      if (!cell) continue
      if (cell.type === 'creature' && cell.owner === 'enemy' && pred(cell.stats)) count++
      if (cell.type === 'enemyWizard' && cell.mount && pred(cell.mount.stats)) count++
    }
  }
  return count
}

function usableSpell(name) {
  const spell = ENEMY_SPELLBOOK.find(s => s.name === name)
  if (!spell || spell.currentSpellLevel <= 0) return null
  if (ENEMY_WIZARD.current_mana < spell.manaCost * spell.currentSpellLevel) return null
  return spell
}

function chooseHeal(S) {
  const heal = usableSpell('Healing Potion')
  if (!heal) return null

  const wiz = ENEMY_WIZARD
  const here = S.objects[wiz.y][wiz.x]

  const wizardHurt = wiz.current_health <= wiz.constitution * HEAL_SELF_BELOW
  const mountHurt = !!here?.mount && here.mount.current_health <= here.mount.stats.constitution * HEAL_SELF_BELOW

  if (wizardHurt || mountHurt) {
    return { kind: 'heal', spell: heal, aimPos: { x: wiz.x, y: wiz.y } }
  }

  for (const o of ADJACENT_OFFSETS) {
    const x = wiz.x + o.x
    const y = wiz.y + o.y
    const cell = S.objects[y]?.[x]
    if (cell?.type !== 'creature' || cell.owner !== 'enemy') continue

    const ratio = cell.current_health / cell.stats.constitution
    const mountRatio = cell.mount ? cell.mount.current_health / cell.mount.stats.constitution : 1
    if (Math.min(ratio, mountRatio) <= HEAL_ALLY_BELOW) {
      return { kind: 'heal', spell: heal, aimPos: { x, y } }
    }
  }

  return null
}

function hasValidAdjacentTile(isValid) {
  return ADJACENT_OFFSETS.some(o => isValid({ x: ENEMY_WIZARD.x + o.x, y: ENEMY_WIZARD.y + o.y }))
}

function chooseZap(S, tier) {
  const wiz = ENEMY_WIZARD
  const caster = { x: wiz.x, y: wiz.y }

  const lightning = usableSpell('Magic Lightning')
  const bolt = usableSpell('Magic Bolt')
  const flood = usableSpell('Flood')
  const vine = usableSpell('Tangle Vine')

  const zap = (spell, pos) => ({ kind: 'zap', spell, aimPos: { x: pos.x, y: pos.y } })

  let lightningBest = null
  if (lightning) {
    lightningBest = findBestBlast(S.objects, caster, lightning.currentSpellLevel, 1)
    if (lightningBest && lightningBest.net > 0 && lightningBest.hitPlayerUnits >= 2) {
      return zap(lightning, lightningBest)
    }
  }

  if (flood) {
    const level = flood.currentSpellLevel
    const best = findBestBlast(S.objects, caster, RANGED_SPELL_BASE_RANGE + level, level, { mode: 'units', minClearance: 2 })
    if (best && best.net > 0 && best.hitPlayerUnits >= 3) return zap(flood, best)
  }

  if (bolt) {
    const targets = listPlayerUnitsInRange(S.objects, wiz.x, wiz.y, bolt.currentSpellLevel)
    if (targets.length > 0) return zap(bolt, targets[0])
  }

  if (lightningBest && lightningBest.net > 0) return zap(lightning, lightningBest)

  if (vine) {
    const level = vine.currentSpellLevel
    const best = findBestBlast(S.objects, caster, RANGED_SPELL_BASE_RANGE + level, level, { mode: 'units', minClearance: 2 })
    if (best && best.net > 0 && best.hitPlayerUnits >= 2) return zap(vine, best)
  }

  if (tier === 'high') {
    const fire = usableSpell('Magic Fire')
    if (fire && hasValidAdjacentTile(t => checkTileIgnitable(S.terrain, S.effects, t.x, t.y))) {
      return { kind: 'zap', spell: fire, aimPos: null }
    }

    const blob = usableSpell('Gooey Blob')
    if (blob && hasValidAdjacentTile(t => checkTileSpreadableForBlob(S.terrain, S.effects, t.x, t.y))) {
      return { kind: 'zap', spell: blob, aimPos: null }
    }
  }

  return null
}

function chooseSummon(S) {
  const wiz = ENEMY_WIZARD

  if (countOwnMatching(S.objects, () => true) >= MAX_ARMY_SIZE) return null

  const pick = pickArmySpell({
    spellbook: ENEMY_SPELLBOOK,
    mana: wiz.current_mana,
    freeTileCount: countFreeSummonTiles(S),
    terrainCounts: S.terrainCounts,
    wizardMounted: !!S.objects[wiz.y][wiz.x]?.mount,
    countOwn: (pred) => countOwnMatching(S.objects, pred)
  })

  return pick ? { kind: 'summon', spell: pick.spell, aimPos: null } : null
}

function executeCast(S, { spell, aimPos }) {
  const wiz = ENEMY_WIZARD
  const cost = spell.manaCost * spell.currentSpellLevel

  const isTileFree = (tile) => isTileFreeForCast(S.terrain, S.objects, S.effects, tile.x, tile.y)
  const isTileIgnitable = (tile) => checkTileIgnitable(S.terrain, S.effects, tile.x, tile.y)
  const isTileSpreadableForBlob = (tile) => checkTileSpreadableForBlob(S.terrain, S.effects, tile.x, tile.y)
  const isTileValidForVine = (tile) => checkTileValidForVineCast(S.terrain, S.effects, tile.x, tile.y)
  const isTileValidForFlood = (tile) => checkTileValidForFloodCast(S.terrain, S.effects, tile.x, tile.y)

  const isTileValidForHeal = (tile) => {
    const cell = S.objects[tile.y]?.[tile.x]
    return !!cell && (cell.type === 'enemyWizard' || (cell.type === 'creature' && cell.owner === 'enemy'))
  }

  const healTile = (tile) => {
    const cell = S.objects[tile.y][tile.x]
    if (!cell) return

    if (cell.type === 'enemyWizard') wiz.current_health = wiz.constitution

    if (cell.type === 'creature' || cell.mount) {
      let updated = cell
      if (cell.type === 'creature') updated = { ...updated, current_health: cell.stats.constitution }
      if (cell.mount) updated = { ...updated, mount: { ...cell.mount, current_health: cell.mount.stats.constitution } }

      const copy = S.objects.map(row => [...row])
      copy[tile.y][tile.x] = updated
      S.objects = copy
    }
  }

  const spawnCreature = (creatureName, tile) => {
    const creatureData = CREATURES.find(c => c.name === creatureName)
    const copy = S.objects.map(row => [...row])
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
      inventory: []
    }
    S.objects = copy
  }

  const placeEffect = (tile, create) => {
    const copy = S.effects.map(row => [...row])
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
    zapTile
  })

  wiz.current_mana -= cost
  spell.currentSpellLevel = Math.max(0, spell.currentSpellLevel - 1)

  S.casts++
  S.frames.push(S.objects)
}

export function castEnemyWizardSpells(terrainLayer, objectLayer, effectLayer) {
  const S = {
    terrain: terrainLayer,
    objects: objectLayer,
    effects: effectLayer,
    zapEffects: [],
    frames: [],
    casts: 0,
    terrainCounts: countTerrainAround(terrainLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
  }

  const startThreat = scanThreat(objectLayer, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
  let zaps = 0

  for (let i = 0; i < MAX_CASTS_PER_TURN; i++) {
    const threat = scanThreat(S.objects, ENEMY_WIZARD.x, ENEMY_WIZARD.y)
    const tier = getThreatTier(threat.total)

    let action = chooseHeal(S)
    if (!action && tier !== 'calm' && zaps < MAX_ZAPS_PER_TURN) action = chooseZap(S, tier)
    if (!action) action = chooseSummon(S)
    if (!action) break

    console.debug(`[enemy wizard] ${action.kind}: ${action.spell.name} (threat ${threat.total}, ${tier})`)

    executeCast(S, action)
    if (action.kind === 'zap') zaps++
  }

  return {
    objectLayer: S.objects,
    effectLayer: S.effects,
    zapEffects: S.zapEffects,
    frames: S.frames,
    castCount: S.casts,
    startThreat
  }
}