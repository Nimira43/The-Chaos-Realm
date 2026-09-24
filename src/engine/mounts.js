export const RIDE_AP_COST = 2
export const DISMOUNT_AP_COST = 2
export const FLY_TOGGLE_AP_COST = 2 

export const FLYING_MOVE_COST = 2
export const FLYING_BLOCKED_TERRAIN = ['wall', 'doorLocked', 'doorUnlocked']

export function canRide(entity) {
  return !!entity?.ride_mounts
}

export function isMountCreature(stats) {
  return !!stats?.mount
}

export function canFly(stats) {
  return isMountCreature(stats) && (stats?.action_points_flying ?? 0) > 0
}

export function isMounted(cell) {
  return !!cell?.mount
}

export function isCurrentlyFlying(cell) {
  if (!cell) return false
  return cell.mount ? !!cell.mount.flying : !!cell.flying
}

export function getMoverStats(cell, riderStats) {
  const stats = cell?.mount ? cell.mount.stats : riderStats
  return { ...stats, isFlyingNow: isCurrentlyFlying(cell) }
}

export function getMoverAp(cell, riderAp) {
  return cell?.mount ? cell.mount.ap : riderAp
}

export function withMoverAp(cell, ap) {
  if (cell.mount) return { ...cell, mount: { ...cell.mount, ap } }
  return { ...cell, ap }
}

export function getMoverMaxAp(cell, riderStats) {
  const s = getMoverStats(cell, riderStats)
  return s.isFlyingNow ? s.action_points_flying : s.action_points_ground
}

export function getMaxAp(stats) {
  return stats.action_points_ground
}

export function withFlying(cell, flying) {
  if (cell.mount) return { ...cell, mount: { ...cell.mount, flying } }
  return { ...cell, flying }
}

export function createMountCell(mount, x, y) {
  return {
    type: 'creature',
    owner: mount.owner,
    name: mount.name,
    x,
    y,
    ap: mount.ap,
    current_health: mount.current_health,
    stats: mount.stats,
    inventory: mount.inventory || [],
    flying: mount.flying || false,
    wanderTarget: null
  }
}

export function mountRider(objectLayer, riderPos, mountPos) {
  const copy = objectLayer.map(row => [...row])
  const mountCell = copy[mountPos.y][mountPos.x]
  const riderCell = copy[riderPos.y][riderPos.x]

  copy[mountPos.y][mountPos.x] = null
  copy[riderPos.y][riderPos.x] = {
    ...riderCell,
    mount: {
      name: mountCell.name,
      owner: mountCell.owner,
      ap: mountCell.ap,
      current_health: mountCell.current_health,
      stats: mountCell.stats,
      inventory: mountCell.inventory || [],
      flying: false
    }
  }

  return copy
}

export function dismountRider(objectLayer, riderPos, mountPos) {
  const copy = objectLayer.map(row => [...row])
  const { mount, ...riderOnly } = copy[riderPos.y][riderPos.x]

  copy[riderPos.y][riderPos.x] = riderOnly
  copy[mountPos.y][mountPos.x] = createMountCell(mount, mountPos.x, mountPos.y)

  return copy
}

export function getMountDescription(riderName, cell) {
  if (!cell?.mount) return null
  return `${riderName} riding ${cell.mount.name}${cell.mount.flying ? ' (flying)' : ''}`
}