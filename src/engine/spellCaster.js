export const SUMMON_COUNT_BY_LEVEL = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8
}

const ADJACENT_OFFSETS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 }
]

export function castCreatureSummonSpell({
  casterPos,
  creatureName,
  spellLevel,
  isTileFree,
  spawnCreature
}) {
  const summonCount = SUMMON_COUNT_BY_LEVEL[spellLevel] || 1

  const adjacentTiles = ADJACENT_OFFSETS.map(offset => ({
    x: casterPos.x + offset.x,
    y: casterPos.y + offset.y
  }))

  const freeTiles = adjacentTiles.filter(tile => isTileFree(tile))

  let spawnTiles

  if (freeTiles.length <= summonCount) {
    spawnTiles = freeTiles
  } else {
    spawnTiles = []
    const pool = [...freeTiles]

    while (spawnTiles.length < summonCount) {
      const index = Math.floor(Math.random() * pool.length)
      spawnTiles.push(pool[index])
      pool.splice(index, 1)
    }
  }
  spawnTiles.forEach(tile => {
    spawnCreature(creatureName, tile)
  })
}

export function castSpell({
  spell,
  casterPos,
  isTileFree,
  spawnCreature
}) {
  if (!spell) {
    console.warn('castSpell called with no spell')
    return
  }

  switch (spell.category) {
    case 'creature':
      castCreatureSummonSpell({
        casterPos,
        creatureName: spell.name,
        spellLevel: spell.currentSpellLevel,
        isTileFree,
        spawnCreature
      })
      break

    default:
      console.warn(`Unhandled spell category: ${spell.category}`)
      break
  }
}

