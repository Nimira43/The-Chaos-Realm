export const KEY_WEIGHT = 1

let nextItemId = 1

export function createKeyItem() {
  return { id: nextItemId++, type: 'key', name: 'Key', weight: KEY_WEIGHT }
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