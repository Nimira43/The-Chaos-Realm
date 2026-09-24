export function canRide(entity) {
  return !!entity?.ride_mounts
}

export function isMountCreature(stats) {
  return !!stats?.mount
}

export function isMountFlying(mountStats) {
  return (mountStats?.action_points_flying ?? 0) > 0
}

export const RIDE_AP_COST = 2
export const DISMOUNT_AP_COST = 2