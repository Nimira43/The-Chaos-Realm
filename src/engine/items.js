export const KEY_WEIGHT = 1
export const APPLE_WEIGHT = 1 
const APPLE_UNPLACEABLE_TERRAIN = ['mountain', 'wall', 'lava', 'water', 'doorLocked', 'doorUnlocked']
const MIN_APPLES = 4
const MAX_APPLES = 8
const APPLE_PLACEMENT_ATTEMPTS = 200

let nextItemId = 1

export function createKeyItem() {
  return { id: nextItemId++, type: 'key', name: 'Key', weight: KEY_WEIGHT }
}

export function createAppleItem() {
  return { id: nextItemId++, type: 'apple', name: 'Apple', weight: APPLE_WEIGHT }
}

export function getInventoryWeight(inventory) {
  return (inventory || []).reduce((sum, item) => sum + item.weight, 0)
}

export function canCarryItem(carryLimit, inventory, item) {
  return getInventoryWeight(inventory) + item.weight <= (carryLimit ?? 0)
}

export function hasKey(inventory) {
  return (inventory || []).some(item => item.type === 'key')
}

export function removeFirstKey(inventory) {
  const index = (inventory || []).findIndex(item => item.type === 'key')
  if (index === -1) return inventory || []
  const copy = [...inventory]
  copy.splice(index, 1)
  return copy
}

export function placeRandomApples(terrainLayer, objectLayer, itemLayer) {
  const height = terrainLayer.length
  const width = terrainLayer[0].length

  const newItemLayer = itemLayer.map(row => [...row])
  const appleCount = MIN_APPLES + Math.floor(Math.random() * (MAX_APPLES - MIN_APPLES + 1))

  let placed = 0
  let attempts = 0

  while (placed < appleCount && attempts < APPLE_PLACEMENT_ATTEMPTS) {
    attempts++

    const x = Math.floor(Math.random() * width)
    const y = Math.floor(Math.random() * height)

    if (APPLE_UNPLACEABLE_TERRAIN.includes(terrainLayer[y][x])) continue
    if (objectLayer[y][x] !== null) continue
    if (newItemLayer[y][x] !== null) continue

    newItemLayer[y][x] = [createAppleItem()]
    placed++
  }

  return newItemLayer
}