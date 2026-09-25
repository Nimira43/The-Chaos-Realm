import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrappedChebyshevDistance, getAreaTiles } from './utils.js'

export const SUMMON_COUNT_BY_LEVEL = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8
}

export const RANGED_SPELL_BASE_RANGE = 8
export const HEALING_RANGE = 1

const ADJACENT_OFFSETS = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
]

export function castCreatureSummonSpell({ casterPos, creatureName, spellLevel, isTileFree, spawnCreature }) {
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

function castEnvironmentTileSpell({ casterPos, spellLevel, isTileValid, applyToTile }) {
  const tileCount = SUMMON_COUNT_BY_LEVEL[spellLevel] || 1

  const adjacentTiles = ADJACENT_OFFSETS.map(offset => ({
    x: casterPos.x + offset.x,
    y: casterPos.y + offset.y
  }))

  const validTiles = adjacentTiles.filter(tile => isTileValid(tile))

  let tilesToAffect

  if (validTiles.length <= tileCount) {
    tilesToAffect = validTiles
  } else {
    tilesToAffect = []
    const pool = [...validTiles]

    while (tilesToAffect.length < tileCount) {
      const index = Math.floor(Math.random() * pool.length)
      tilesToAffect.push(pool[index])
      pool.splice(index, 1)
    }
  }

  tilesToAffect.forEach(tile => {
    applyToTile(tile)
  })
}

export function castMagicFireSpell({ casterPos, spellLevel, isTileIgnitable, igniteTile }) {
  castEnvironmentTileSpell({ casterPos, spellLevel, isTileValid: isTileIgnitable, applyToTile: igniteTile })
}

export function castGooeyBlobSpell({ casterPos, spellLevel, isTileSpreadableForBlob, spreadBlobTile }) {
  castEnvironmentTileSpell({ casterPos, spellLevel, isTileValid: isTileSpreadableForBlob, applyToTile: spreadBlobTile })
}

export function castTangleVineSpell({ casterPos, aimPos, spellLevel, isTileValidForVine, applyVineToTile }) {
  if (!aimPos) return

  const maxRange = RANGED_SPELL_BASE_RANGE + spellLevel
  const distance = wrappedChebyshevDistance(casterPos.x, casterPos.y, aimPos.x, aimPos.y, MAP_WIDTH, MAP_HEIGHT)

  if (distance > maxRange) {
    console.warn('Tangle Vine cast out of range')
    return
  }

  const areaTiles = getAreaTiles(aimPos.x, aimPos.y, spellLevel, MAP_WIDTH, MAP_HEIGHT)

  areaTiles.forEach(tile => {
    if (isTileValidForVine(tile)) applyVineToTile(tile)
  })
}

export function castFloodSpell({ casterPos, aimPos, spellLevel, isTileValidForFlood, applyFloodToTile }) {
  if (!aimPos) return

  const maxRange = RANGED_SPELL_BASE_RANGE + spellLevel
  const distance = wrappedChebyshevDistance(casterPos.x, casterPos.y, aimPos.x, aimPos.y, MAP_WIDTH, MAP_HEIGHT)

  if (distance > maxRange) {
    console.warn('Flood cast out of range')
    return
  }

  const areaTiles = getAreaTiles(aimPos.x, aimPos.y, spellLevel, MAP_WIDTH, MAP_HEIGHT)

  areaTiles.forEach(tile => {
    if (isTileValidForFlood(tile)) applyFloodToTile(tile)
  })
}

export function castHealingSpell({ casterPos, aimPos, isTileValidForHeal, healTile }) {
  if (!aimPos) return

  const distance = wrappedChebyshevDistance(casterPos.x, casterPos.y, aimPos.x, aimPos.y, MAP_WIDTH, MAP_HEIGHT)

  if (distance > HEALING_RANGE) {
    console.warn('Healing Potion cast out of range')
    return
  }

  if (!isTileValidForHeal(aimPos)) {
    console.warn('Healing Potion — no valid target on that tile')
    return
  }

  healTile(aimPos)
}

export function castMagicBoltSpell({ aimPos, spellLevel, zapTile }) {
  if (!aimPos) return
  zapTile(aimPos, spellLevel)
}

export function castMagicLightningSpell({ aimPos, spellLevel, zapTile }) {
  if (!aimPos) return
  const areaTiles = getAreaTiles(aimPos.x, aimPos.y, 1, MAP_WIDTH, MAP_HEIGHT)
  areaTiles.forEach(tile => zapTile(tile, spellLevel))
}

function castEnvironmentSpell({
  spell,
  casterPos,
  aimPos,
  isTileIgnitable,
  igniteTile,
  isTileSpreadableForBlob,
  spreadBlobTile,
  isTileValidForVine,
  applyVineToTile,
  isTileValidForFlood,
  applyFloodToTile
}) {
  switch (spell.name) {
    case 'Magic Fire':
      castMagicFireSpell({ casterPos, spellLevel: spell.currentSpellLevel, isTileIgnitable, igniteTile })
      break

    case 'Gooey Blob':
      castGooeyBlobSpell({ casterPos, spellLevel: spell.currentSpellLevel, isTileSpreadableForBlob, spreadBlobTile })
      break

    case 'Tangle Vine':
      castTangleVineSpell({ casterPos, aimPos, spellLevel: spell.currentSpellLevel, isTileValidForVine, applyVineToTile })
      break

    case 'Flood':
      castFloodSpell({ casterPos, aimPos, spellLevel: spell.currentSpellLevel, isTileValidForFlood, applyFloodToTile })
      break

    default:
      console.warn(`Unhandled environment spell: ${spell.name}`)
      break
  }
}

function castPotionSpell({ spell, casterPos, aimPos, isTileValidForHeal, healTile }) {
  switch (spell.name) {
    case 'Healing Potion':
      castHealingSpell({ casterPos, aimPos, isTileValidForHeal, healTile })
      break

    default:
      console.warn(`Unhandled potion spell: ${spell.name}`)
      break
  }
}

function castOffensiveSpell({ spell, aimPos, zapTile }) {
  switch (spell.name) {
    case 'Magic Bolt':
      castMagicBoltSpell({ aimPos, spellLevel: spell.currentSpellLevel, zapTile })
      break

    case 'Magic Lightning':
      castMagicLightningSpell({ aimPos, spellLevel: spell.currentSpellLevel, zapTile })
      break

    default:
      console.warn(`Unhandled offensive spell: ${spell.name}`)
      break
  }
}

export function castSpell({
  spell,
  casterPos,
  aimPos,
  isTileFree,
  spawnCreature,
  isTileIgnitable,
  igniteTile,
  isTileSpreadableForBlob,
  spreadBlobTile,
  isTileValidForVine,
  applyVineToTile,
  isTileValidForFlood,
  applyFloodToTile,
  isTileValidForHeal,
  healTile,
  zapTile
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

    case 'environment':
      castEnvironmentSpell({
        spell,
        casterPos,
        aimPos,
        isTileIgnitable,
        igniteTile,
        isTileSpreadableForBlob,
        spreadBlobTile,
        isTileValidForVine,
        applyVineToTile,
        isTileValidForFlood,
        applyFloodToTile
      })
      break

    case 'potion':
      castPotionSpell({ spell, casterPos, aimPos, isTileValidForHeal, healTile })
      break

    case 'offensive':
      castOffensiveSpell({ spell, aimPos, zapTile })
      break

    default:
      console.warn(`Unhandled spell category: ${spell.category}`)
      break
  }
}







// import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
// import { wrappedChebyshevDistance, getAreaTiles } from './utils.js'

// export const SUMMON_COUNT_BY_LEVEL = {
//   1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8
// }

// export const RANGED_SPELL_BASE_RANGE = 8
// export const HEALING_RANGE = 1

// const ADJACENT_OFFSETS = [
//   { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
//   { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
// ]

// export function castCreatureSummonSpell({ casterPos, creatureName, spellLevel, isTileFree, spawnCreature }) {
//   const summonCount = SUMMON_COUNT_BY_LEVEL[spellLevel] || 1

//   const adjacentTiles = ADJACENT_OFFSETS.map(offset => ({
//     x: casterPos.x + offset.x,
//     y: casterPos.y + offset.y
//   }))

//   const freeTiles = adjacentTiles.filter(tile => isTileFree(tile))

//   let spawnTiles

//   if (freeTiles.length <= summonCount) {
//     spawnTiles = freeTiles
//   } else {
//     spawnTiles = []
//     const pool = [...freeTiles]

//     while (spawnTiles.length < summonCount) {
//       const index = Math.floor(Math.random() * pool.length)
//       spawnTiles.push(pool[index])
//       pool.splice(index, 1)
//     }
//   }
//   spawnTiles.forEach(tile => {
//     spawnCreature(creatureName, tile)
//   })
// }

// function castEnvironmentTileSpell({ casterPos, spellLevel, isTileValid, applyToTile }) {
//   const tileCount = SUMMON_COUNT_BY_LEVEL[spellLevel] || 1

//   const adjacentTiles = ADJACENT_OFFSETS.map(offset => ({
//     x: casterPos.x + offset.x,
//     y: casterPos.y + offset.y
//   }))

//   const validTiles = adjacentTiles.filter(tile => isTileValid(tile))

//   let tilesToAffect

//   if (validTiles.length <= tileCount) {
//     tilesToAffect = validTiles
//   } else {
//     tilesToAffect = []
//     const pool = [...validTiles]

//     while (tilesToAffect.length < tileCount) {
//       const index = Math.floor(Math.random() * pool.length)
//       tilesToAffect.push(pool[index])
//       pool.splice(index, 1)
//     }
//   }

//   tilesToAffect.forEach(tile => {
//     applyToTile(tile)
//   })
// }

// export function castMagicFireSpell({ casterPos, spellLevel, isTileIgnitable, igniteTile }) {
//   castEnvironmentTileSpell({ casterPos, spellLevel, isTileValid: isTileIgnitable, applyToTile: igniteTile })
// }

// export function castGooeyBlobSpell({ casterPos, spellLevel, isTileSpreadableForBlob, spreadBlobTile }) {
//   castEnvironmentTileSpell({ casterPos, spellLevel, isTileValid: isTileSpreadableForBlob, applyToTile: spreadBlobTile })
// }

// export function castTangleVineSpell({ casterPos, aimPos, spellLevel, isTileValidForVine, applyVineToTile }) {
//   if (!aimPos) return

//   const maxRange = RANGED_SPELL_BASE_RANGE + spellLevel
//   const distance = wrappedChebyshevDistance(casterPos.x, casterPos.y, aimPos.x, aimPos.y, MAP_WIDTH, MAP_HEIGHT)

//   if (distance > maxRange) {
//     console.warn('Tangle Vine cast out of range')
//     return
//   }

//   const areaTiles = getAreaTiles(aimPos.x, aimPos.y, spellLevel, MAP_WIDTH, MAP_HEIGHT)

//   areaTiles.forEach(tile => {
//     if (isTileValidForVine(tile)) applyVineToTile(tile)
//   })
// }

// export function castFloodSpell({ casterPos, aimPos, spellLevel, isTileValidForFlood, applyFloodToTile }) {
//   if (!aimPos) return

//   const maxRange = RANGED_SPELL_BASE_RANGE + spellLevel
//   const distance = wrappedChebyshevDistance(casterPos.x, casterPos.y, aimPos.x, aimPos.y, MAP_WIDTH, MAP_HEIGHT)

//   if (distance > maxRange) {
//     console.warn('Flood cast out of range')
//     return
//   }

//   const areaTiles = getAreaTiles(aimPos.x, aimPos.y, spellLevel, MAP_WIDTH, MAP_HEIGHT)

//   areaTiles.forEach(tile => {
//     if (isTileValidForFlood(tile)) applyFloodToTile(tile)
//   })
// }

// export function castHealingSpell({ casterPos, aimPos, isTileValidForHeal, healTile }) {
//   if (!aimPos) return

//   const distance = wrappedChebyshevDistance(casterPos.x, casterPos.y, aimPos.x, aimPos.y, MAP_WIDTH, MAP_HEIGHT)

//   if (distance > HEALING_RANGE) {
//     console.warn('Healing Potion cast out of range')
//     return
//   }

//   if (!isTileValidForHeal(aimPos)) {
//     console.warn('Healing Potion — no valid target on that tile')
//     return
//   }

//   healTile(aimPos)
// }

// function castEnvironmentSpell({
//   spell,
//   casterPos,
//   aimPos,
//   isTileIgnitable,
//   igniteTile,
//   isTileSpreadableForBlob,
//   spreadBlobTile,
//   isTileValidForVine,
//   applyVineToTile,
//   isTileValidForFlood,
//   applyFloodToTile
// }) {
//   switch (spell.name) {
//     case 'Magic Fire':
//       castMagicFireSpell({ casterPos, spellLevel: spell.currentSpellLevel, isTileIgnitable, igniteTile })
//       break

//     case 'Gooey Blob':
//       castGooeyBlobSpell({ casterPos, spellLevel: spell.currentSpellLevel, isTileSpreadableForBlob, spreadBlobTile })
//       break

//     case 'Tangle Vine':
//       castTangleVineSpell({ casterPos, aimPos, spellLevel: spell.currentSpellLevel, isTileValidForVine, applyVineToTile })
//       break

//     case 'Flood':
//       castFloodSpell({ casterPos, aimPos, spellLevel: spell.currentSpellLevel, isTileValidForFlood, applyFloodToTile })
//       break

//     default:
//       console.warn(`Unhandled environment spell: ${spell.name}`)
//       break
//   }
// }

// function castPotionSpell({ spell, casterPos, aimPos, isTileValidForHeal, healTile }) {
//   switch (spell.name) {
//     case 'Healing Potion':
//       castHealingSpell({ casterPos, aimPos, isTileValidForHeal, healTile })
//       break

//     default:
//       console.warn(`Unhandled potion spell: ${spell.name}`)
//       break
//   }
// }

// export function castSpell({
//   spell,
//   casterPos,
//   aimPos,
//   isTileFree,
//   spawnCreature,
//   isTileIgnitable,
//   igniteTile,
//   isTileSpreadableForBlob,
//   spreadBlobTile,
//   isTileValidForVine,
//   applyVineToTile,
//   isTileValidForFlood,
//   applyFloodToTile,
//   isTileValidForHeal,
//   healTile
// }) {
//   if (!spell) {
//     console.warn('castSpell called with no spell')
//     return
//   }

//   switch (spell.category) {
//     case 'creature':
//       castCreatureSummonSpell({
//         casterPos,
//         creatureName: spell.name,
//         spellLevel: spell.currentSpellLevel,
//         isTileFree,
//         spawnCreature
//       })
//       break

//     case 'environment':
//       castEnvironmentSpell({
//         spell,
//         casterPos,
//         aimPos,
//         isTileIgnitable,
//         igniteTile,
//         isTileSpreadableForBlob,
//         spreadBlobTile,
//         isTileValidForVine,
//         applyVineToTile,
//         isTileValidForFlood,
//         applyFloodToTile
//       })
//       break

//     case 'potion':
//       castPotionSpell({ spell, casterPos, aimPos, isTileValidForHeal, healTile })
//       break

//     default:
//       console.warn(`Unhandled spell category: ${spell.category}`)
//       break
//   }
// }