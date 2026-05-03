export const SPELLBOOK = [
  { name: 'Gold Dragon', manaCost: 47, currentSpellLevel: 0, category: 'creature', duration: 'permanent' },
  { name: 'Green Dragon', manaCost: 39, currentSpellLevel: 2, category: 'creature', duration: 'permanent' },
  { name: 'Red Dragon', manaCost: 31, currentSpellLevel: 1, category: 'creature', duration: 'permanent' },
  { name: 'Pixie', manaCost: 7, currentSpellLevel: 4, category: 'creature', duration: 'permanent' },
  { name: 'Dwarf', manaCost: 5, currentSpellLevel: 3, category: 'creature', duration: 'permanent' },
  { name: 'Goblin', manaCost: 7, currentSpellLevel: 4, category: 'creature', duration: 'permanent' },
  { name: 'Troll', manaCost: 13, currentSpellLevel: 2, category: 'creature', duration: 'permanent' },
  { name: 'Giant', manaCost: 17, currentSpellLevel: 0, category: 'creature', duration: 'permanent' },
  { name: 'Centaur', manaCost: 10, currentSpellLevel: 8, category: 'creature', duration: 'permanent' },
  { name: 'Unicorn', manaCost: 10, currentSpellLevel: 0, category: 'creature', duration: 'permanent' },
  { name: 'Pegasus', manaCost: 12, currentSpellLevel: 6, category: 'creature', duration: 'permanent' },
  { name: 'Gryphon', manaCost: 19, currentSpellLevel: 2, category: 'creature', duration: 'permanent' },
  { name: 'Elephant', manaCost: 17, currentSpellLevel: 1, category: 'creature', duration: 'permanent' },
  { name: 'Gorilla', manaCost: 8, currentSpellLevel: 5, category: 'creature', duration: 'permanent' },
  { name: 'Lion', manaCost: 10, currentSpellLevel: 0, category: 'creature', duration: 'permanent' },
  { name: 'Bear', manaCost: 12, currentSpellLevel: 8, category: 'creature', duration: 'permanent' },
  { name: 'Crocodile', manaCost: 11, currentSpellLevel: 2, category: 'creature', duration: 'permanent' },
  { name: 'Giant Bat', manaCost: 5, currentSpellLevel: 2, category: 'creature', duration: 'permanent' },
  { name: 'Harpy', manaCost: 11, currentSpellLevel: 0, category: 'creature', duration: 'permanent' },
  { name: 'Giant Spider', manaCost: 22, currentSpellLevel: 7, category: 'creature', duration: 'permanent' },
  { name: 'Zombie', manaCost: 16, currentSpellLevel: 2, category: 'creature', duration: 'permanent' },
  { name: 'Ghost', manaCost: 14, currentSpellLevel: 1, category: 'creature', duration: 'permanent' },
  { name: 'Vampire', manaCost: 29, currentSpellLevel: 2, category: 'creature', duration: 'permanent' },
  { name: 'Spectre', manaCost: 29, currentSpellLevel: 0, category: 'creature', duration: 'permanent' },
  { name: 'Demon', manaCost: 40, currentSpellLevel: 4, category: 'creature', duration: 'permanent' }
]

  // --- POTIONS (4 turns except healing) ---
  // { name: 'Strength Potion', manaCost: 8, currentSpellLevel: 5, category: 'potion', duration: 4 },
  // { name: 'Protection Potion', manaCost: 6, currentSpellLevel: 5, category: 'potion', duration: 4 },
  // { name: 'Invisibility Potion', manaCost: 16, currentSpellLevel: 5, category: 'potion', duration: 4 },
  // { name: 'Speed Potion', manaCost: 8, currentSpellLevel: 5, category: 'potion', duration: 4 },
  // { name: 'Flying Potion', manaCost: 5, currentSpellLevel: 5, category: 'potion', duration: 4 },
  // { name: 'Super Potion', manaCost: 16, currentSpellLevel: 5, category: 'potion', duration: 4 },
  // { name: 'Healing Potion', manaCost: 5, currentSpellLevel: 5, category: 'potion', duration: 'instant' },

  // --- ENVIRONMENT ---
  // { name: 'Magic Fire', manaCost: 15, currentSpellLevel: 5, category: 'environment', duration: 'spreading' },
  // { name: 'Gooey Blob', manaCost: 12, currentSpellLevel: 5, category: 'environment', duration: 'spreading' },
  // { name: 'Tangle Vine', manaCost: 10, currentSpellLevel: 5, category: 'environment', duration: 'static' },
  // { name: 'Flood', manaCost: 10, currentSpellLevel: 5, category: 'environment', duration: 'static' },

  // --- PERSONAL (4 turns) ---
  // { name: 'Enchant', manaCost: 10, currentSpellLevel: 5, category: 'personal', duration: 4 },
  // { name: 'Subversion', manaCost: 10, currentSpellLevel: 5, category: 'personal', duration: 4 },
  // { name: 'Curse', manaCost: 8, currentSpellLevel: 5, category: 'personal', duration: 4 },

  // --- OFFENSIVE (instant) ---
  // { name: 'Magic Attack', manaCost: 10, currentSpellLevel: 5, category: 'offensive', duration: 'instant' },
  // { name: 'Magic Bolt', manaCost: 6, currentSpellLevel: 5, category: 'offensive', duration: 'instant' },
  // { name: 'Magic Lightning', manaCost: 12, currentSpellLevel: 5, category: 'offensive', duration: 'instant' },

  // --- UTILITY (instant) ---
//   { name: 'Teleport', manaCost: 16, currentSpellLevel: 5, category: 'utility', duration: 'instant' },
//   { name: 'Magic Eye', manaCost: 8, currentSpellLevel: 5, category: 'utility', duration: 'instant' },
//   { name: 'Magic Shield', manaCost: 6, currentSpellLevel: 5, category: 'utility', duration: 4 }
// ]

export const TESTING_SPELLBOOK = [
  // --- CREATURES ---
  { name: 'Demon', manaCost: 40, maxUnits: 3, remainingUnits: 3, category: 'creature', duration: 'permanent' },
  { name: 'Red Dragon', manaCost: 31, maxUnits: 2, remainingUnits: 2, category: 'creature', duration: 'permanent' },
  { name: 'Gryphon', manaCost: 19, maxUnits: 2, remainingUnits: 2, category: 'creature', duration: 'permanent' },
  { name: 'Unicorn', manaCost: 10, maxUnits: 3, remainingUnits: 3, category: 'creature', duration: 'permanent' },
  { name: 'Centaur', manaCost: 10, maxUnits: 4, remainingUnits: 4, category: 'creature', duration: 'permanent' },
  { name: 'Giant Spider', manaCost: 22, maxUnits: 4, remainingUnits: 4, category: 'creature', duration: 'permanent' },
  { name: 'Goblin', manaCost: 7, maxUnits: 4, remainingUnits: 4, category: 'creature', duration: 'permanent' },
  { name: 'Giant Bat', manaCost: 5, maxUnits: 3, remainingUnits: 3, category: 'creature', duration: 'permanent' },
  { name: 'Troll', manaCost: 13, maxUnits: 2, remainingUnits: 2, category: 'creature', duration: 'permanent' },
  { name: 'Lion', manaCost: 10, maxUnits: 2, remainingUnits: 2, category: 'creature', duration: 'permanent' },
  { name: 'Bear', manaCost: 12, maxUnits: 2, remainingUnits: 2, category: 'creature', duration: 'permanent' },
  { name: 'Elephant', manaCost: 17, maxUnits: 2, remainingUnits: 2, category: 'creature', duration: 'permanent' },
  { name: 'Vampire', manaCost: 29, maxUnits: 1, remainingUnits: 1, category: 'creature', duration: 'permanent' },

  // --- POTIONS ---
  { name: 'Strength Potion', manaCost: 8, maxUnits: 4, remainingUnits: 4, category: 'potion', duration: 4 },
  { name: 'Protection Potion', manaCost: 6, maxUnits: 4, remainingUnits: 4, category: 'potion', duration: 4 },
  { name: 'Invisibility Potion', manaCost: 16, maxUnits: 2, remainingUnits: 2, category: 'potion', duration: 4 },
  { name: 'Speed Potion', manaCost: 8, maxUnits: 2, remainingUnits: 2, category: 'potion', duration: 4 },
  { name: 'Flying Potion', manaCost: 5, maxUnits: 2, remainingUnits: 2, category: 'potion', duration: 4 },
  { name: 'Healing Potion', manaCost: 5, maxUnits: 2, remainingUnits: 2, category: 'potion', duration: 'instant' },

  // --- ENVIRONMENT ---
  { name: 'Magic Fire', manaCost: 15, maxUnits: 3, remainingUnits: 3, category: 'environment', duration: 'spreading' },
  { name: 'Gooey Blob', manaCost: 12, maxUnits: 3, remainingUnits: 3, category: 'environment', duration: 'spreading' },
  { name: 'Tangle Vine', manaCost: 10, maxUnits: 2, remainingUnits: 2, category: 'environment', duration: 'static' },
  { name: 'Flood', manaCost: 10, maxUnits: 2, remainingUnits: 2, category: 'environment', duration: 'static' },

  // --- PERSONAL ---
  { name: 'Enchant', manaCost: 10, maxUnits: 2, remainingUnits: 2, category: 'personal', duration: 4 },
  { name: 'Subversion', manaCost: 10, maxUnits: 2, remainingUnits: 2, category: 'personal', duration: 4 },
  { name: 'Curse', manaCost: 8, maxUnits: 2, remainingUnits: 2, category: 'personal', duration: 4 },

  // --- OFFENSIVE ---
  { name: 'Magic Bolt', manaCost: 6, maxUnits: 4, remainingUnits: 4, category: 'offensive', duration: 'instant' },
  { name: 'Magic Lightning', manaCost: 12, maxUnits: 2, remainingUnits: 2, category: 'offensive', duration: 'instant' },
  { name: 'Magic Attack', manaCost: 10, maxUnits: 2, remainingUnits: 2, category: 'offensive', duration: 'instant' },

  // --- UTILITY ---
  { name: 'Teleport', manaCost: 16, maxUnits: 2, remainingUnits: 2, category: 'utility', duration: 'instant' },
  { name: 'Magic Eye', manaCost: 8, maxUnits: 2, remainingUnits: 2, category: 'utility', duration: 'instant' },
  { name: 'Magic Shield', manaCost: 6, maxUnits: 4, remainingUnits: 4, category: 'utility', duration: 4 }
]

