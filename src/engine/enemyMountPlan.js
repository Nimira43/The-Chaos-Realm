import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { getAdjacentTiles } from './pathfinding.js'
import { canLandOn } from './useMountActions.js'
import { canRide, canFly, isMounted, isMountCreature } from './mounts.js'
import { getMoverStats } from './mounts.js'
import { findWalkInLandings, findRouteDoors } from './enemyPortalRoute.js'

export function countKeys(inventory) {
  return (inventory || []).filter((i) => i.type === 'key').length
}

export function groundStatsFor(cell) {
  return { ...getMoverStats(cell, ENEMY_WIZARD), isFlyingNow: false }
}

export function hasAirRoute(
  terrainLayer,
  objectLayer,
  itemLayer,
  mountStats,
  portal,
) {
  const beside = getAdjacentTiles(portal.x, portal.y).some(
    (t) =>
      !objectLayer[t.y][t.x] &&
      canLandOn(terrainLayer[t.y][t.x], mountStats, itemLayer?.[t.y]?.[t.x]),
  )
  if (beside) return true
  return (
    findWalkInLandings(
      terrainLayer,
      objectLayer,
      itemLayer,
      { ...mountStats, isFlyingNow: false },
      portal,
      countKeys(ENEMY_WIZARD.inventory),
    ).length > 0
  )
}

export function hasGroundRoute(terrainLayer, stats, from, portal) {
  return (
    findRouteDoors(
      terrainLayer,
      { ...stats, isFlyingNow: false },
      from,
      portal,
    ) !== null
  )
}

export function mountFits(ctx, stats) {
  const { terrainLayer, objectLayer, itemLayer, portal } = ctx
  const from = { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y }
  if (
    canFly(stats) &&
    hasAirRoute(terrainLayer, objectLayer, itemLayer, stats, portal)
  )
    return true
  return hasGroundRoute(terrainLayer, stats, from, portal)
}

export function currentSetupFits(ctx) {
  const cell = ctx.objectLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
  const stats = isMounted(cell) ? cell.mount.stats : ENEMY_WIZARD
  const from = { x: ENEMY_WIZARD.x, y: ENEMY_WIZARD.y }
  if (hasGroundRoute(ctx.terrainLayer, stats, from, ctx.portal)) return true
  return (
    isMounted(cell) &&
    canFly(cell.mount.stats) &&
    hasAirRoute(
      ctx.terrainLayer,
      ctx.objectLayer,
      ctx.itemLayer,
      cell.mount.stats,
      ctx.portal,
    )
  )
}

export function findFittingAdjacentMount(ctx) {
  const found = []
  for (const tile of getAdjacentTiles(ENEMY_WIZARD.x, ENEMY_WIZARD.y)) {
    const cell = ctx.objectLayer[tile.y][tile.x]
    if (
      cell?.type === 'creature' &&
      cell.owner === 'enemy' &&
      isMountCreature(cell.stats) &&
      !cell.mount &&
      mountFits(ctx, cell.stats)
    )
      found.push({ pos: tile, cell })
  }
  return (
    found.sort((a, b) => b.cell.stats.combat - a.cell.stats.combat)[0] || null
  )
}

export function needsDifferentMount(ctx) {
  if (!ctx.portal || !canRide(ENEMY_WIZARD)) return false
  return !currentSetupFits(ctx)
}
