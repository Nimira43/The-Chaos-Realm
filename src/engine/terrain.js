export const MAP_WIDTH = 32
export const MAP_HEIGHT = 32

export const terrainColours = {
  grass: '#3cb043',
  rough: '#8b5a2b',
  rock: '#555555',
  swamp: '#6b8e23',
  water: '#1e90ff',
  forest: '#0b6623',
  portal: '#ffcc00',
  wall: '#800000',
  road: '#999999',
  door: '#003366',
  key: '#000000',
  floor: '#dddddd',
  creature: '#ff4500',
  enemyWizard: '#ff0e0e',
  playerWizard: '#ffffff',
}

export const terrainCost = {
  grass: 2,
  rough: 4,
  rock: 6,
  swamp: 6,
  water: 999,
  forest: 4,
  portal: 1,    
  wall: 999,    
  road: 1,      
  door: 999,    
  key: 1,       
  floor: 2,     
  creature: 999,
  enemyWizard: 999,
  playerWizard: 999,
}

export function isTerrain(tile) {
  return [
    'grass',
    'rough',
    'rock',
    'swamp',
    'water',
    'forest',
    'portal',
    'wall',
    'road',
    'door',
    'key',
    'floor'
  ].includes(tile)
}


