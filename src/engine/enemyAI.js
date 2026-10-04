import { ENEMY_WIZARD } from '../data/enemyWizard.js'
import { RIDE_AP_COST } from './mounts.js'
import { moveEnemyWizard } from './enemyWizardMovement.js'
import { castEnemyWizardSpells } from './enemyWizardSpells.js'
import { runEnemyCreaturesAI } from './enemyCreatures.js'

export { runEnemyCreaturesAI }

export function runEnemyWizardAI(terrainLayer, objectLayer, portalPosition, effectLayer, itemLayer) {
  const heldBack = Math.min(RIDE_AP_COST, ENEMY_WIZARD.ap)
  ENEMY_WIZARD.ap -= heldBack

  const first = moveEnemyWizard(terrainLayer, objectLayer, portalPosition, effectLayer, itemLayer)

  ENEMY_WIZARD.ap += heldBack

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
      frames: first.frames
    }
  }

  const cast = castEnemyWizardSpells(first.terrainLayer, first.objectLayer, effectLayer)

  const second = moveEnemyWizard(
    first.terrainLayer,
    cast.objectLayer,
    portalPosition,
    cast.effectLayer,
    first.itemLayer
  )

  return {
    objectLayer: second.objectLayer,
    effectLayer: cast.effectLayer,
    terrainLayer: second.terrainLayer,
    itemLayer: second.itemLayer,
    zapEffects: cast.zapEffects,
    moved: first.moved || second.moved,
    position: second.position ?? first.position,
    defeatedTarget: second.defeatedTarget ?? first.defeatedTarget,
    selfDefeated: second.selfDefeated,
    frames: [...first.frames, ...cast.frames, ...second.frames]
  }
}
