import { MAP_WIDTH, MAP_HEIGHT } from './terrain.js'
import { wrappedChebyshevDistance, getAreaTiles } from './utils.js'

export const SUMMON_COUNT_BY_LEVEL = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8
}

export const RANGED_SPELL_BASE_RANGE = 8

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
  applyFloodToTile
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

    default:
      console.warn(`Unhandled spell category: ${spell.category}`)
      break
  }
}