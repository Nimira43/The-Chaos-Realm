import { planQuest } from './enemyQuest.js'
import { countKeys } from './enemyMountPlan.js'
import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { ENEMY_SPELLBOOK } from '../data/enemySpellbook.js'
import { CREATURES } from '../data/creatures.js'
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  IMPASSABLE_THRESHOLD,
  getMovementCost,
} from './terrain.js'
import { wrap, wrappedChebyshevDistance } from './utils.js'
import { RANGED_SPELL_BASE_RANGE } from './spellCaster.js'
import { canLandOn } from './useMountActions.js'
import { canFly } from './mounts.js'
import {
  isTileIgnitable,
  isTileSpreadableForBlob,
} from './environmentEffects.js'
import {
  hasGroundRoute,
  mountFits,
  currentSetupFits,
} from './enemyMountPlan.js'

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

const TEST_RIDES = ['Sea Wolf', 'Cindermaw', 'Gryphon']
const LOOK_AHEAD = 24
const WALL_COST = 25
const LOCKED_DOOR_COST = 3
const BLOCKS_DIAGONAL = ['wall', 'mountain', 'doorLocked', 'doorUnlocked']
const BREAKABLE = ['wall', 'doorLocked']

let committed = null

const marks = new Map()
const ages = new Map()
const MAX_PENDING_TURNS = 8

export function clearBreachMarks() {
  marks.clear()
  ages.clear()
  committed = null
}

export function markBreach(x, y, type) {
  marks.set(`${x},${y}`, type)
  ages.set(`${x},${y}`, 0)
}

export function ageBreachMarks() {
  for (const key of [...marks.keys()]) {
    const age = (ages.get(key) ?? 0) + 1
    if (age > MAX_PENDING_TURNS) {
      marks.delete(key)
      ages.delete(key)
    } else {
      ages.set(key, age)
    }
  }
}

export function isBreachMark(effectLayer, x, y) {
  const type = marks.get(`${x},${y}`)
  const effect = effectLayer[y][x]
  if (!type || !effect || effect.type !== type || effect.owner !== 'enemy')
    return false
  return true
}

export function listBreachMarks(effectLayer) {
  const found = []
  for (const key of [...marks.keys()]) {
    const [x, y] = key.split(',').map(Number)
    if (isBreachMark(effectLayer, x, y)) found.push({ x, y })
    else {
      marks.delete(key)
      ages.delete(key)
    }
  }
  return found
}

const landingRequests = new Set()
const rideHolds = new Set()

export function holdRide(t) {
  rideHolds.add(`${t.x},${t.y}`)
}

export function isRideHeld(x, y) {
  return rideHolds.has(`${x},${y}`)
}

export function clearLandingRequests() {
  landingRequests.clear()
  rideHolds.clear()
}

export function requestLandingClear(tiles) {
  for (const t of tiles) landingRequests.add(`${t.x},${t.y}`)
}

export function isLandingClearRequested(x, y) {
  return landingRequests.has(`${x},${y}`)
}

function footStats() {
  return { ...ENEMY_WIZARD, isFlyingNow: false }
}

function spellNamed(name) {
  const spell = ENEMY_SPELLBOOK.find((s) => s.name === name)
  if (!spell || spell.currentSpellLevel <= 0) return null
  if (ENEMY_WIZARD.current_mana < spell.manaCost * spell.currentSpellLevel)
    return null
  return spell
}

const BIG_VINE_LEVEL = 3

export function pickBreachSpell() {
  const vine = spellNamed('Tangle Vine')
  if (vine && vine.currentSpellLevel <= BIG_VINE_LEVEL) return vine
  return spellNamed('Gooey Blob') || spellNamed('Magic Fire') || vine
}

export function isSealed(ctx) {
  const from = { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y }
  if (hasGroundRoute(ctx.terrainLayer, footStats(), from, ctx.portal))
    return false
  if (currentSetupFits(ctx)) return false
  for (const name of TEST_RIDES) {
    const stats = CREATURES.find((c) => c.name === name)
    if (stats && mountFits(ctx, stats)) return false
  }
  return true
}

function tileCost(terrain, canAir) {
  if (terrain === 'mountain') return canAir ? 4 : null
  if (terrain === 'wall') return WALL_COST
  if (terrain === 'doorLocked') return LOCKED_DOOR_COST
  if (terrain === 'doorUnlocked') return 2
  if (terrain === 'water' || terrain === 'lava') return 3
  return 1
}

function findBreachPath(terrainLayer, portal, canAir) {
  const start = { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y }
  const size = MAP_WIDTH * MAP_HEIGHT
  const index = (x, y) => y * MAP_WIDTH + x
  const best = new Array(size).fill(Infinity)
  const prev = new Array(size).fill(-1)
  const done = new Array(size).fill(false)
  best[index(start.x, start.y)] = 0

  for (;;) {
    let at = -1
    let lowest = Infinity
    for (let i = 0; i < size; i++) {
      if (!done[i] && best[i] < lowest) {
        lowest = best[i]
        at = i
      }
    }
    if (at === -1) return null
    if (at === index(portal.x, portal.y)) break
    done[at] = true

    const cx = at % MAP_WIDTH
    const cy = Math.floor(at / MAP_WIDTH)
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = wrap(cx + dx, MAP_WIDTH)
      const ny = wrap(cy + dy, MAP_HEIGHT)
      const cost = tileCost(terrainLayer[ny][nx], canAir)
      if (cost === null) continue
      if (dx !== 0 && dy !== 0) {
        if (
          BLOCKS_DIAGONAL.includes(terrainLayer[cy][nx]) ||
          BLOCKS_DIAGONAL.includes(terrainLayer[ny][cx])
        )
          continue
      }
      const next = index(nx, ny)
      if (lowest + cost < best[next]) {
        best[next] = lowest + cost
        prev[next] = at
      }
    }
  }

  const path = []
  for (let at = index(portal.x, portal.y); at !== -1; at = prev[at])
    path.unshift({ x: at % MAP_WIDTH, y: Math.floor(at / MAP_WIDTH) })
  return path
}

function reachableGround(terrainLayer) {
  const stats = footStats()
  const seen = new Set()
  const open = (x, y) =>
    getMovementCost(terrainLayer[y][x], stats) < IMPASSABLE_THRESHOLD
  const start = { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y }
  seen.add(`${start.x},${start.y}`)
  const queue = [start]
  while (queue.length > 0) {
    const cur = queue.shift()
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = wrap(cur.x + dx, MAP_WIDTH)
      const ny = wrap(cur.y + dy, MAP_HEIGHT)
      const key = `${nx},${ny}`
      if (seen.has(key) || !open(nx, ny)) continue
      if (dx !== 0 && dy !== 0 && (!open(nx, cur.y) || !open(cur.x, ny)))
        continue
      seen.add(key)
      queue.push({ x: nx, y: ny })
    }
  }
  return seen
}

function canStandOn(ctx, x, y, airStats = null) {
  const terrain = ctx.terrainLayer[y][x]
  if (airStats && !canLandOn(terrain, airStats, ctx.itemLayer?.[y]?.[x]))
    return false
  if (['lava', 'water', 'portal', 'wall'].includes(terrain)) return false
  if (terrain.startsWith('door')) return false
  if (ctx.effectLayer[y][x]) return false
  const here = ctx.objectLayer[y][x]
  if (here && here.type !== 'enemyWizard') return false
  return true
}

function pendingBreach(effectLayer) {
  return listBreachMarks(effectLayer).length > 0
}

export function planBreach(ctx) {
  const plan = makePlan(ctx)
  if (!plan || plan.pending) {
    if (!plan) committed = null
    return plan
  }
  committed = { portal: ctx.portal, tile: plan.tile }
  return plan
}

function makePlan(ctx) {
  const { terrainLayer, objectLayer, effectLayer, portal } = ctx
  if (!portal) return null
  if (pendingBreach(effectLayer)) return { pending: true }

  const spell = pickBreachSpell()
  if (!spell) return null
  if (
    !isSealed(ctx) &&
    planQuest({ ...ctx, keysHeld: countKeys(ENEMY_WIZARD.inventory) })
  )
    return null

  const here = objectLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
  const airStats =
    here?.mount && canFly(here.mount.stats) ? here.mount.stats : null

  const path = findBreachPath(terrainLayer, portal, !!airStats)
  if (!path) return null

  const breakables = path.filter((p) =>
    BREAKABLE.includes(terrainLayer[p.y][p.x]),
  )
  if (breakables.length === 0) return null

  const keep =
    committed?.portal.x === portal.x &&
    committed?.portal.y === portal.y &&
    BREAKABLE.includes(terrainLayer[committed.tile.y][committed.tile.x])
      ? committed.tile
      : null

  const ordered = [...breakables].reverse().slice(0, LOOK_AHEAD)
  if (keep) {
    const at = ordered.findIndex((b) => b.x === keep.x && b.y === keep.y)
    if (at > 0) ordered.unshift(...ordered.splice(at, 1))
    else if (at === -1) ordered.unshift(keep)
  }

  const reach = reachableGround(terrainLayer)
  const pickSpots = (candidates) => {
    const onFoot = candidates.filter((c) => reach.has(`${c.x},${c.y}`))
    if (onFoot.length > 0) return { spots: onFoot, byAir: false }
    return { spots: candidates, byAir: candidates.length > 0 }
  }
  const standable = (x, y) =>
    reach.has(`${x},${y}`)
      ? canStandOn(ctx, x, y)
      : !!airStats && canStandOn(ctx, x, y, airStats)
  const wiz = { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y }
  const level = spell.currentSpellLevel
  const dist = (a, b) =>
    wrappedChebyshevDistance(a.x, a.y, b.x, b.y, MAP_WIDTH, MAP_HEIGHT)

  if (spell.name === 'Tangle Vine') {
    const range = RANGED_SPELL_BASE_RANGE + level
    const near = breakables

    for (const first of ordered) {
      const found = planVineAt(first)
      if (found) return found
    }
    return null

    function planVineAt(first) {
      let best = null
      for (let dy = -level; dy <= level; dy++) {
        for (let dx = -level; dx <= level; dx++) {
          const aim = {
            x: wrap(first.x + dx, MAP_WIDTH),
            y: wrap(first.y + dy, MAP_HEIGHT),
          }
          if (terrainLayer[aim.y][aim.x] === 'mountain') continue

          const candidates = []
          for (let sy = -range; sy <= range; sy++) {
            for (let sx = -range; sx <= range; sx++) {
              const spot = {
                x: wrap(aim.x + sx, MAP_WIDTH),
                y: wrap(aim.y + sy, MAP_HEIGHT),
              }
              const d = dist(spot, aim)
              if (d <= level || d > range) continue
              if (!standable(spot.x, spot.y)) continue
              candidates.push(spot)
            }
          }
          const { spots, byAir } = pickSpots(candidates)
          if (spots.length === 0) continue

          const cuttable =
            byAir ||
            near.some(
              (b) =>
                dist(b, aim) <= level &&
                NEIGHBOURS.some(([dx, dy]) =>
                  reach.has(
                    `${wrap(b.x + dx, MAP_WIDTH)},${wrap(b.y + dy, MAP_HEIGHT)}`,
                  ),
                ),
            )
          if (!cuttable) continue

          let walls = 0
          for (const b of near) if (dist(b, aim) <= level) walls++
          let own = 0
          for (let ay = -level; ay <= level; ay++) {
            for (let ax = -level; ax <= level; ax++) {
              const cell =
                objectLayer[wrap(aim.y + ay, MAP_HEIGHT)][
                  wrap(aim.x + ax, MAP_WIDTH)
                ]
              if (cell?.owner === 'enemy') own++
            }
          }
          const score = walls * 10 - own * 4 - (byAir ? 5 : 0)
          if (!best || score > best.score) best = { aim, spots, byAir, score }
        }
      }
      if (!best) return null

      const atSpot = best.spots.some((s) => s.x === wiz.x && s.y === wiz.y)
      return {
        spell,
        aim: best.aim,
        spots: best.spots,
        byAir: best.byAir,
        atSpot,
        tile: first,
      }
    }
  }

  const valid =
    spell.name === 'Magic Fire'
      ? (x, y) => isTileIgnitable(terrainLayer, effectLayer, x, y)
      : (x, y) => isTileSpreadableForBlob(terrainLayer, effectLayer, x, y)

  for (const tile of ordered) {
    const candidates = []
    for (const [dx, dy] of NEIGHBOURS) {
      const spot = {
        x: wrap(tile.x + dx, MAP_WIDTH),
        y: wrap(tile.y + dy, MAP_HEIGHT),
      }
      if (!standable(spot.x, spot.y)) continue
      let crowd = 0
      for (const [ex, ey] of NEIGHBOURS)
        if (valid(wrap(spot.x + ex, MAP_WIDTH), wrap(spot.y + ey, MAP_HEIGHT)))
          crowd++
      candidates.push({ ...spot, crowd })
    }
    const { spots, byAir } = pickSpots(candidates)
    if (spots.length === 0) continue

    const fewest = Math.min(...spots.map((s) => s.crowd))
    const chosen = spots.filter((s) => s.crowd <= fewest + 1)
    const atSpot = dist(wiz, tile) <= 1
    return {
      spell,
      aim: null,
      spots: atSpot ? [wiz] : chosen,
      byAir,
      atSpot,
      tile,
    }
  }
  return null
}
