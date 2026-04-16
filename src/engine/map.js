import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap } from './utils.js'
import { applyBiomeRules } from './biome.js'

export function createEmptyMap() {
  const m = []
  for (let y = 0; y < MAP_HEIGHT; y++) {
    m[y] = []
    for (let x = 0; x < MAP_WIDTH; x++) {
      m[y][x] = 'grass'
    }
  }
  return m
}

export function addBlob(map, terrain, centerX, centerY, radius) {
  // Main blob (with jitter)
  for (let y = centerY - radius; y <= centerY + radius; y++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      const dx = x - centerX
      const dy = y - centerY
      const jitter = Math.random() * 1.5 - 0.75

      if (dx * dx + dy * dy <= (radius + jitter) * (radius + jitter)) {
        const wx = wrap(x, MAP_WIDTH)
        const wy = wrap(y, MAP_HEIGHT)
        map[wy][wx] = terrain
      }
    }
  }

  // Satellite blobs
  const satellites = 1 + Math.floor(Math.random() * 3)

  for (let i = 0; i < satellites; i++) {
    const offsetX = centerX + Math.floor(Math.random() * 6 - 3)
    const offsetY = centerY + Math.floor(Math.random() * 6 - 3)
    const smallRadius = Math.max(1, radius - 1 - Math.floor(Math.random() * 2))

    for (let y = offsetY - smallRadius; y <= offsetY + smallRadius; y++) {
      for (let x = offsetX - smallRadius; x <= offsetX + smallRadius; x++) {
        const dx = x - offsetX
        const dy = y - offsetY
        const jitter = Math.random() * 1.2 - 0.6

        if (dx * dx + dy * dy <= (smallRadius + jitter) * (smallRadius + jitter)) {
          const wx = wrap(x, MAP_WIDTH)
          const wy = wrap(y, MAP_HEIGHT)
          map[wy][wx] = terrain
        }
      }
    }
  }
}

export function generateProceduralMap() {
  let m = createEmptyMap()

  // Rough patches
  for (let i = 0; i < 8; i++) {
    addBlob(m, 'rough',
      Math.floor(Math.random() * MAP_WIDTH),
      Math.floor(Math.random() * MAP_HEIGHT),
      2 + Math.floor(Math.random() * 3)
    )
  }

  // Rock clusters
  for (let i = 0; i < 6; i++) {
    addBlob(m, 'rock',
      Math.floor(Math.random() * MAP_WIDTH),
      Math.floor(Math.random() * MAP_HEIGHT),
      2 + Math.floor(Math.random() * 3)
    )
  }

  // Swamp pools
  for (let i = 0; i < 5; i++) {
    addBlob(m, 'swamp',
      Math.floor(Math.random() * MAP_WIDTH),
      Math.floor(Math.random() * MAP_HEIGHT),
      2 + Math.floor(Math.random() * 3)
    )
  }

  // Lakes
  for (let i = 0; i < 4; i++) {
    addBlob(m, 'water',
      Math.floor(Math.random() * MAP_WIDTH),
      Math.floor(Math.random() * MAP_HEIGHT),
      2 + Math.floor(Math.random() * 4)
    )
  }

  // Forests
  for (let i = 0; i < 7; i++) {
    addBlob(m, 'forest',
      Math.floor(Math.random() * MAP_WIDTH),
      Math.floor(Math.random() * MAP_HEIGHT),
      2 + Math.floor(Math.random() * 4)
    )
  }

  return applyBiomeRules(m)
}
