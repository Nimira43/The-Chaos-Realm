// An archetype is the "school" a generated enemy wizard belongs to. It decides
// which spells he leans towards and which stats he trains, so two wizards with
// the same budget still feel different to fight.
//
//   favoured : bought about five times as eagerly as the rest
//   avoided  : bought only rarely
//   statBias : multiplies how far a stat climbs up its ladder (1 = normal)
//
// Spell names that are not in the spellbook (yet) are simply ignored, so new
// creatures can be added here before or after they exist.

export const ARCHETYPES = [
  {
    id: 'pyromancer',
    title: 'Pyromancer',
    blurb: 'Fire, dragons and demons.',
    favoured: ['Magic Fire', 'Cindermaw', 'Red Dragon', 'Gold Dragon', 'Demon', 'Magic Lightning', 'Magic Bolt', 'Manticore'],
    avoided: ['Flood', 'Sea Wolf', 'Yeti', 'Tangle Vine', 'Cipactli'],
    statBias: { combat: 1.2, magic_resistance: 1.2, defence: 0.8 }
  },
  {
    id: 'necromancer',
    title: 'Necromancer',
    blurb: 'The dead and the things that drink from the living.',
    favoured: ['Zombie', 'Ghost', 'Vampire', 'Spectre', 'Giant Bat', 'Demon', 'Giant Spider'],
    avoided: ['Healing Potion', 'Unicorn', 'Pegasus', 'Pixie', 'Centaur', 'Gryphon'],
    statBias: { magic_resistance: 1.4, stamina: 1.2, max_ap: 0.8 }
  },
  {
    id: 'beastmaster',
    title: 'Beastmaster',
    blurb: 'A rushing herd of fast animals.',
    favoured: ['Centaur', 'Pegasus', 'Gryphon', 'Giant Eagle', 'Unicorn', 'Manticore', 'Mammoth', 'Yeti', 'Chimera', 'Sea Wolf', 'Harpy'],
    avoided: ['Zombie', 'Ghost', 'Spectre', 'Vampire', 'Magic Fire'],
    statBias: { max_ap: 1.4, stamina: 1.2, magic_resistance: 0.8 }
  },
  {
    id: 'warlord',
    title: 'Warlord',
    blurb: 'Brutes in numbers, and he fights beside them.',
    favoured: ['Goblin', 'Orc', 'Troll', 'Ogre', 'Giant', 'Dwarf', 'Broo', 'Mammoth'],
    avoided: ['Pixie', 'Ghost', 'Magic Lightning', 'Flood', 'Healing Potion'],
    statBias: { combat: 1.5, defence: 1.5, max_ap: 0.8, magic_resistance: 0.7 }
  },
  {
    id: 'stormcaller',
    title: 'Stormcaller',
    blurb: 'Lightning from range, and wings to chase you.',
    favoured: ['Magic Lightning', 'Magic Bolt', 'Flood', 'Pegasus', 'Giant Eagle', 'Gryphon', 'Harpy', 'Pixie', 'Giant Bat'],
    avoided: ['Troll', 'Ogre', 'Giant', 'Mammoth', 'Zombie'],
    statBias: { max_ap: 1.3, magic_resistance: 1.3, combat: 0.7, defence: 0.7 }
  },
  {
    id: 'warden',
    title: 'Warden',
    blurb: 'Roots, mud and patient things that bite.',
    favoured: ['Thornhart', 'Tangle Vine', 'Gooey Blob', 'Giant Spider', 'Cipactli', 'Healing Potion', 'Dwarf', 'Pixie', 'Unicorn', 'Chimera'],
    avoided: ['Demon', 'Vampire', 'Magic Lightning', 'Gold Dragon'],
    statBias: { defence: 1.4, stamina: 1.3, max_ap: 0.9 }
  }
]

export function archetypeById(id) {
  return ARCHETYPES.find(a => a.id === id) || ARCHETYPES[0]
}
