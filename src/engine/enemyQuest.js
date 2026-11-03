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
import { canFly, isMountCreature, isCurrentlyFlying } from './mounts.js'
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

const searchCache = new Map()

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

  const terrainAt = (x, y) => terrainLayer[y][x]
  const s0 = idxOf(start.x, start.y)

  const airborne =
    !!flier &&
    isCurrentlyFlying(objectLayer[start.y]?.[start.x]) &&
    !canLandOn(
      terrainAt(start.x, start.y),
      flier,
      itemLayer?.[start.y]?.[start.x],
    )

  const closure = (greedy, prefill = [], light = false) => {
    const reached = new Uint8Array(W * H)
    const parent = new Int32Array(W * H).fill(-1)
    const pMode = new Array(W * H).fill(null)
    const pKind = new Array(W * H).fill(null)
    const opened = new Set(prefill)
    const gotKeys = new Set()
    let keys = keysHeld

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
      if (i === s0) return true
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

    reached[s0] = 1
    pMode[s0] = 'start'

    let changed = true
    let guard = 0
    while (changed && guard++ < 60) {
      changed = false

      for (const m of modes) {
        const queue = []
        for (let i = 0; i < W * H; i++) {
          if (!reached[i]) continue
          if (airborne && i === s0) continue
          if (m.mode === 'foot' || canStartRide(i)) queue.push(i)
        }
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
          if (airborne && i === s0) {
            origins.push(i)
            continue
          }
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
              if (light) {
                best = origins[0]
                bestD = -1
              }
              for (const o of origins) {
                if (light) break
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
        if (airborne && i === s0) continue
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
            if (!greedy || keys <= 0) continue
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
    return { reached, parent, pMode, pKind, opened, gotKeys }
  }

  const chainTo = (C, target) => {
    if (!C.reached[target]) return null
    const chain = []
    let cur = target
    let guard2 = 0
    while (cur !== s0 && cur >= 0 && guard2++ < 2000) {
      chain.push({
        x: cur % W,
        y: (cur / W) | 0,
        mode: C.pMode[cur],
        kind: C.pKind[cur],
      })
      cur = C.parent[cur]
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

  const goalIdx = idxOf(portal.x, portal.y)
  const G = closure(true)
  const portalChain = chainTo(G, goalIdx)

  const searchDoors = () => {
    let sig = `${keysHeld}|`
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = terrainAt(x, y)
        if (t === 'doorLocked' || t === 'doorUnlocked')
          sig += `${t[4]}${idxOf(x, y)},`
        if (hasKey(itemLayer?.[y]?.[x])) sig += `k${idxOf(x, y)},`
      }
    sig += `|${goalIdx}|${Object.keys(kit).join('')}`
    if (searchCache.has(sig)) return searchCache.get(sig)

    const lockedTiles = []
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (isDoor(terrainAt(x, y))) lockedTiles.push(idxOf(x, y))
    let budget = 160
    const seen = new Set()
    let baseFree = 0
    const dfs = (P, C, depth) => {
      if (C.reached[goalIdx]) return []
      if (depth >= 10 || budget <= 0) return null
      const avail = keysHeld + C.gotKeys.size - baseFree - P.length
      if (avail < 1) return null
      const cands = []
      for (const di of lockedTiles) {
        if (P.includes(di)) continue
        const dx0 = di % W
        const dy0 = (di / W) | 0
        let touching = false
        for (const [dx, dy] of DIRS)
          if (C.reached[idxOf(wrapX(dx0 + dx), wrapY(dy0 + dy))]) {
            touching = true
            break
          }
        if (!touching) continue
        const P2 = [...P, di].sort((a, b) => a - b)
        const key = P2.join(',')
        if (seen.has(key)) continue
        seen.add(key)
        if (budget-- <= 0) break
        const C2 = closure(false, P2, true)
        const newKeys = C2.gotKeys.size - C.gotKeys.size
        let gain = 0
        for (let i = 0; i < W * H; i++)
          if (C2.reached[i] && !C.reached[i]) gain++
        if (!C2.reached[goalIdx] && newKeys === 0 && gain <= 1) continue
        cands.push({
          di,
          P2,
          C2,
          score: (C2.reached[goalIdx] ? 1000 : 0) + newKeys * 10 + gain / 50,
        })
      }
      cands.sort((a, b) => b.score - a.score)
      for (const c of cands) {
        const r = dfs(c.P2, c.C2, depth + 1)
        if (r) return [c.di, ...r]
      }
      return null
    }
    const base = closure(false, [], true)
    baseFree = base.gotKeys.size
    const result = dfs([], base, 0)
    if (searchCache.size > 200) searchCache.clear()
    searchCache.set(sig, result)
    return result
  }

  let targetChain = null
  let doorTarget = null
  const L = closure(false)

  if (L.reached[goalIdx]) {
    const c = chainTo(L, goalIdx)
    if (c && usable(c)) targetChain = { chain: c, kind: 'portal' }
  }

  if (!targetChain) {
    const order = keysHeld >= 1 ? searchDoors() : null
    if (order && order.length > 0) {
      const di = order[0]
      let from = null
      for (const [dx, dy] of DIRS) {
        const ni = idxOf(wrapX((di % W) + dx), wrapY(((di / W) | 0) + dy))
        if (!L.reached[ni] || ni === di || (airborne && ni === s0)) continue
        const c = chainTo(L, ni)
        if (!c || !usable(c)) continue
        if (!from || c.length < from.length) from = c
      }
      if (from) {
        targetChain = { chain: from, kind: 'key' }
        doorTarget = { x: di % W, y: (di / W) | 0 }
      }
    }
  }

  if (!targetChain) {
    let bestKey = null
    for (const ki of L.gotKeys) {
      const c = chainTo(L, ki)
      if (!c || !usable(c)) continue
      const score = c.length + c.filter((s) => s.kind === 'hop').length * 3
      if (!bestKey || score < bestKey.score) bestKey = { chain: c, score }
    }
    if (bestKey) targetChain = { chain: bestKey.chain, kind: 'key' }
  }

  if (!targetChain && portalChain && usable(portalChain)) {
    const need = doorsIn(portalChain).length
    if (need <= keysHeld) targetChain = { chain: portalChain, kind: 'portal' }
  }
  if (!targetChain) {
    return null
  }

  const chain = targetChain.chain
  const doorSet = new Set()
  if (targetChain.kind === 'portal')
    for (const d of doorsIn(targetChain.chain)) doorSet.add(`${d.x},${d.y}`)
  else if (doorTarget) doorSet.add(`${doorTarget.x},${doorTarget.y}`)

  const first = chain[0]
  if (!first)
    return {
      kind: targetChain.kind,
      mode: 'foot',
      steps: [],
      rides: [],
      scarce: [],
      doors: doorSet,
      kit,
    }
  const mode = first.kind === 'hop' ? 'fly' : first.mode
  const steps = []
  for (const c of chain) {
    const sameMode = (c.kind === 'hop' ? 'fly' : c.mode) === mode
    if (!sameMode) break
    if (c.kind === 'door') break
    steps.push({ x: c.x, y: c.y })
    if (c.kind === 'hop') break
  }

  const ridesNeeded = new Set()
  for (const c of [...chain, ...(portalChain || [])]) {
    const m = c.kind === 'hop' ? 'fly' : c.mode
    if (m && m !== 'foot' && m !== 'start' && kit[m]) ridesNeeded.add(m)
  }

  const scarce = [...ridesNeeded]
    .filter((m) => kit[m].uses <= 2)
    .map((m) => kit[m].name)

  return {
    kind: targetChain.kind,
    atDoor: first.kind === 'door' ? { x: first.x, y: first.y } : null,
    scarce,
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

let questOn = false
export const setQuestOn = (v) => {
  questOn = !!v
}
export const getQuestOn = () => questOn

let keepRides = []
export const setQuestKeep = (names) => {
  keepRides = names || []
}
export const getQuestKeep = () => keepRides

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
