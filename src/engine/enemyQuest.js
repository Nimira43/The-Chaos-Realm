import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { ENEMY_SPELLBOOK } from '../data/enemySpellbook.js'
import { CREATURES } from '../data/creatures.js'
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  getMovementCost,
  IMPASSABLE_THRESHOLD,
} from './terrain.js'
import { canLandOn, canTakeOffFrom } from './useMountActions.js'
import { canFly, isMountCreature } from './mounts.js'
import { getAdjacentTiles } from './pathfinding.js'

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

const wrapX = (x) => ((x % MAP_WIDTH) + MAP_WIDTH) % MAP_WIDTH
const wrapY = (y) => ((y % MAP_HEIGHT) + MAP_HEIGHT) % MAP_HEIGHT
const idxOf = (x, y) => y * MAP_WIDTH + x

const isDoor = (t) => t === 'doorLocked'
const isDoorTile = (t) => t === 'doorLocked' || t === 'doorUnlocked'

const hasKey = (items) =>
  Array.isArray(items) && items.some((i) => i?.type === 'key')

function creatureStats(name) {
  return CREATURES.find((c) => c.name === name) || null
}

export function buildKit(objectLayer) {
  const kit = {}
  const add = (mode, stats, uses) => {
    if (!stats) return
    if (!kit[mode]) kit[mode] = { mode, stats, uses: 0, name: stats.name }
    kit[mode].uses += uses
    if (stats.combat > kit[mode].stats.combat) {
      kit[mode].stats = stats
      kit[mode].name = stats.name
    }
  }
  const modeOf = (stats) =>
    canFly(stats)
      ? 'fly'
      : stats.lava_type
        ? 'lava'
        : stats.water_type || stats.swims
          ? 'sea'
          : null

  for (const spell of ENEMY_SPELLBOOK) {
    if (spell.category !== 'creature' || !(spell.currentSpellLevel > 0))
      continue
    const stats = creatureStats(spell.name)
    if (!isMountCreature(stats)) continue
    const mode = modeOf(stats)
    if (mode) add(mode, stats, spell.currentSpellLevel)
  }

  const ridden = objectLayer[ENEMY_WIZARD.y]?.[ENEMY_WIZARD.x]?.mount
  if (ridden && isMountCreature(ridden.stats)) {
    const mode = modeOf(ridden.stats)
    if (mode) add(mode, ridden.stats, 1)
  }

  for (const t of getAdjacentTiles(ENEMY_WIZARD.x, ENEMY_WIZARD.y)) {
    const cell = objectLayer[t.y][t.x]
    if (
      cell?.type === 'creature' &&
      cell.owner === 'enemy' &&
      !cell.mount &&
      isMountCreature(cell.stats)
    ) {
      const mode = modeOf(cell.stats)
      if (mode) add(mode, cell.stats, 1)
    }
  }
  return kit
}

export function planQuest({
  terrainLayer,
  objectLayer,
  itemLayer,
  portal,
  keysHeld = 0,
  kit = buildKit(objectLayer),
}) {
  if (!portal) return null
  const W = MAP_WIDTH
  const H = MAP_HEIGHT
  const start = { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y }

  const foot = { ...ENEMY_WIZARD, isFlyingNow: false }
  const modes = [{ mode: 'foot', stats: foot }]
  if (kit.sea)
    modes.push({
      mode: 'sea',
      stats: { ...kit.sea.stats, isFlyingNow: false },
    })
  if (kit.lava)
    modes.push({
      mode: 'lava',
      stats: { ...kit.lava.stats, isFlyingNow: false },
    })
  const flier = kit.fly ? { ...kit.fly.stats, isFlyingNow: false } : null

  const reached = new Uint8Array(W * H)
  const parent = new Int32Array(W * H).fill(-1)
  const pMode = new Array(W * H).fill(null)
  const pKind = new Array(W * H).fill(null)
  const opened = new Set()
  const gotKeys = new Set()
  let keys = keysHeld

  const terrainAt = (x, y) => terrainLayer[y][x]

  const passable = (x, y, m) => {
    const t = terrainAt(x, y)
    if (t === 'portal') return true
    if (t === 'lava' && !m.stats.lava_type) return false
    if (isDoorTile(t)) return opened.has(idxOf(x, y))
    return getMovementCost(t, m.stats) < IMPASSABLE_THRESHOLD
  }

  const SUMMON_BLOCKED = [
    'wall',
    'water',
    'mountain',
    'lava',
    'doorLocked',
    'doorUnlocked',
  ]
  const canStartRide = (i) => {
    const x = i % W
    const y = (i / W) | 0
    if (i === idxOf(start.x, start.y)) return true
    const t = terrainAt(x, y)
    if (t === 'lava') return false
    if (isDoorTile(t)) {
      if (!opened.has(i)) return false
    } else if (getMovementCost(t, foot) >= IMPASSABLE_THRESHOLD) return false
    return DIRS.some(([dx, dy]) => {
      const nt = terrainAt(wrapX(x + dx), wrapY(y + dy))
      return !SUMMON_BLOCKED.includes(nt)
    })
  }

  const s0 = idxOf(start.x, start.y)
  reached[s0] = 1
  pMode[s0] = 'start'

  let changed = true
  let guard = 0
  while (changed && guard++ < 60) {
    changed = false

    for (const m of modes) {
      const queue = []
      for (let i = 0; i < W * H; i++)
        if (reached[i] && (m.mode === 'foot' || canStartRide(i))) queue.push(i)
      for (let qi = 0; qi < queue.length; qi++) {
        const ci = queue[qi]
        const cx = ci % W
        const cy = (ci / W) | 0
        for (const [dx, dy] of DIRS) {
          const nx = wrapX(cx + dx)
          const ny = wrapY(cy + dy)
          const ni = idxOf(nx, ny)
          if (reached[ni]) continue
          if (!passable(nx, ny, m)) continue
          if (dx && dy) {
            const ta = terrainAt(nx, cy)
            const tb = terrainAt(cx, ny)
            const blockA =
              getMovementCost(ta, m.stats) >= IMPASSABLE_THRESHOLD &&
              !opened.has(idxOf(nx, cy))
            const blockB =
              getMovementCost(tb, m.stats) >= IMPASSABLE_THRESHOLD &&
              !opened.has(idxOf(cx, ny))
            if (blockA || blockB) continue
          }
          reached[ni] = 1
          parent[ni] = ci
          pMode[ni] = m.mode
          pKind[ni] = 'step'
          queue.push(ni)
          changed = true
        }
      }
    }

    if (flier) {
      const origins = []
      for (let i = 0; i < W * H; i++) {
        if (!reached[i]) continue
        const x = i % W
        const y = (i / W) | 0
        if (
          canTakeOffFrom(terrainAt(x, y)) &&
          !isDoorTile(terrainAt(x, y)) &&
          canStartRide(i)
        )
          origins.push(i)
      }
      if (origins.length > 0) {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = idxOf(x, y)
            if (reached[i]) continue
            if (!canLandOn(terrainAt(x, y), flier, itemLayer?.[y]?.[x]))
              continue
            let best = -1
            let bestD = 1e9
            for (const o of origins) {
              const ox = o % W
              const oy = (o / W) | 0
              const ddx = Math.min(Math.abs(ox - x), W - Math.abs(ox - x))
              const ddy = Math.min(Math.abs(oy - y), H - Math.abs(oy - y))
              const d = Math.max(ddx, ddy)
              if (d < bestD) {
                bestD = d
                best = o
              }
            }
            reached[i] = 1
            parent[i] = best
            pMode[i] = 'fly'
            pKind[i] = 'hop'
            changed = true
          }
        }
      }
    }

    for (let i = 0; i < W * H; i++) {
      if (!reached[i]) continue
      const x = i % W
      const y = (i / W) | 0
      if (hasKey(itemLayer?.[y]?.[x]) && !gotKeys.has(i)) {
        gotKeys.add(i)
        keys++
        changed = true
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = idxOf(x, y)
        if (!isDoorTile(terrainAt(x, y)) || opened.has(i)) continue
        let from = -1
        for (const [dx, dy] of DIRS) {
          const ni = idxOf(wrapX(x + dx), wrapY(y + dy))
          if (reached[ni]) {
            from = ni
            break
          }
        }
        if (from < 0) continue
        if (isDoor(terrainAt(x, y))) {
          if (keys <= 0) continue
          keys--
        }
        opened.add(i)
        reached[i] = 1
        parent[i] = from
        pMode[i] = pMode[from] === 'start' ? 'foot' : pMode[from]
        pKind[i] = 'door'
        changed = true
      }
    }
  }

  const goalIdx = idxOf(portal.x, portal.y)

  const chainTo = (target) => {
    if (!reached[target]) return null
    const chain = []
    let cur = target
    let guard2 = 0
    while (cur !== s0 && cur >= 0 && guard2++ < 2000) {
      chain.push({
        x: cur % W,
        y: (cur / W) | 0,
        mode: pMode[cur],
        kind: pKind[cur],
      })
      cur = parent[cur]
    }
    if (cur !== s0) return null
    return chain.reverse()
  }

  const doorsIn = (chain) =>
    chain.filter((c) => c.kind === 'door' && isDoor(terrainAt(c.x, c.y)))

  const usable = (chain) => {
    const count = {}
    let prev = null
    for (const c of chain) {
      const label = c.mode === 'foot' ? 'foot' : c.mode
      if (label !== prev && label !== 'foot')
        count[label] = (count[label] || 0) + 1
      prev = label
    }
    for (const [mode, n] of Object.entries(count))
      if (!kit[mode] || n > kit[mode].uses) return false
    return true
  }

  let targetChain = null
  const portalChain = chainTo(goalIdx)
  if (portalChain && usable(portalChain)) {
    const need = doorsIn(portalChain).length
    if (need <= keysHeld) targetChain = { chain: portalChain, kind: 'portal' }
  }
  if (!targetChain && portalChain) {
    let bestKey = null
    for (const ki of gotKeys) {
      const c = chainTo(ki)
      if (!c || !usable(c)) continue
      if (doorsIn(c).length > keysHeld) continue
      const score = c.length + c.filter((s) => s.kind === 'hop').length * 3
      if (!bestKey || score < bestKey.score) bestKey = { chain: c, score }
    }
    if (bestKey) targetChain = { chain: bestKey.chain, kind: 'key' }
  }
  if (!targetChain) return null

  const chain = targetChain.chain
  const doorSet = new Set(doorsIn(portalChain).map((d) => `${d.x},${d.y}`))

  const first = chain[0]
  if (!first)
    return {
      kind: targetChain.kind,
      mode: 'foot',
      steps: [],
      rides: [],
      doors: doorSet,
      kit,
    }
  const mode = first.kind === 'hop' ? 'fly' : first.mode
  const steps = []
  for (const c of chain) {
    const sameMode = (c.kind === 'hop' ? 'fly' : c.mode) === mode
    if (!sameMode) break
    if (c.kind === 'door' && isDoor(terrainAt(c.x, c.y))) break
    steps.push({ x: c.x, y: c.y })
    if (c.kind === 'hop') break
  }

  const ridesNeeded = new Set()
  for (const c of [...chain, ...(portalChain || [])]) {
    const m = c.kind === 'hop' ? 'fly' : c.mode
    if (m && m !== 'foot' && m !== 'start' && kit[m]) ridesNeeded.add(m)
  }

  return {
    kind: targetChain.kind,
    rides: [...ridesNeeded],
    mode,
    hop: first.kind === 'hop',
    steps,
    end: steps.length > 0 ? steps[steps.length - 1] : null,
    doors: doorSet,
    kit,
  }
}

let reserve = 0
export const setQuestReserve = (n) => {
  reserve = n
}
export const getQuestReserve = () => reserve

let wantedRide = null
export const setQuestWant = (name) => {
  wantedRide = name
}
export const getQuestWant = () => wantedRide
export const clearQuestWant = () => {
  wantedRide = null
}

export function rideModeOf(stats) {
  if (!stats) return 'foot'
  if (canFly(stats)) return 'fly'
  if (stats.lava_type) return 'lava'
  if (stats.water_type) return 'sea'
  return 'other'
}
