import { PLAYER } from '../data/player.js'
import { wrap } from './utils.js'
import { SPELLBOOK } from '../data/spellbook.js'
import { canCarryItem, hasKey, removeFirstKey, isConsumedOnPickup } from './items.js'
import { resolveAttack, resolveThrownWeaponAttack } from './combat.js'
import { wrappedChebyshevDistance } from './utils.js'
import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'

const THROW_RANGE = 2

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
  if (isConsumedOnPickup(item)) return true
  return canCarryItem(entity.carryLimit, entity.inventory, item)
}

function getSelectedEntityInfo(selected, objectLayer) {
  if (!selected) return null

  if (selected.type === 'player') {
    return { x: PLAYER.x, y: PLAYER.y, ap: PLAYER.ap, useOptions: PLAYER.use_options, inventory: PLAYER.inventory || [], isPlayer: true }
  }

  if (selected.type === 'creature') {
    const cell = objectLayer[selected.y]?.[selected.x]
    if (!cell || cell.type !== 'creature') return null
    return { x: selected.x, y: selected.y, ap: cell.ap, useOptions: cell.stats.use_options, inventory: cell.inventory || [], isPlayer: false }
  }

  return null
}

function getEquippedBow(inventory) {
  return (inventory || []).find(item => item.type === 'weapon' && item.ranged > 0) || null
}

export function getBowInfo(objectLayer) {
  if (objectLayer[PLAYER.y][PLAYER.x]?.mount?.flying) return { hasBow: false, range: 0, origin: null }
  const bow = getEquippedBow(PLAYER.inventory)
  return bow ? { hasBow: true, range: bow.ranged, origin: { x: PLAYER.x, y: PLAYER.y } } : { hasBow: false, range: 0, origin: null }
}

export function getThrowInfo(objectLayer) {
  if (objectLayer[PLAYER.y][PLAYER.x]?.mount?.flying) return { hasThrowable: false, range: 0, origin: null }
  const hasThrowable = (PLAYER.inventory || []).some(item => item.type === 'weapon' && item.thrown > 0)
  return hasThrowable
    ? { hasThrowable: true, range: THROW_RANGE, origin: { x: PLAYER.x, y: PLAYER.y } }
    : { hasThrowable: false, range: 0, origin: null }
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
  setAp,
  addScore,
  setEnemyPosition,
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
    } else if (item.type === 'coin' || item.type === 'jewel') {
      addScore(item.points)
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

  const dropWeapon = (itemId) => {
    const entity = getSelectedEntityInfo(selected, objectLayer)
    if (!entity || !entity.useOptions) return
    const item = entity.inventory.find(i => i.id === itemId)
    if (!item) return

    if (selected.type === 'player') {
      PLAYER.inventory = PLAYER.inventory.filter(i => i.id !== itemId)
    } else {
      setObjectLayer(prev => {
        const copy = prev.map(row => [...row])
        const cell = copy[selected.y][selected.x]
        copy[selected.y][selected.x] = { ...cell, inventory: cell.inventory.filter(i => i.id !== itemId) }
        return copy
      })
    }

    setItemLayer(prev => {
      const copy = prev.map(row => [...row])
      const existing = copy[entity.y][entity.x] || []
      copy[entity.y][entity.x] = [...existing, item]
      return copy
    })

    spendActorAp()
  }

  const shootBow = (aimPos) => {
    if (objectLayer[PLAYER.y][PLAYER.x]?.mount?.flying) return
    if (PLAYER.ap < ITEM_ACTION_AP_COST) return

    const bow = getEquippedBow(PLAYER.inventory)
    if (!bow) return

    const distance = wrappedChebyshevDistance(PLAYER.x, PLAYER.y, aimPos.x, aimPos.y, MAP_WIDTH, MAP_HEIGHT)
    if (distance > bow.ranged) return

    const target = objectLayer[aimPos.y]?.[aimPos.x]
    if (!target || target.owner !== 'enemy') return

    const result = resolveAttack({ objectLayer, attackerPos: { x: PLAYER.x, y: PLAYER.y }, defenderPos: aimPos })
    if (result.blocked) return

    setObjectLayer(result.objectLayer)
    PLAYER.ap -= ITEM_ACTION_AP_COST
    setAp(PLAYER.ap)

    if (result.killedOwner === 'enemy' && result.killPoints > 0) addScore(result.killPoints)
    if (result.defeated && result.defenderType === 'enemyWizard') setEnemyPosition(null)
  }
  
  const throwWeapon = (itemId, aimPos) => {
    if (objectLayer[PLAYER.y][PLAYER.x]?.mount?.flying) return
    if (PLAYER.ap < ITEM_ACTION_AP_COST) return

    const item = (PLAYER.inventory || []).find(i => i.id === itemId)
    if (!item || item.type !== 'weapon' || !(item.thrown > 0)) return

    const distance = wrappedChebyshevDistance(PLAYER.x, PLAYER.y, aimPos.x, aimPos.y, MAP_WIDTH, MAP_HEIGHT)
    if (distance > THROW_RANGE) return

    const target = objectLayer[aimPos.y]?.[aimPos.x]
    if (!target || target.owner !== 'enemy') return

    const result = resolveThrownWeaponAttack({
      objectLayer,
      defenderPos: aimPos,
      throwerCombat: PLAYER.combat,
      thrownCombat: item.thrown,
      bypassUndead: item.attackUndead
    })
    if (result.blocked) return

    PLAYER.inventory = PLAYER.inventory.filter(i => i.id !== itemId)

    setItemLayer(prev => {
      const copy = prev.map(row => [...row])
      const existing = copy[aimPos.y][aimPos.x] || []
      copy[aimPos.y][aimPos.x] = [...existing, item]
      return copy
    })

    setObjectLayer(result.objectLayer)
    PLAYER.ap -= ITEM_ACTION_AP_COST
    setAp(PLAYER.ap)

    if (result.killedOwner === 'enemy' && result.killPoints > 0) addScore(result.killPoints)
    if (result.defeated && result.defenderType === 'enemyWizard') setEnemyPosition(null)
  }

  return {
    pickUpItem,
    useKeyOnDoor,
    openDoor,
    closeDoor,
    dropWeapon,
    shootBow,
    throwWeapon
  }
}
