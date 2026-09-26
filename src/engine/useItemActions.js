import { PLAYER } from '../data/player.js'
import { wrap } from './utils.js'
import { SPELLBOOK } from '../data/spellbook.js'
import { canCarryItem, hasKey, removeFirstKey } from './items.js'

export const ITEM_ACTION_AP_COST = 2

const DOOR_STATES = ['doorLocked', 'doorUnlocked', 'doorOpen']

function findAdjacentDoor(terrainLayer, x, y) {
  const width = terrainLayer[0].length
  const height = terrainLayer.length

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = wrap(x + dx, width)
      const ny = wrap(y + dy, height)
      const terrain = terrainLayer[ny][nx]
      if (DOOR_STATES.includes(terrain)) {
        return { x: nx, y: ny, state: terrain }
      }
    }
  }

  return null
}

function getSelectedEntity(selected, objectLayer) {
  if (!selected) return null

  if (selected.type === 'player') {
    const cell = objectLayer[PLAYER.y]?.[PLAYER.x]
    return {
      kind: 'player',
      x: PLAYER.x,
      y: PLAYER.y,
      ap: PLAYER.ap,
      useOptions: PLAYER.use_options,
      carryLimit: PLAYER.carry_limit,
      inventory: PLAYER.inventory || [],
      flying: !!cell?.mount?.flying
    }
  }

  if (selected.type === 'creature') {
    const cell = objectLayer[selected.y]?.[selected.x]
    if (!cell || cell.type !== 'creature') return null
    return {
      kind: 'creature',
      x: selected.x,
      y: selected.y,
      ap: cell.ap,
      useOptions: cell.stats.use_options,
      carryLimit: cell.stats.carry_limit,
      inventory: cell.inventory || [],
      flying: !!cell.mount?.flying || !!cell.flying
    }
  }

  return null
}


function canPickThisItem(entity, item) {
  if (item.type === 'apple') return true
  return canCarryItem(entity.carryLimit, entity.inventory, item)
}

export function getActionAvailability(selected, terrainLayer, objectLayer, itemLayer) {
  const none = { canPickUp: false, canUse: false, canOpen: false, canClose: false, doorPos: null }

  const entity = getSelectedEntity(selected, objectLayer)
  if (!entity || !entity.useOptions) return none
  if (entity.ap < ITEM_ACTION_AP_COST) return none

  const itemsHere = itemLayer[entity.y]?.[entity.x]

  const canPickUp = !!itemsHere && itemsHere.length > 0 && itemsHere.some(item => canPickThisItem(entity, item))
  
  const door = findAdjacentDoor(terrainLayer, entity.x, entity.y)
  const doorPos = door ? { x: door.x, y: door.y } : null

  if (entity.flying) {
    return { canPickUp, canUse: false, canOpen: false, canClose: false, doorPos }
  }

  return {
    canPickUp,
    canUse: !!door && door.state === 'doorLocked' && hasKey(entity.inventory),
    canOpen: !!door && door.state === 'doorUnlocked',
    canClose: !!door && door.state === 'doorOpen',
    doorPos
  }
}

export default function useItemActions({
  terrainLayer,
  objectLayer,
  itemLayer,
  selected,
  setObjectLayer,
  setItemLayer,
  setTerrainLayer,
  setAp
}) {

  const spendActorAp = () => {
    if (selected.type === 'player') {
      PLAYER.ap -= ITEM_ACTION_AP_COST
      setAp(PLAYER.ap)
    } else {
      setObjectLayer(prev => {
        const copy = prev.map(row => [...row])
        const cell = copy[selected.y][selected.x]
        copy[selected.y][selected.x] = { ...cell, ap: cell.ap - ITEM_ACTION_AP_COST }
        return copy
      })
    }
  }

  const addToActorInventory = (item) => {
    if (selected.type === 'player') {
      PLAYER.inventory = [...(PLAYER.inventory || []), item]
    } else {
      setObjectLayer(prev => {
        const copy = prev.map(row => [...row])
        const cell = copy[selected.y][selected.x]
        copy[selected.y][selected.x] = { ...cell, inventory: [...(cell.inventory || []), item] }
        return copy
      })
    }
  }

  const removeKeyFromActorInventory = () => {
    if (selected.type === 'player') {
      PLAYER.inventory = removeFirstKey(PLAYER.inventory)
    } else {
      setObjectLayer(prev => {
        const copy = prev.map(row => [...row])
        const cell = copy[selected.y][selected.x]
        copy[selected.y][selected.x] = { ...cell, inventory: removeFirstKey(cell.inventory) }
        return copy
      })
    }
  }

  const setDoorState = (x, y, newState) => {
    setTerrainLayer(prev => {
      const copy = prev.map(row => [...row])
      copy[y][x] = newState
      return copy
    })
  }

  const pickUpItem = () => {
    const entity = getSelectedEntity(selected, objectLayer)
    if (!entity || !entity.useOptions || entity.ap < ITEM_ACTION_AP_COST) return

    const itemsHere = itemLayer[entity.y]?.[entity.x]
    if (!itemsHere || itemsHere.length === 0) return

    const itemIndex = itemsHere.findIndex(item => canPickThisItem(entity, item))
    
    if (itemIndex === -1) return
    const item = itemsHere[itemIndex]

    setItemLayer(prev => {
      const copy = prev.map(row => [...row])
      const remaining = [...copy[entity.y][entity.x]]
      remaining.splice(itemIndex, 1)
      copy[entity.y][entity.x] = remaining.length > 0 ? remaining : null
      return copy
    })

    if (item.type === 'apple') {
      const healingSpell = SPELLBOOK.find(s => s.name === 'Healing Potion')
      if (healingSpell) healingSpell.currentSpellLevel += 1
    } else {
      addToActorInventory(item)
    }

    spendActorAp()
  }

  const useKeyOnDoor = () => {
    const entity = getSelectedEntity(selected, objectLayer)
    
    if (!entity || !entity.useOptions || entity.ap < ITEM_ACTION_AP_COST || entity.flying) return

    const door = findAdjacentDoor(terrainLayer, entity.x, entity.y)
    if (!door || door.state !== 'doorLocked') return
    if (!hasKey(entity.inventory)) return

    setDoorState(door.x, door.y, 'doorUnlocked')
    removeKeyFromActorInventory()
    spendActorAp()
  }

  const openDoor = () => {
    const entity = getSelectedEntity(selected, objectLayer)
    
    if (!entity || !entity.useOptions || entity.ap < ITEM_ACTION_AP_COST || entity.flying) return

    const door = findAdjacentDoor(terrainLayer, entity.x, entity.y)
    if (!door || door.state !== 'doorUnlocked') return

    setDoorState(door.x, door.y, 'doorOpen')
    spendActorAp()
  }

  const closeDoor = () => {
    const entity = getSelectedEntity(selected, objectLayer)
    
    if (!entity || !entity.useOptions || entity.ap < ITEM_ACTION_AP_COST || entity.flying) return

    const door = findAdjacentDoor(terrainLayer, entity.x, entity.y)
    if (!door || door.state !== 'doorOpen') return

    setDoorState(door.x, door.y, 'doorUnlocked')
    spendActorAp()
  }

  return {
    pickUpItem,
    useKeyOnDoor,
    openDoor,
    closeDoor
  }
}