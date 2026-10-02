# The Chaos Realm

A turn-based tactical strategy game built in React, inspired by Julian Gollop's
*Lords of Chaos* (ZX Spectrum, 1990, and its spiritual predecessor *Chaos:
The Battle of Wizards*, 1985).

You play a wizard, facing off against an enemy wizard on a wrapping, toroidal
32×32 battlefield. Summon creatures, cast environment and offensive magic,
scavenge loot, and reach the Portal before your opponent does — or dies
trying to stop you.

> This README is a snapshot compiled from the project's development history.
> It documents what's been built and designed so far; see **Roadmap** below
> for what's planned but not yet implemented.

---

## Current status

The core single-level game loop is **feature-complete**: movement, combat,
magic, mounts and flight, items and doors, loot and scoring, and the
win/loss conditions are all built, tested, and playable end to end. **35 of
a planned 50 handcrafted campaign levels exist.**

The one major system still ahead is a genuine overhaul of the **enemy
wizard's AI** — see Roadmap.

---

## Getting started

**Tech stack:** [Vite](https://vite.dev/) + React 19 + react-router-dom 7
on the client; a small [Express](https://expressjs.com/) 5 backend
(`server/server.js`), used solely so the Map Editor can save handcrafted
maps to disk.

```bash
npm install

# Run both the Vite dev server and the map-save backend together:
npm run dev

# ...or run either on its own:
npm run client    # Vite dev server only
npm run server    # Express backend only (port 5000)

# Production:
npm run build
npm run preview
```

`npm run dev` uses `concurrently` to start both processes together — you
need the backend running (even just for local dev) for the Map Editor's
Save button to work; the game itself (Home, GameEngine, WizardEditor) runs
fine on the client alone.

---

## Gameplay features

### The board

- 32×32 tile grid, wraps at every edge (a unit walking off the west side
  reappears on the east, and so on — all distance/pathfinding math accounts
  for this).
- Fifteen terrain types, including `grass`, `rough`, `rock`, `swamp`,
  `water`, `forest`, `wall`, `road`, `floor`, `mountain`, `lava`,
  `wasteland`, and three door states (`doorLocked`, `doorUnlocked`,
  `doorOpen`).
- Maps can be hand-crafted in a dedicated **Map Editor**, or generated
  procedurally.
- The **Portal** (the win condition) appears at turn 20 of a 30-turn match,
  either at a pre-placed spot on a handcrafted map or a random valid tile on
  a generated one. First wizard to stand on it wins; if the enemy wizard
  gets there first, or turn 30 arrives with neither wizard on it, you lose.

### Combat

- Melee, with an undead-immunity rule (only undead attackers, or a carried
  **magic weapon**, can harm undead creatures).
- A grounded attacker can never reach an airborne target; a flying attacker
  can still strike the ground.
- **Magic Bolt** and **Magic Lightning** — short-range offensive spells
  (range = spell level). Bolt hits one tile; Lightning hits a fixed 3×3
  area, including friendly units caught in the blast. Damage scales with
  spell level and is reduced by the target's `magic_resistance`.
- A **Shoot** action (carried bow) and a **Throw** action (carried
  knife/spear/axe) — both player-wizard only for now. A thrown weapon uses
  the thrower's own base combat plus that specific weapon's `thrown_combat`
  stat (never other carried gear), and lands on the ground at the target
  tile afterward, recoverable.

### Magic

- **Creature-summoning spells** — one per creature in the bestiary (see
  below), each with its own mana cost and spell level (which doubles as
  "how many times can I cast this before recharging").
- **Environment spells**, forming a deliberate four-way rock-paper-scissors
  cycle:
  - **Magic Fire** — spreads, burns terrain to wasteland, destroys Tangle
    Vine.
  - **Gooey Blob** — spreads, destroys Flood, can be melee-attacked down.
  - **Tangle Vine** — static/permanent, destroys Gooey Blob, can be
    melee-attacked down, burns to Magic Fire.
  - **Flood** — static/permanent, destroys Magic Fire, can *only* be
    destroyed by Gooey Blob, blocks everyone except water-type units, and
    will drown anyone trapped against it for two consecutive turns with no
    escape route.
- **Healing Potion** — found via Apples (see Items), heals the caster or an
  adjacent creature to full.

### Mounts & flight

- Any wizard/creature with `ride_mounts: true` can mount an adjacent,
  unridden creature with `mount: true` (Sea Wolf, Cindermaw, Thornhart,
  Pegasus, Gryphon, Giant Eagle).
- While mounted, the **mount's** AP and combat stats govern movement and
  fighting — not the rider's. If the mount dies on the ground, it dies and
  the rider survives on the same tile; if it dies while flying, both are
  lost.
- Any creature with a nonzero `action_points_flying` stat can fly on its
  own, mount or not — a Vampire or Manticore can take to the air just as
  Pegasus can, via a **Fly**/**Land** toggle. Flying ignores terrain cost
  (flat AP per tile) and lava, and can cross walls and closed doors — but
  can never *land* on `floor` terrain, which keeps locked doors guarding a
  floored room genuinely secure.

### Items, keys & doors

- **Keys** unlock `doorLocked` tiles; **Pick Up**, **Use**, **Open**, and
  **Close** are all AP-costed actions, gated by `use_options`.
- **Apples** convert instantly into a Healing Potion charge.
- **Treasure** (gold coins and four gem types — Ruby, Diamond, Emerald,
  Sapphire) converts instantly into score.
- **Weapons** (sword, knife, shield, bow, spear, club, axe — each with a
  "magic" variant) are carried, not consumed, and their combat/defence
  bonuses apply the instant they're picked up — there's no separate "equip"
  step. A magic weapon lets its carrier bypass undead immunity while held.
  Dropping a weapon instantly removes its bonus and frees its carry weight.
- All random pickups are scattered once per level on walkable, non-hazard
  terrain, away from units.

### Scoring

- A running score tracked per level, earned from kills (by the player, a
  player creature, or a player-cast spell/effect) and from treasure
  pickups. **This score has no effect on win/loss** — the only way to win
  is still reaching the Portal. Score exists purely to fund future spell
  purchases between levels (see Roadmap).

---

## Bestiary highlights

Alongside the classic *Chaos*-lineage roster (dragons, Pixie, Dwarf, Goblin,
Orc, Troll, Centaur, Unicorn, undead, etc.), a few creatures were designed
specifically for this project:

- **Cindermaw** — a lava-dwelling mount, immune to lava damage (but *not*
  to Magic Fire).
- **Sea Wolf** — a water-type mount.
- **Thornhart** — a forest-dwelling stag mount, the best pure ground-AP
  mount in the game, filling the one terrain niche (`wood_type`) nothing
  else covered.
- **Giant Eagle** — a flying mount, statted deliberately between Pegasus
  and Gryphon.

Several originally real-world-animal creatures were renamed to fictional
equivalents for thematic consistency: Gorilla → **Yeti**, Crocodile →
**Cipactli** (an Aztec sea-monster), Lion → **Chimera**, Elephant →
**Mammoth**, Bear → **Ogre**.

---

## Project structure

```
src/
  data/       Game data — player.js, enemyWizard.js, enemyWizardNames.js, creatures.js, weapons.js,
              spellbook.js, enemySpellbook.js, musicTracks.js
  engine/     Game logic — combat, movement, pathfinding, turns, mounts,
              items, environment effects, spellcasting, map generation,
              and the enemy AI (split across enemyAI.js, enemyAIShared.js,
              enemyWizardMovement.js, enemyWizardSpells.js, enemyCreatures.js)
  ui/         Canvas rendering (viewport.js) and its render-loop hook
  pages/      Home, GameEngine, MapEditor, WizardEditor
  audio/      Background music player
```

The engine is built around three parallel 2D grids kept in sync each
turn — a `terrainLayer`, an `objectLayer` (units), and an `effectLayer`
(Fire/Blob/Vine/Flood) — plus an `itemLayer` for ground pickups.

### Backend: the map-save server

`server/server.js` is deliberately minimal — one endpoint, used only by the
Map Editor:

- **`POST /save-map`** — body `{ name, data }`. Writes `data` as
  pretty-printed JSON to `public/created-maps/<name>.json` (creating the
  `created-maps` folder on first use). Responds `{ success: true, path }`,
  or a 400/500 with an `{ error }` message.

Loading a saved map back is handled entirely client-side — the game engine
fetches `/created-maps/<name>.json` as a static file. The backend is only
ever involved in *writing*, never reading.

### Handcrafted map format

A saved map is a 32×32 array of arrays of strings — each inner array is one
row, each string either an ordinary terrain type (`"grass"`, `"water"`,
`"forest"`, `"wall"`, `"road"`, `"floor"`, etc.) or one of a small set of
spawn markers the loader resolves separately from plain terrain:

- `"playerWizard"` / `"enemyWizard"` — starting positions.
- `"key"` — spawns a pickable key on that tile.
- `"portal"` — fixes the win-condition tile's position for that map
  (otherwise the engine places it on a random valid tile at turn 20).

A marker tile doesn't store its own underlying terrain explicitly — once
the rest of the map has loaded, it's inferred from whichever terrain type
is most common among that tile's immediate neighbours, so a key dropped in
the middle of a forest renders as forest underneath it, not a default.

`Level15.json` is a good real example of this in practice: a
forest-and-water map with a small walled keep (three `key` tiles guarding
a `portal` behind `wall` tiles), a `road` causeway, and both wizards'
`playerWizard`/`enemyWizard` start markers.

---

## Roadmap

### Next up: Enemy Wizard AI overhaul

The current enemy wizard AI is functional but simple — it paths toward the
player or the Portal, picks up keys, works doors, and casts a semi-random
spell from whatever it can afford. A full rebuild is planned around four
explicit priorities:

1. **Reach the Portal.**
2. **Target the player and build an army** — summon the strongest
   affordable creature (by `combat` stat, with a bonus for `use_options`
   scavengers and for creatures suited to the surrounding terrain — flying
   mounts for mountains, water-type for water, Thornhart for forest,
   Cindermaw for lava).
3. **Actively seek keys, loot, and weapons** (15-tile search radius) — not
   just opportunistically, but as a standing goal.
4. Only ever "wander" as an absolute last resort — the wizard should always
   be doing one of the above.

A new **threat-response** system will replace the current simple rule:
at the start of its turn, the wizard sums the `combat` stat of every
player-side unit within a 2-tile radius. Below ~60, it carries on normally;
between ~60–120, it switches to ranged/area spells, its bow, or thrown
weapons; above ~120, it's meant to retreat (this specific "flee" behaviour
has been deferred — there's no retreat-movement code yet).

The same expanded pickup/weapon/mount logic currently exclusive to the
player will be extended to the enemy wizard (its creatures get pickup,
mounting, and basic item use, but **not** Shoot/Throw, which stay
wizard-only on both sides).

### Future: Game modes & meta-progression

A full design has been planned (not yet built) for how levels are selected
and played across a whole campaign, built around **wizard templates and
clones**:

- **Wizard Designer** *(future)* lets you build a named wizard template
  with a one-off 400-point spell budget.
- Starting a campaign clones that template into a **named save** (e.g.
  *"BertsFirstFullCampaign"*), which then tracks its own score and spell
  progress independently, forever separate from the template and from any
  other save made from it.
- **Full Campaign** (the fixed 50-level sequence), **Randomised Mode**
  (a random sample of N levels), and **Selected Mode** (hand-picked levels)
  are all the same underlying "campaign runner," differing only in how the
  level list is produced. Each shows a **Next Level / Buy Spells** choice
  after every win.
- **Single Level** and **Generated Mode** are lighter, standalone
  variants — Single Level clones a template for one session only, with
  nothing saved afterward.
- **Loot Mode** — unlocked per-save only after that save's first level is
  won. One generated map, a flat 100 AP budget (independent of the chosen
  wizard's own stats), no enemy, no spells, no timer — just jewels and
  coins (doubled from their normal roll) to grab before AP runs out or you
  choose to **Bank** early. Whatever's collected tops up that save's score.
- **Two Player Mode** was considered and explicitly dropped — the engine's
  player/enemy-wizard split runs too deep to make symmetric without a
  dedicated redesign effort.

### Other deferred items

- A genuine retreat/flee movement mode for threatened units.
- Thrown weapons' adjacency to a real "attack of opportunity" or ranged
  counter-fire system — not currently planned, just noted as a natural
  extension.
- Give/Trade actions between adjacent units (so a creature that picks up a
  bow could hand it to the wizard, rather than keep it as a backup melee
  weapon).

---
