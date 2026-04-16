import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrap } from './utils.js'

export function applyBiomeRules(map) {
  const newMap = JSON.parse(JSON.stringify(map))

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {

      const tile = map[y][x]

      let waterN = 0
      let forestN = 0
      let rockN = 0

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = wrap(x + dx, MAP_WIDTH)
          const ny = wrap(y + dy, MAP_HEIGHT)
          const nTile = map[ny][nx]

          if (nTile === 'water') waterN++
          if (nTile === 'forest') forestN++
          if (nTile === 'rock') rockN++
        }
      }

      if (tile === 'grass' && waterN >= 3) {
        newMap[y][x] = 'swamp'
      }

      if (tile === 'grass' && (forestN >= 3 || waterN >= 2)) {
        newMap[y][x] = 'forest'
      }

      if (tile === 'rock' && waterN >= 2) {
        newMap[y][x] = 'rough'
      }

      if (tile === 'rough' && rockN >= 4) {
        newMap[y][x] = 'rock'
      }

      if (tile !== 'grass' && waterN === 0 && forestN === 0 && rockN === 0) {
        if (Math.random() < 0.05) newMap[y][x] = 'grass'
      }
    }
  }

  return newMap
}
