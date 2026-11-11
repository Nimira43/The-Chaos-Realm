import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { PLAYER } from '../data/player.js'
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  IMPASSABLE_THRESHOLD,
  getMovementCost,
} from './terrain.js'
import { wrap } from './utils.js'
import { getCellCombatValue } from './combat.js'
import { isPlayerSide } from './enemyScans.js'
import { isCurrentlyFlying } from './mounts.js'

export const DANGER_REACH = 0.5
export const DANGER_FRACTION = 0.2
export const DANGER_MIN_TOLERANCE = 15
const ROLL_ALLOWANCE = 5
const MAX_BLOWS = 3
const BLOW_AP_COST = 2

const SHIELDING_TERRAIN = [
  'floor',
  'portal',
  'doorLocked',
  'doorUnlocked',
  'doorOpen',
]
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

function unitProfile(cell) {
  const base = cell.mount
    ? cell.mount.stats
    : cell.type === 'player'
      ? PLAYER
      : cell.stats
  const walking = {
    ap: base.action_points_ground ?? base.max_ap ?? 0,
    mover: { ...base, isFlyingNow: false },
  }
  const airAp = base.action_points_flying ?? 0
  const flying =
    airAp > 0 ? { ap: airAp, mover: { ...base, isFlyingNow: true } } : null
  return { walking, flying, combat: getCellCombatValue(cell) }
}

function attackZone(terrainLayer, x, y, how) {
  const budget = Math.floor(how.ap * DANGER_REACH)
  const zone = Array.from(
    { length: MAP_HEIGHT },
    () => new Uint8Array(MAP_WIDTH),
  )
  const blows = (cost) =>
    Math.max(
      1,
      Math.min(MAX_BLOWS, Math.floor((how.ap - cost) / BLOW_AP_COST)),
    )
  const best = new Map([[`${x},${y}`, 0]])
  const buckets = [[{ x, y }]]

  for (let cost = 0; cost < buckets.length && cost <= budget; cost++) {
    for (const cur of buckets[cost] || []) {
      if (best.get(`${cur.x},${cur.y}`) !== cost) continue
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ty = wrap(cur.y + dy, MAP_HEIGHT)
          const tx = wrap(cur.x + dx, MAP_WIDTH)
          zone[ty][tx] = Math.max(zone[ty][tx], blows(cost))
        }

      for (const [dx, dy] of NEIGHBOURS) {
        const nx = wrap(cur.x + dx, MAP_WIDTH)
        const ny = wrap(cur.y + dy, MAP_HEIGHT)
        const step = getMovementCost(terrainLayer[ny][nx], how.mover)
        if (step >= IMPASSABLE_THRESHOLD) continue
        const total = cost + step
        if (total > budget) continue
        const key = `${nx},${ny}`
        if (best.has(key) && best.get(key) <= total) continue
        best.set(key, total);
        (buckets[total] ||= []).push({ x: nx, y: ny })
      }
    }
  }
  return zone
}

export function buildDanger(objectLayer, terrainLayer) {
  const units = []
  for (let y = 0; y < objectLayer.length; y++) {
    for (let x = 0; x < objectLayer[y].length; x++) {
      const cell = objectLayer[y][x]
      if (!isPlayerSide(cell)) continue
      const unit = unitProfile(cell)
      if (unit.combat <= 0) continue
      units.push({
        combat: unit.combat,
        ground: attackZone(terrainLayer, x, y, unit.walking),
        air: unit.flying ? attackZone(terrainLayer, x, y, unit.flying) : null,
      })
    }
  }

  const wizardCell = objectLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
  const defence = wizardCell?.mount
    ? wizardCell.mount.stats.defence
    : ENEMY_WIZARD.defence
  const tolerance = Math.max(
    DANGER_MIN_TOLERANCE,
    ENEMY_WIZARD.current_health * DANGER_FRACTION,
  )
  const memo = new Map()

  const at = (x, y, flying) => {
    const key = `${x},${y},${flying ? 1 : 0}`
    if (memo.has(key)) return memo.get(key)

    const shielded = SHIELDING_TERRAIN.includes(terrainLayer[y][x])
    let total = 0
    for (const u of units) {
      let blows = 0
      if (flying) {
        blows = u.air ? u.air[y][x] : 0
      } else if (shielded) {
        blows = u.ground[y][x]
      } else {
        blows = Math.max(u.ground[y][x], u.air ? u.air[y][x] : 0)
      }
      if (!blows) continue
      total += blows * Math.max(1, u.combat + ROLL_ALLOWANCE - defence)
    }
    memo.set(key, total)
    return total
  }

  const isSafe = (x, y, flying) => at(x, y, flying) < tolerance

  const markUnsafe = (layer, flying, keep) =>
    layer.map((row, y) =>
      row.map((cell, x) =>
        cell || (x === keep.x && y === keep.y) || isSafe(x, y, flying)
          ? cell
          : { type: 'danger' },
      ),
    )

  return { at, isSafe, tolerance, markUnsafe, unitCount: units.length }
}

export function canHitTarget(terrainLayer, objectLayer, flyingAttacker, pos) {
  const cell = objectLayer[pos.y][pos.x]
  if (!cell) return true
  if (isCurrentlyFlying(cell)) return flyingAttacker
  if (!flyingAttacker) return true
  return !SHIELDING_TERRAIN.includes(terrainLayer[pos.y][pos.x])
}
