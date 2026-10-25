import { getAreaTiles, wrappedChebyshevDistance } from './utils.js'
import { getCellCombatValue } from './combat.js'

export const THREAT_RADIUS = 2
export const TERRAIN_SCAN_RADIUS = 5

export function isPlayerSide(cell) {
  return (
    !!cell &&
    (cell.type === 'player' ||
      (cell.type === 'creature' && cell.owner === 'player'))
  )
}

export function isEnemySide(cell) {
  return (
    !!cell &&
    (cell.type === 'enemyWizard' ||
      (cell.type === 'creature' && cell.owner === 'enemy'))
  )
}

function dims(layer) {
  return { w: layer[0].length, h: layer.length }
}

export function scanThreat(objectLayer, cx, cy, radius = THREAT_RADIUS) {
  const { w, h } = dims(objectLayer)
  const units = []
  let total = 0

  for (const t of getAreaTiles(cx, cy, radius, w, h)) {
    if (t.x === cx && t.y === cy) continue
    const cell = objectLayer[t.y][t.x]
    if (!isPlayerSide(cell)) continue

    const combat = getCellCombatValue(cell)
    units.push({ x: t.x, y: t.y, combat })
    total += combat
  }

  return { total, units }
}

export function countTerrainAround(
  terrainLayer,
  cx,
  cy,
  radius = TERRAIN_SCAN_RADIUS,
) {
  const { w, h } = dims(terrainLayer)
  const counts = {}

  for (const t of getAreaTiles(cx, cy, radius, w, h)) {
    const terrain = terrainLayer[t.y][t.x]
    counts[terrain] = (counts[terrain] || 0) + 1
  }

  return counts
}

export function listPlayerUnitsInRange(objectLayer, cx, cy, range) {
  const { w, h } = dims(objectLayer)
  const found = []

  for (const t of getAreaTiles(cx, cy, range, w, h)) {
    const cell = objectLayer[t.y][t.x]
    if (!isPlayerSide(cell)) continue
    const distance = wrappedChebyshevDistance(cx, cy, t.x, t.y, w, h)
    if (distance > range) continue
    found.push({ x: t.x, y: t.y, combat: getCellCombatValue(cell), distance })
  }

  return found.sort((a, b) => b.combat - a.combat || a.distance - b.distance)
}

export function evaluateBlast(objectLayer, ax, ay, radius) {
  const { w, h } = dims(objectLayer)
  let hitPlayerUnits = 0
  let playerValue = 0
  let ownValue = 0
  let ownWizardHit = false

  for (const t of getAreaTiles(ax, ay, radius, w, h)) {
    const cell = objectLayer[t.y][t.x]
    if (!cell) continue

    if (isPlayerSide(cell)) {
      hitPlayerUnits++
      playerValue += getCellCombatValue(cell)
    } else if (isEnemySide(cell)) {
      if (cell.type === 'enemyWizard') ownWizardHit = true
      ownValue += getCellCombatValue(cell)
    }
  }

  return {
    hitPlayerUnits,
    playerValue,
    ownValue,
    ownWizardHit,
    net: playerValue - ownValue,
  }
}

export function findBestBlast(
  objectLayer,
  caster,
  range,
  blastRadius,
  { mode = 'window', minClearance = 0 } = {},
) {
  const { w, h } = dims(objectLayer)

  let candidates
  if (mode === 'units') {
    candidates = listPlayerUnitsInRange(
      objectLayer,
      caster.x,
      caster.y,
      range,
    ).map((u) => ({ x: u.x, y: u.y }))
  } else {
    candidates = getAreaTiles(caster.x, caster.y, range, w, h)
  }

  let best = null

  for (const t of candidates) {
    const distance = wrappedChebyshevDistance(
      caster.x,
      caster.y,
      t.x,
      t.y,
      w,
      h,
    )
    if (distance > range) continue
    if (distance - blastRadius < minClearance) continue

    const ev = evaluateBlast(objectLayer, t.x, t.y, blastRadius)
    if (ev.hitPlayerUnits === 0 || ev.ownWizardHit) continue

    const better =
      !best ||
      ev.net > best.net ||
      (ev.net === best.net && ev.hitPlayerUnits > best.hitPlayerUnits)

    if (better) best = { x: t.x, y: t.y, ...ev }
  }

  return best
}
