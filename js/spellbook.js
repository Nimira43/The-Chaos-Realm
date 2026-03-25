export const SPELLS = [
  {
    name: 'Summon Goblin',
    type: 'summon',
    cost: 2,
    difficulty: 80,
    creature: 'Goblin',
    special: []
  },
  {
    name: 'Summon Orc',
    type: 'summon',
    cost: 3,
    difficulty: 75,
    creature: 'Orc',
    special: []
  },
  {
    name: 'Summon Elf',
    type: 'summon',
    cost: 4,
    difficulty: 70,
    creature: 'Elf',
    special: []
  },
  {
    name: 'Summon Centaur',
    type: 'summon',
    cost: 5,
    difficulty: 65,
    creature: 'Centaur',
    special: []
  },
  {
    name: 'Summon Griffin',
    type: 'summon',
    cost: 7,
    difficulty: 55,
    creature: 'Griffin',
    special: ['flying']
  },
  {
    name: 'Summon Red Dragon',
    type: 'summon',
    cost: 12,
    difficulty: 40,
    creature: 'Red Dragon',
    special: ['flying', 'fire-breath']
  },
  {
    name: 'Illusionary Goblin',
    type: 'illusion',
    cost: 1,
    difficulty: 90,
    creature: 'Goblin',
    special: ['illusion']
  },
  {
    name: 'Illusionary Dragon',
    type: 'illusion',
    cost: 3,
    difficulty: 75,
    creature: 'Red Dragon',
    special: ['illusion']
  },
  {
    name: 'Magic Bolt',
    type: 'attack',
    cost: 2,
    difficulty: 85,
    damage: 3,
    range: 4,
    special: []
  },
  {
    name: 'Fireball',
    type: 'attack',
    cost: 4,
    difficulty: 70,
    damage: 5,
    range: 5,
    special: ['area']
  },
  {
    name: 'Lightning',
    type: 'attack',
    cost: 5,
    difficulty: 65,
    damage: 6,
    range: 6,
    special: ['piercing']
  },
  {
    name: 'Teleport',
    type: 'movement',
    cost: 3,
    difficulty: 80,
    range: 8,
    special: []
  },
  {
    name: 'Fly',
    type: 'movement',
    cost: 4,
    difficulty: 75,
    duration: 3,
    special: ['grant-flying']
  },
  {
    name: 'Create Wall',
    type: 'terrain',
    cost: 2,
    difficulty: 85,
    terrain: 'rough',
    special: []
  },
  {
    name: 'Create Forest',
    type: 'terrain',
    cost: 3,
    difficulty: 75,
    terrain: 'forest',
    special: []
  },
  {
    name: 'Create Swamp',
    type: 'terrain',
    cost: 3,
    difficulty: 70,
    terrain: 'swamp',
    special: []
  },
  {
    name: 'Heal',
    type: 'utility',
    cost: 3,
    difficulty: 85,
    heal: 4,
    special: []
  },
  {
    name: 'Reveal Map',
    type: 'utility',
    cost: 4,
    difficulty: 80,
    special: ['reveal']
  },
  {
    name: 'Disbelieve',
    type: 'utility',
    cost: 0,
    difficulty: 100,
    special: ['disbelieve']
  }
]
