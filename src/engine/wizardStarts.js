import { MAP_WIDTH, MAP_HEIGHT } from "./terrain.js"
import { wrap, wrappedManhattanDistance } from "./utils.js"

const SPAWN_TERRAIN_EXCLUDED = [
  "mountain",
  "wall",
  "lava",
  "water",
  "doorLocked",
  "doorUnlocked",
]
const START_TERRAIN_EXCLUDED = [
  ...SPAWN_TERRAIN_EXCLUDED,
  "swamp",
  "rock",
  "floor",
  "wasteland",
  "portal",
]
const MIN_START_REGION = 60
const FAR_BAND = 4

const NEIGHBOUR_STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

const isStartTile = (terrain, x, y) =>
  !START_TERRAIN_EXCLUDED.includes(terrain[y][x])

function measureLandmasses(terrain) {
  const size = terrain.map((row) => row.map(() => 0))
  const seen = terrain.map((row) => row.map(() => false))

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (seen[y][x] || !isStartTile(terrain, x, y)) continue

      const region = [{ x, y }]
      seen[y][x] = true

      for (let i = 0; i < region.length; i++) {
        const cur = region[i]
        for (const [dx, dy] of NEIGHBOUR_STEPS) {
          const nx = wrap(cur.x + dx, MAP_WIDTH)
          const ny = wrap(cur.y + dy, MAP_HEIGHT)
          if (seen[ny][nx] || !isStartTile(terrain, nx, ny)) continue
          seen[ny][nx] = true
          region.push({ x: nx, y: ny })
        }
      }

      region.forEach((t) => {
        size[t.y][t.x] = region.length
      })
    }
  }

  return size
}

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)]

export function pickWizardStarts(terrain) {
  const landSize = measureLandmasses(terrain)

  const candidates = []
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (isStartTile(terrain, x, y) && landSize[y][x] >= MIN_START_REGION)
        candidates.push({ x, y })
    }
  }

  if (candidates.length < 2)
    return { player: { x: 16, y: 16 }, enemy: { x: 20, y: 20 } }

  const player = pickRandom(candidates)
  const dist = (t) =>
    wrappedManhattanDistance(
      player.x,
      player.y,
      t.x,
      t.y,
      MAP_WIDTH,
      MAP_HEIGHT,
    )

  const others = candidates.filter((t) => t.x !== player.x || t.y !== player.y)
  const sameLand = others.filter(
    (t) =>
      landSize[t.y][t.x] === landSize[player.y][player.x] &&
      wrappedManhattanDistance(
        player.x,
        player.y,
        t.x,
        t.y,
        MAP_WIDTH,
        MAP_HEIGHT,
      ) > 0,
  )
  const pool = sameLand.length > 0 ? sameLand : others

  const furthest = Math.max(...pool.map(dist))
  const far = pool.filter((t) => dist(t) >= furthest - FAR_BAND)

  return { player, enemy: pickRandom(far) }
}
