export const CREATURES = [
  {
    name: 'Dwarf',
    type: 'Humanoid',
    alignment: 'Good',
    attack: 3,
    defence: 4,
    movement: 3,
    health: 6,
    special: []
  },
  {
    name: 'Elf',
    type: 'Humanoid',
    alignment: 'Good',
    attack: 3,
    defence: 3,
    movement: 4,
    health: 5,
    special: ['ranged']
  },
  {
    name: 'Hobbit',
    type: 'Humanoid',
    alignment: 'Good',
    attack: 2,
    defence: 3,
    movement: 4,
    health: 4,
    special: []
  },
  {
    name: 'Warrior',
    type: 'Humanoid',
    alignment: 'Neutral',
    attack: 4,
    defence: 3,
    movement: 4,
    health: 6,
    special: []
  },
  {
    name: 'Archer',
    type: 'Humanoid',
    alignment: 'Neutral',
    attack: 2,
    defence: 2,
    movement: 4,
    health: 4,
    special: ['ranged']
  },
  {
    name: 'Ranger',
    type: 'Humanoid',
    alignment: 'Good',
    attack: 3,
    defence: 3,
    movement: 5,
    health: 5,
    special: ['ranged']
  },
  {
    name: 'Knight',
    type: 'Humanoid',
    alignment: 'Good',
    attack: 5,
    defence: 5,
    movement: 4,
    health: 8,
    special: []
  },
  {
    name: 'Centaur',
    type: 'Humanoid',
    alignment: 'Neutral',
    attack: 4,
    defence: 3,
    movement: 6,
    health: 6,
    special: ['fast']
  },
  {
    name: 'Faun',
    type: 'Humanoid',
    alignment: 'Good',
    attack: 2,
    defence: 2,
    movement: 5,
    health: 4,
    special: []
  },
  {
    name: 'Goblin',
    type: 'Humanoid',
    alignment: 'Evil',
    attack: 2,
    defence: 2,
    movement: 4,
    health: 4,
    special: []
  },
  {
    name: 'Broo',
    type: 'Humanoid',
    alignment: 'Evil',
    attack: 4,
    defence: 3,
    movement: 4,
    health: 6,
    special: ['chaos']
  },
  {
    name: 'Pixie',
    type: 'Fey',
    alignment: 'Good',
    attack: 1,
    defence: 2,
    movement: 6,
    health: 3,
    special: ['flying']
  },
  {
    name: 'Pegasus',
    type: 'Beast',
    alignment: 'Good',
    attack: 3,
    defence: 3,
    movement: 8,
    health: 6,
    special: ['flying']
  },
  {
    name: 'Unicorn',
    type: 'Beast',
    alignment: 'Good',
    attack: 4,
    defence: 4,
    movement: 6,
    health: 7,
    special: ['holy']
  },
  {
    name: 'Griffin',
    type: 'Beast',
    alignment: 'Good',
    attack: 5,
    defence: 4,
    movement: 7,
    health: 8,
    special: ['flying']
  },
  {
    name: 'Giant',
    type: 'Monster',
    alignment: 'Neutral',
    attack: 6,
    defence: 4,
    movement: 3,
    health: 10,
    special: []
  },
  {
    name: 'Troll',
    type: 'Monster',
    alignment: 'Evil',
    attack: 5,
    defence: 3,
    movement: 3,
    health: 9,
    special: ['regenerate']
  },
  {
    name: 'Ogre',
    type: 'Monster',
    alignment: 'Evil',
    attack: 5,
    defence: 3,
    movement: 3,
    health: 8,
    special: []
  },
  {
    name: 'Orc',
    type: 'Monster',
    alignment: 'Evil',
    attack: 3,
    defence: 2,
    movement: 4,
    health: 5,
    special: []
  },
  {
    name: 'Hydra',
    type: 'Monster',
    alignment: 'Evil',
    attack: 7,
    defence: 4,
    movement: 3,
    health: 12,
    special: ['multi-attack']
  },
  {
    name: 'Manticore',
    type: 'Mythic',
    alignment: 'Evil',
    attack: 6,
    defence: 4,
    movement: 6,
    health: 9,
    special: ['ranged']
  },
  {
    name: 'Harpy',
    type: 'Mythic',
    alignment: 'Evil',
    attack: 3,
    defence: 2,
    movement: 7,
    health: 5,
    special: ['flying']
  },
  {
    name: 'Demon',
    type: 'Undead',
    alignment: 'Evil',
    attack: 7,
    defence: 5,
    movement: 6,
    health: 10,
    special: ['fear']
  },
  {
    name: 'Wraith',
    type: 'Undead',
    alignment: 'Evil',
    attack: 4,
    defence: 4,
    movement: 6,
    health: 6,
    special: ['ethereal']
  },
  {
    name: 'Spectre',
    type: 'Undead',
    alignment: 'Evil',
    attack: 3,
    defence: 3,
    movement: 6,
    health: 5,
    special: ['ethereal']
  },
  {
    name: 'Ghost',
    type: 'Undead',
    alignment: 'Neutral',
    attack: 2,
    defence: 2,
    movement: 6,
    health: 4,
    special: ['ethereal']
  },
  {
    name: 'Vampire',
    type: 'Undead',
    alignment: 'Evil',
    attack: 6,
    defence: 4,
    movement: 7,
    health: 8,
    special: ['flying', 'drain']
  },
  {
    name: 'Green Dragon',
    type: 'Dragon',
    alignment: 'Neutral',
    attack: 7,
    defence: 6,
    movement: 6,
    health: 12,
    special: ['flying', 'poison-breath']
  },
  {
    name: 'Gold Dragon',
    type: 'Dragon',
    alignment: 'Good',
    attack: 8,
    defence: 7,
    movement: 7,
    health: 14,
    special: ['flying', 'holy-breath']
  },
  {
    name: 'Red Dragon',
    type: 'Dragon',
    alignment: 'Evil',
    attack: 9,
    defence: 6,
    movement: 7,
    health: 14,
    special: ['flying', 'fire-breath']
  }
]
