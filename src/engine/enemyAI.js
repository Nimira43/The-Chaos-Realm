import { moveEnemyWizard } from './enemyWizardMovement.js'
import { castEnemyWizardSpell } from './enemyWizardSpells.js'
import { runEnemyCreaturesAI } from './enemyCreatures.js'

export { runEnemyCreaturesAI }

export function runEnemyWizardAI(terrainLayer, objectLayer, portalPosition, effectLayer, itemLayer) {
  const moveResult = moveEnemyWizard(terrainLayer, objectLayer, portalPosition, effectLayer, itemLayer)

  if (moveResult.selfDefeated) {
    return {
      objectLayer: moveResult.objectLayer,
      effectLayer,
      terrainLayer: moveResult.terrainLayer,
      itemLayer: moveResult.itemLayer,
      zapEffects: [],
      moved: moveResult.moved,
      position: moveResult.position,
      defeatedTarget: moveResult.defeatedTarget,
      selfDefeated: true,
      frames: moveResult.frames
    }
  }

  const castResult = castEnemyWizardSpell(moveResult.terrainLayer, moveResult.objectLayer, effectLayer)
  const frames = castResult.cast ? [...moveResult.frames, castResult.objectLayer] : moveResult.frames

  return {
    objectLayer: castResult.objectLayer,
    effectLayer: castResult.effectLayer,
    terrainLayer: moveResult.terrainLayer,
    itemLayer: moveResult.itemLayer,
    zapEffects: castResult.zapEffects || [],
    moved: moveResult.moved,
    position: moveResult.position,
    defeatedTarget: moveResult.defeatedTarget,
    selfDefeated: false,
    frames
  }
}