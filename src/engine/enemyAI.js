import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import {
  RIDE_AP_COST,
  FLY_TOGGLE_AP_COST,
  isCurrentlyFlying,
  withFlying,
  withMoverAp,
} from './mounts.js'
import { canLandOn } from './useMountActions.js'
import { moveEnemyWizard } from './enemyWizardMovement.js'
import { castEnemyWizardSpells } from './enemyWizardSpells.js'
import { runEnemyWizardRanged } from './enemyWizardRanged.js'
import { runEnemyCreaturesAI } from './enemyCreatures.js'

export { runEnemyCreaturesAI }

function landToCast(terrainLayer, objectLayer, itemLayer) {
  const { x, y } = ENEMY_WIZARD
  const cell = objectLayer[y][x]

  if (!isCurrentlyFlying(cell))
    return { objectLayer, frames: [], grounded: true }

  const canLand =
    !!cell.mount &&
    cell.mount.ap >= FLY_TOGGLE_AP_COST &&
    canLandOn(terrainLayer[y][x], cell.mount.stats, itemLayer?.[y]?.[x])

  if (!canLand) return { objectLayer, frames: [], grounded: false }

  const landed = objectLayer.map((row) => [...row])
  landed[y][x] = withMoverAp(
    withFlying(cell, false),
    cell.mount.ap - FLY_TOGGLE_AP_COST,
  )
  return { objectLayer: landed, frames: [landed], grounded: true }
}

export function runEnemyWizardAI(
  terrainLayer,
  objectLayer,
  portalPosition,
  effectLayer,
  itemLayer,
) {
  const heldBack = Math.min(RIDE_AP_COST, ENEMY_WIZARD.ap)
  ENEMY_WIZARD.ap -= heldBack

  let startLayer = objectLayer
  let mountHeld = 0
  const startCell = objectLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
  if (startCell?.mount && isCurrentlyFlying(startCell)) {
    mountHeld = Math.min(FLY_TOGGLE_AP_COST * 2, startCell.mount.ap)
    startLayer = objectLayer.map((row) => [...row])
    startLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = withMoverAp(
      startCell,
      startCell.mount.ap - mountHeld,
    )
  }

  const first = moveEnemyWizard(
    terrainLayer,
    startLayer,
    portalPosition,
    effectLayer,
    itemLayer,
  )

  ENEMY_WIZARD.ap += heldBack

  if (mountHeld > 0 && !first.selfDefeated) {
    const endCell = first.objectLayer[ENEMY_WIZARD.y][ENEMY_WIZARD.x]
    if (endCell?.mount) {
      const restored = first.objectLayer.map((row) => [...row])
      restored[ENEMY_WIZARD.y][ENEMY_WIZARD.x] = withMoverAp(
        endCell,
        endCell.mount.ap + mountHeld,
      )
      first.objectLayer = restored
    }
  }

  if (first.selfDefeated) {
    return {
      objectLayer: first.objectLayer,
      effectLayer,
      terrainLayer: first.terrainLayer,
      itemLayer: first.itemLayer,
      zapEffects: [],
      moved: first.moved,
      position: first.position,
      defeatedTarget: first.defeatedTarget,
      selfDefeated: true,
      frames: first.frames,
    }
  }

  const landing = landToCast(
    first.terrainLayer,
    first.objectLayer,
    first.itemLayer,
  )

  const cast = landing.grounded
    ? castEnemyWizardSpells(
        first.terrainLayer,
        landing.objectLayer,
        effectLayer,
        first.itemLayer,
        portalPosition,
      )
    : {
        objectLayer: landing.objectLayer,
        effectLayer,
        zapEffects: [],
        frames: [],
      }

  const ranged = runEnemyWizardRanged(
    first.terrainLayer,
    cast.objectLayer,
    first.itemLayer,
  )

  const second = moveEnemyWizard(
    first.terrainLayer,
    ranged.objectLayer,
    portalPosition,
    cast.effectLayer,
    ranged.itemLayer,
  )

  return {
    objectLayer: second.objectLayer,
    effectLayer: cast.effectLayer,
    terrainLayer: second.terrainLayer,
    itemLayer: second.itemLayer,
    zapEffects: cast.zapEffects,
    moved: first.moved || second.moved,
    position: second.position ?? first.position,
    defeatedTarget:
      second.defeatedTarget ?? ranged.defeatedTarget ?? first.defeatedTarget,
    selfDefeated: second.selfDefeated,
    frames: [
      ...first.frames,
      ...landing.frames,
      ...cast.frames,
      ...ranged.frames,
      ...second.frames,
    ],
  }
}
