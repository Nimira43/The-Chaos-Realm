import { PLAYER } from '../data/player.js'
import { wrap } from './utils.js'
import { getMovementCost, IMPASSABLE_THRESHOLD } from './terrain.js'
import { isEnvironmentEffectBlocking } from './environmentEffects.js'
import { canRide, isMountCreature, RIDE_AP_COST, DISMOUNT_AP_COST } from './mounts.js'

function getNeighbours(x, y, width, height) {
  const offsets = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
  ]
  return offsets.map(o => ({ x: wrap(x + o.x, width), y: wrap(y + o.y, height) }))
}

function getSelectedRider(selected, objectLayer) {
  if (!selected) return null

  if (selected.type === 'player') {
    const cell = objectLayer[PLAYER.y][PLAYER.x]
    return { x: PLAYER.x, y: PLAYER.y, ap: PLAYER.ap, canRideFlag: canRide(PLAYER), mounted: !!cell?.mount, owner: 'player' }
  }

  if (selected.type === 'creature') {
    const cell = objectLayer[selected.y]?.[selected.x]
    if (!cell || cell.type !== 'creature') return null
    return { x: selected.x, y: selected.y, ap: cell.ap, canRideFlag: canRide(cell.stats), mounted: !!cell.mount, owner: cell.owner }
  }

  return null
}

function findAdjacentMount(objectLayer, terrainLayer, x, y, riderOwner) {
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

export function getMountActionAvailability(selected, terrainLayer, objectLayer) {
  const none = { canRide: false, canDismount: false }
  const rider = getSelectedRider(selected, objectLayer)
  if (!rider || !rider.canRideFlag) return none

  if (rider.mounted) {
    return { canRide: false, canDismount: true }
  }

  const mount = findAdjacentMount(objectLayer, terrainLayer, rider.x, rider.y, rider.owner)
  return { canRide: !!mount && rider.ap >= RIDE_AP_COST, canDismount: false }
}

export default function useMountActions({ terrainLayer, objectLayer, effectLayer, selected, setObjectLayer, setAp }) {

  const rideMount = () => {
    const rider = getSelectedRider(selected, objectLayer)
    if (!rider || !rider.canRideFlag || rider.mounted) return
    if (rider.ap < RIDE_AP_COST) return

    const found = findAdjacentMount(objectLayer, terrainLayer, rider.x, rider.y, rider.owner)
    if (!found) return

    setObjectLayer(prev => {
      const copy = prev.map(row => [...row])
      const mountCell = copy[found.pos.y][found.pos.x]
      copy[found.pos.y][found.pos.x] = null

      const riderCell = copy[rider.y][rider.x]
      copy[rider.y][rider.x] = {
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
    })

    if (selected.type === 'player') {
      PLAYER.ap -= RIDE_AP_COST
      setAp(PLAYER.ap)
    } else {
      setObjectLayer(prev => {
        const copy = prev.map(row => [...row])
        const cell = copy[selected.y][selected.x]
        copy[selected.y][selected.x] = { ...cell, ap: cell.ap - RIDE_AP_COST }
        return copy
      })
    }
  }

  const dismountMount = () => {
    const rider = getSelectedRider(selected, objectLayer)
    if (!rider || !rider.mounted) return

    const riderCell = objectLayer[rider.y][rider.x]
    const mount = riderCell.mount
    if (!mount || mount.ap < DISMOUNT_AP_COST) return

    const freeTile = findFreeAdjacentTile(terrainLayer, objectLayer, effectLayer, rider.x, rider.y, mount.stats)
    if (!freeTile) return // no room to dismount into right now

    setObjectLayer(prev => {
      const copy = prev.map(row => [...row])
      const cell = copy[rider.y][rider.x]
      const { mount: droppedMount, ...riderOnly } = cell
      copy[rider.y][rider.x] = riderOnly

      copy[freeTile.y][freeTile.x] = {
        type: 'creature',
        owner: droppedMount.owner,
        name: droppedMount.name,
        x: freeTile.x,
        y: freeTile.y,
        ap: droppedMount.ap - DISMOUNT_AP_COST,
        current_health: droppedMount.current_health,
        stats: droppedMount.stats,
        inventory: droppedMount.inventory || [],
        wanderTarget: null
      }

      return copy
    })
  }

  return { rideMount, dismountMount }
}