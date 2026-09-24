export const RIDE_AP_COST = 2
export const DISMOUNT_AP_COST = 2

// Flying mounts pay a flat cost per tile, whatever the terrain beneath them.
// Walls and closed doors still block them, so keys and doors keep their purpose.
export const FLYING_MOVE_COST = 2
export const FLYING_BLOCKED_TERRAIN = ['wall', 'doorLocked', 'doorUnlocked']

export function canRide(entity) {
  return !!entity?.ride_mounts
}

export function isMountCreature(stats) {
  return !!stats?.mount
}

export function isFlyingMount(stats) {
  return isMountCreature(stats) && (stats?.action_points_flying ?? 0) > 0
}

export function getMaxAp(stats) {
  return isFlyingMount(stats) ? stats.action_points_flying : stats.action_points_ground
}

export function isMounted(cell) {
  return !!cell?.mount
}

// Whilst mounted, the mount does the moving and the fighting, so its stats and AP are used.
export function getMoverStats(cell, riderStats) {
  return cell?.mount ? cell.mount.stats : riderStats
}

export function getMoverAp(cell, riderAp) {
  return cell?.mount ? cell.mount.ap : riderAp
}

export function withMoverAp(cell, ap) {
  if (cell.mount) return { ...cell, mount: { ...cell.mount, ap } }
  return { ...cell, ap }
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
      inventory: mountCell.inventory || []
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
  return cell?.mount ? `${riderName} riding ${cell.mount.name}` : null
}
