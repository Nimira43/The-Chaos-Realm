export const KEY_WEIGHT = 1
export const APPLE_WEIGHT = 1
export const TREASURE_WEIGHT = 1
export const COIN_POINTS = 10

export const GEMS = {
  emerald: { name: 'Emerald', points: 60 },
  ruby: { name: 'Ruby', points: 100 },
  sapphire: { name: 'Sapphire', points: 40 },
  diamond: { name: 'Diamond', points: 80 }
}

const MIN_APPLES = 4
const MAX_APPLES = 8
const MIN_COINS = 5
const MAX_COINS = 15
const MIN_JEWELS = 5
const MAX_JEWELS = 15

const JEWEL_TABLE = {
  ruby: [0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2],
  diamond: [1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3],
  emerald: [2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4],
  sapphire: [2, 3, 3, 3, 4, 4, 5, 5, 5, 5, 6]
}

const PICKUP_UNPLACEABLE_TERRAIN = ['mountain', 'wall', 'lava', 'water', 'doorLocked', 'doorUnlocked']
const PLACEMENT_ATTEMPTS = 200
const CONSUMED_ON_PICKUP = ['apple', 'coin', 'jewel']

let nextItemId = 1

export function createKeyItem() {
  return { id: nextItemId++, type: 'key', name: 'Key', weight: KEY_WEIGHT }
}

export function createAppleItem() {
  return { id: nextItemId++, type: 'apple', name: 'Apple', weight: APPLE_WEIGHT }
}

export function createCoinItem() {
  return { id: nextItemId++, type: 'coin', name: 'Gold Coin', weight: TREASURE_WEIGHT, points: COIN_POINTS }
}

export function createJewelItem(gem) {
  const info = GEMS[gem]
  return { id: nextItemId++, type: 'jewel', gem, name: info.name, weight: TREASURE_WEIGHT, points: info.points }
}

export function isConsumedOnPickup(item) {
  return CONSUMED_ON_PICKUP.includes(item.type)
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

function randomBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function getJewelCounts(total) {
  const index = Math.min(MAX_JEWELS, Math.max(MIN_JEWELS, total)) - MIN_JEWELS
  const counts = {}
  for (const gem of Object.keys(JEWEL_TABLE)) counts[gem] = JEWEL_TABLE[gem][index]
  return counts
}

function scatterItems(terrainLayer, objectLayer, itemLayer, count, makeItem) {
  const height = terrainLayer.length
  const width = terrainLayer[0].length
  const newItemLayer = itemLayer.map(row => [...row])

  let placed = 0
  let attempts = 0

  while (placed < count && attempts < PLACEMENT_ATTEMPTS) {
    attempts++

    const x = Math.floor(Math.random() * width)
    const y = Math.floor(Math.random() * height)

    if (PICKUP_UNPLACEABLE_TERRAIN.includes(terrainLayer[y][x])) continue
    if (objectLayer[y][x] !== null) continue
    if (newItemLayer[y][x] !== null) continue

    newItemLayer[y][x] = [makeItem()]
    placed++
  }

  return newItemLayer
}

export function placeRandomPickups(terrainLayer, objectLayer, itemLayer) {
  let layer = itemLayer

  layer = scatterItems(terrainLayer, objectLayer, layer, randomBetween(MIN_APPLES, MAX_APPLES), createAppleItem)

  const jewelCounts = getJewelCounts(randomBetween(MIN_JEWELS, MAX_JEWELS))
  for (const gem of Object.keys(jewelCounts)) {
    layer = scatterItems(terrainLayer, objectLayer, layer, jewelCounts[gem], () => createJewelItem(gem))
  }

  layer = scatterItems(terrainLayer, objectLayer, layer, randomBetween(MIN_COINS, MAX_COINS), createCoinItem)

  return layer
}

export function findPickupCandidate(itemLayer, x, y, carryLimit, inventory) {
  const itemsHere = itemLayer[y]?.[x]
  if (!itemsHere || itemsHere.length === 0) return null

  const index = itemsHere.findIndex(item =>
    isConsumedOnPickup(item) || canCarryItem(carryLimit, inventory, item)
  )
  if (index === -1) return null

  return { item: itemsHere[index], index }
}