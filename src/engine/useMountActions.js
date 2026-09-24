import { PLAYER } from '../data/player.js'
import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { wrap } from './utils.js'
import { getMovementCost, IMPASSABLE_THRESHOLD } from './terrain.js'
import { isEnvironmentEffectBlocking } from './environmentEffects.js'
import {
  canRide,
  isMountCreature,
  canFly,
  mountRider,
  dismountRider,
  withMoverAp,
  withFlying,
  RIDE_AP_COST,
  DISMOUNT_AP_COST,
  FLY_TOGGLE_AP_COST
} from './mounts.js'

function getNeighbours(x, y, width, height) {
  const offsets = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
  ]
  return offsets.map(o => ({ x: wrap(x + o.x, width), y: wrap(y + o.y, height) }))
}

export function getRiderStats(cell) {
  if (!cell) return null
  if (cell.type === 'player') return PLAYER
  if (cell.type === 'enemyWizard') return cell.ref || ENEMY_WIZARD
  if (cell.type === 'creature') return cell.stats
  return null
}

function getSelectedRider(selected, objectLayer) {
  if (!selected) return null

  if (selected.type === 'player') {
    const cell = objectLayer[PLAYER.y][PLAYER.x]
    return { x: PLAYER.x, y: PLAYER.y, ap: PLAYER.ap, stats: PLAYER, cell, owner: 'player' }
  }

  if (selected.type === 'creature') {
    const cell = objectLayer[selected.y]?.[selected.x]
    if (!cell || cell.type !== 'creature') return null
    return { x: selected.x, y: selected.y, ap: cell.ap, stats: cell.stats, cell, owner: cell.owner }
  }

  return null
}

export function findAdjacentMount(objectLayer, terrainLayer, x, y, riderOwner) {
  const height = terrainLayer.length
  const width = terrainLayer[0].length

  for (const n of getNeighbours(x, y, width, height)) {
    const cell = objectLayer[n.y][n.x]
    if (cell && cell.type === 'creature' && cell.owner === riderOwner && isMountCreature(cell.stats) && !cell.mount) {
      return { pos: n, cell }
    }
  }
  return null
}

function findFreeAdjacentTile(terrainLayer, objectLayer, effectLayer, x, y, mountStats) {
  const height = terrainLayer.length
  const width = terrainLayer[0].length

  for (const n of getNeighbours(x, y, width, height)) {
    if (objectLayer[n.y][n.x] !== null) continue
    if (isEnvironmentEffectBlocking(effectLayer, n.x, n.y, mountStats)) continue
    if (getMovementCost(terrainLayer[n.y][n.x], mountStats) >= IMPASSABLE_THRESHOLD) continue
    return n
  }
  return null
}

export function findDismountTile(terrainLayer, objectLayer, effectLayer, x, y, riderStats) {
  const cell = objectLayer[y][x]
  if (!cell?.mount) return null

  const terrainHere = terrainLayer[y][x]
  if (getMovementCost(terrainHere, riderStats) >= IMPASSABLE_THRESHOLD) return null
  if (terrainHere === 'lava' && !riderStats?.lava_type) return null

  return findFreeAdjacentTile(terrainLayer, objectLayer, effectLayer, x, y, cell.mount.stats)
}

export function getMountActionAvailability(selected, terrainLayer, objectLayer, effectLayer) {
  const none = { canRide: false, canDismount: false, canFly: false, canLand: false }
  const rider = getSelectedRider(selected, objectLayer)
  if (!rider) return none

  let canRideFlag = false
  let canDismountFlag = false

  if (canRide(rider.stats)) {
    if (rider.cell?.mount) {
      canDismountFlag =
        rider.cell.mount.ap >= DISMOUNT_AP_COST &&
        !!findDismountTile(terrainLayer, objectLayer, effectLayer, rider.x, rider.y, rider.stats)
    } else {
      const mount = findAdjacentMount(objectLayer, terrainLayer, rider.x, rider.y, rider.owner)
      canRideFlag = !!mount && rider.ap >= RIDE_AP_COST
    }
  }

  let flyer = null

  if (rider.cell?.mount) {
    flyer = { stats: rider.cell.mount.stats, ap: rider.cell.mount.ap, flying: !!rider.cell.mount.flying }
  } else if (rider.cell?.type === 'creature' && isMountCreature(rider.cell.stats)) {
    flyer = { stats: rider.cell.stats, ap: rider.cell.ap, flying: !!rider.cell.flying }
  }

  let canFlyFlag = false
  let canLandFlag = false

  if (flyer && canFly(flyer.stats)) {
    if (flyer.flying) canLandFlag = flyer.ap >= FLY_TOGGLE_AP_COST
    else canFlyFlag = flyer.ap >= FLY_TOGGLE_AP_COST
  }

  return {
    canRide: canRideFlag,
    canDismount: canDismountFlag,
    canFly: canFlyFlag,
    canLand: canLandFlag
  }
}

export default function useMountActions({ terrainLayer, objectLayer, effectLayer, selected, setObjectLayer, setAp }) {

  const spendRiderAp = (cost) => {
    if (selected.type === 'player') {
      PLAYER.ap -= cost
      setAp(PLAYER.ap)
    } else {
      setObjectLayer(prev => {
        const copy = prev.map(row => [...row])
        const cell = copy[selected.y][selected.x]
        copy[selected.y][selected.x] = { ...cell, ap: cell.ap - cost }
        return copy
      })
    }
  }

  const rideMount = () => {
    const rider = getSelectedRider(selected, objectLayer)
    if (!rider || !canRide(rider.stats) || rider.cell?.mount) return
    if (rider.ap < RIDE_AP_COST) return

    const found = findAdjacentMount(objectLayer, terrainLayer, rider.x, rider.y, rider.owner)
    if (!found) return

    setObjectLayer(prev => mountRider(prev, { x: rider.x, y: rider.y }, found.pos))
    spendRiderAp(RIDE_AP_COST)
  }

  const dismountMount = () => {
    const rider = getSelectedRider(selected, objectLayer)
    if (!rider || !rider.cell?.mount) return
    // FIX: check and spend the MOUNT's AP, not the rider's own.
    if (rider.cell.mount.ap < DISMOUNT_AP_COST) return

    const freeTile = findDismountTile(terrainLayer, objectLayer, effectLayer, rider.x, rider.y, rider.stats)
    if (!freeTile) return

    setObjectLayer(prev => {
      const copy = dismountRider(prev, { x: rider.x, y: rider.y }, freeTile)
      copy[freeTile.y][freeTile.x] = { ...copy[freeTile.y][freeTile.x], ap: copy[freeTile.y][freeTile.x].ap - DISMOUNT_AP_COST }
      return copy
    })
  }

  const takeFlight = () => {
    const avail = getMountActionAvailability(selected, terrainLayer, objectLayer, effectLayer)
    if (!avail.canFly) return

    setObjectLayer(prev => {
      const rider = getSelectedRider(selected, prev)
      if (!rider) return prev
      const copy = prev.map(row => [...row])
      const flown = withFlying(copy[rider.y][rider.x], true)
      copy[rider.y][rider.x] = flown.mount
        ? withMoverAp(flown, flown.mount.ap - FLY_TOGGLE_AP_COST)
        : { ...flown, ap: flown.ap - FLY_TOGGLE_AP_COST }
      return copy
    })
  }

  const land = () => {
    const avail = getMountActionAvailability(selected, terrainLayer, objectLayer, effectLayer)
    if (!avail.canLand) return

    setObjectLayer(prev => {
      const rider = getSelectedRider(selected, prev)
      if (!rider) return prev
      const copy = prev.map(row => [...row])
      const landed = withFlying(copy[rider.y][rider.x], false)
      copy[rider.y][rider.x] = landed.mount
        ? withMoverAp(landed, landed.mount.ap - FLY_TOGGLE_AP_COST)
        : { ...landed, ap: landed.ap - FLY_TOGGLE_AP_COST }
      return copy
    })
  }

  return {
    rideMount,
    dismountMount,
    takeFlight,
    land
  }
}