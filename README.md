# The Chaos Realm

A turn-based fantasy strategy game for the browser, and a love letter to *Lords of Chaos* (1990).

You are a wizard on a 32 × 32 wrapping map. Summon creatures, cast spells, gather treasure, and reach the **Portal** before time runs out, while a rival enemy wizard with his own spellbook, army and cunning tries to do the same to you.

Built with **React 19**, **Vite**, **react-router-dom** and the HTML canvas.

---

## The goal

- The **Portal** opens on **turn 20** of **30**. Reaching it is the win.
- Whoever stands on the Portal wins the level. If your wizard falls, the level is lost.
- Killing the enemy wizard is **not** the end. His creatures keep fighting, and he can still take the Portal if you leave an opening.
- Win levels to earn points, then spend them in the shop before the next battle.

## Game modes

| Mode | What it is |
| --- | --- |
| **Main Campaign** | 50 handcrafted levels in three tiers played in order: Low (01–20), Medium (21–35) and High (36–50). Levels are shuffled within each tier. |
| **Random Mode** | A run of random levels from a tier you choose. |
| **Select Mode** | Pick exactly which levels you want to play. |
| **Loot Mode** | No combat. A flat one-off AP budget and a Bank button. Gather jewels and coins and bank them. It unlocks once a save has completed its first level. |
| **3 Level Test** | A short three-level campaign linked by the shop, used for testing. |

Runs are saved by name, so each wizard clone keeps its own progress.

## Your wizard

- Wizards are built in the **Wizard Editor** with a **400-point budget** that buys spells and stats.
  - Spells cost mana cost × level, up to level 8.
  - Stats cost 1 point per stat point.
  - Unspent points are banked for the clone.
- Pick a wizard when you start a run. The clone follows its own career, and constitution resets to 100 each level.
- Between levels, the **shop** lets you spend your points on more spells and stats.

## Spells

- **Creatures:** over 30 summonable creatures, from Pixies and Goblins to Demons and Dragons. Each has its own AP, combat, defence, magic resistance and terrain affinities (water, wood, rock, lava). See the **Bestiary** page for portraits, bios and stats.
- **Environment:** Magic Fire, Gooey Blob, Tangle Vine and Flood. They reshape the battlefield and can break walls and locked doors.
- **Offensive:** Magic Bolt and Magic Lightning.
- **Healing:** Healing Potion.

## The map

- Terrain includes grass, rough, road, forest, swamp, rock, wasteland, water, lava, mountain, walls, floors and doors (locked, unlocked and open).
- Maps **wrap** at the edges.
- **Flying** units pass over almost everything but can only land on suitable ground. They cannot land on floor, walls, mountains, lava, the Portal, doors or keys. They cannot take off from floor, lava or doors.
- **Floor and the Portal tile** shield ground units from attacks by fliers.
- Keys open locked doors. Mounts (riders and fliers) change what a unit can cross.

## Reading the counters

Wizards and creatures appear as round board-game counters.

- **Blue** counters are yours. **Red** counters are the enemy's.
- Creatures show a 3-letter code. Wizards wear a hat.
- The **outer arc** is health: green, then amber, then red.
- A **bright yellow rim** means one of your units still has AP left.
- A **sky-blue ring** with an **F** means flying. A **green ring** with an **R** means riding a mount.

## The enemy wizard

Enemy wizards are generated per level and grow stronger as you progress (budget 400 + 80 per level beyond the first). Every enemy also gets a **Gift Box**: free Cindermaw, Sea Wolf, Giant Eagle, Demon and Tangle Vine.

The AI plans routes to the Portal (by air, land or water, collecting keys and opening doors), picks suitable mounts, stays out of danger, and sends his creatures in first. When a portal is sealed off he breaks in with Fire, Blob or Vine. When the game stalls, a **siege** fallback kicks in: his army goes in hard, he casts Tangle Vine to open a shortcut, and he commits himself by turn 18.

## Controls

| Key | Action |
| --- | --- |
| Arrow keys | Move the cursor, or move the selected unit |
| Space | Select or deselect your wizard or a creature under the cursor |

Spells are chosen from the spellbook on the left and cast with **Cast Selected Spell**. Mount, item and door actions appear in the right-hand panel when they apply.

## Running it

```bash
npm install
npm run dev
```

Open the address Vite prints. The **Map Editor** saves maps through a small Express server that must be running on **port 5000**. Maps are written to `public/created-maps/`. The game itself does not need the server.

## Project layout

```
src/
  pages/    Home, GameModes, GameEngine, MapEditor, WizardEditor, Bestiary
  engine/   turn system, movement, combat, spells, mounts, pathfinding, enemy AI
  data/     creatures, spellbook, wizard and enemy rules, campaign runs
  ui/       viewport and counters renderer, wizard picker, campaign screens
  audio/    background music
public/
  created-maps/   the handcrafted levels (LevelNN.json, 32 × 32)
```

Key engine files:

- `engine/useTurnSystem.js`: the turn loop (portal timing, enemy turn, win and loss).
- `engine/enemyWizard*.js`, `enemyBreach.js`, `enemySiege.js`, `enemyCreatures.js`: the enemy AI.
- `ui/viewport.js` and `ui/counters.js`: map and counter drawing.

## Tuning

- **Turn limits:** `MAX_ROUNDS` and `PORTAL_TURN` in `engine/useTurnSystem.js`.
- **Creature stats:** `data/creatures.js` (the Bestiary reads from it).
- **Enemy wizard strength and Gift Box:** `data/enemyRules.js`.
- **Siege behaviour:** the `SIEGE` dials at the top of `engine/enemySiege.js`.
- **Developer extras:** the wizard picker has a dev panel for choosing the enemy level and a Classic Wizard test option.

## Credits

Inspired by *Lords of Chaos* by Julian Gollop (1990). All code, levels and wizards are original to this project.
