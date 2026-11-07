import { generateProceduralMap } from './map.js'
import { pickWizardStarts } from './wizardStarts.js'
import { createCoinItem, createJewelItem, getJewelCounts } from './items.js'
import { PLAYER } from '../data/player.js'

export const LOOT_AP = 100
export const LOOT_MULTIPLIER = 2

const MIN_COINS = 5
const MAX_COINS = 15
const MIN_JEWELS = 5
const MAX_JEWELS = 15
const UNPLACEABLE_TERRAIN = [
  'mountain',
  'wall',
  'lava',
  'water',
  'doorLocked',
  'doorUnlocked',
]
const PLACEMENT_ATTEMPTS = 400

const randomBetween = (min, max) =>
  min + Math.floor(Math.random() * (max - min + 1))

function scatter(terrain, objects, items, count, makeItem) {
  const height = terrain.length
  const width = terrain[0].length
  let placed = 0
  let attempts = 0

  while (placed < count && attempts < PLACEMENT_ATTEMPTS * Math.max(1, count)) {
    attempts++
    const x = Math.floor(Math.random() * width)
    const y = Math.floor(Math.random() * height)

    if (UNPLACEABLE_TERRAIN.includes(terrain[y][x])) continue
    if (objects[y][x] !== null || items[y][x] !== null) continue

    items[y][x] = [makeItem()]
    placed++
  }
  return placed
}

export function placeLoot(terrain, objects, items) {
  const jewelCounts = getJewelCounts(randomBetween(MIN_JEWELS, MAX_JEWELS))
  const placed = { coins: 0, jewels: 0 }

  for (const gem of Object.keys(jewelCounts)) {
    placed.jewels += scatter(
      terrain,
      objects,
      items,
      jewelCounts[gem] * LOOT_MULTIPLIER,
      () => createJewelItem(gem),
    )
  }
  placed.coins = scatter(
    terrain,
    objects,
    items,
    randomBetween(MIN_COINS, MAX_COINS) * LOOT_MULTIPLIER,
    createCoinItem,
  )

  return placed
}

export function makeLootLoader(set) {
  return function loadLootMap() {
    set.turnTokenRef.current += 1
    set.setIsAnimating(false)

    const terrain = generateProceduralMap()
    const objects = terrain.map((row) => row.map(() => null))
    const effects = terrain.map((row) => row.map(() => null))
    const items = terrain.map((row) => row.map(() => null))

    const start = pickWizardStarts(terrain).player

    PLAYER.x = start.x
    PLAYER.y = start.y
    PLAYER.ap = LOOT_AP
    PLAYER.current_mana = PLAYER.max_mana
    PLAYER.current_health = PLAYER.constitution
    PLAYER.floodTrapped = false
    PLAYER.inventory = []

    objects[start.y][start.x] = {
      type: 'player',
      name: 'Wizard',
      owner: 'player',
    }

    const placed = placeLoot(terrain, objects, items)

    set.setTerrainLayer(terrain)
    set.setObjectLayer(objects)
    set.setEffectLayer(effects)
    set.setItemLayer(items)
    set.setEnemyPosition(null)
    set.setPlayerPosition({ x: start.x, y: start.y })
    set.setCursor({ x: start.x, y: start.y })
    set.setSelected(null)
    set.setAp(LOOT_AP)
    set.setRound(1)
    set.setPortalStart(null)
    set.setPortalPosition(null)
    set.setGameStatus('playing')
    set.setGameOverMessage('')
    set.setScore(0)

    return placed
  }
}
