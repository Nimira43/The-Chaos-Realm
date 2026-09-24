# The Chaos Realm

A turn-based wizard strategy game (inspired by Chaos) built with React 19 + Vite, with a small Express server for saving maps.

## Conventions

- **Use UK English** wherever the code allows: names, comments, UI text and logs (`colour`, `defence`, `neighbour`, `centre`, `whilst`).
  Only use American spellings where an API or library forces it (e.g. CSS `color`, `textAlign: 'center'`).
- Match the existing style: no semicolons, single quotes, 2-space indentation, small pure helpers in `src/engine/*.js`.
- The owner likes to keep replaced code as commented-out `// Old Code` blocks. Don't delete those unless asked.
- Lint with `npx eslint src`. Build with `npx vite build`. There's no test suite; check logic with small Node scripts
  that import the engine modules directly (they're plain ES modules, apart from the `use*.js` React hooks).

## Commands

- `npm run dev`: runs the map server (`server/server.js`, `POST /save-map`) and the Vite client together
- `npm run client` / `npm run server`: run each one on its own

## Layout

- `src/pages/`: `Home`, `GameEngine` (the main game screen and its right-hand panel), `MapEditor`, `WizardEditor`
- `src/data/`: `creatures.js` (stats for every creature), `player.js` (`PLAYER`), `enemyWizard.js` (`ENEMY_WIZARD`), spellbooks, music
- `src/engine/`: game logic
  - `useGameEngine.js` wires all the state and hooks together
  - `useInput.js`: keyboard (arrow keys move the cursor or the selected unit, Space selects or deselects)
  - `useTurnSystem.js`: End Turn resets AP and runs the enemy wizard AI, the enemy creature AI and the environment tick
  - `enemyAI.js`: enemy wizard and enemy creature behaviour (pathing, attacking, casting, keys and doors, riding)
  - `combat.js`, `environmentEffects.js` (fire / blob / vine / flood), `pathfinding.js`, `terrain.js` (movement costs)
  - `items.js` + `useItemActions.js`: keys, apples, doors (Pick Up / Use / Open / Close)
  - `mounts.js` + `useMountActions.js`: riding mounts (Ride / Dismount)
  - `useMapLoader.js`: procedural maps and hand-crafted maps from `public/created-maps/LevelNN.json`
- `src/ui/viewport.js`: canvas rendering (15×15 tile viewport on a 32×32 wrapping map)

## Core model

- There are four layers, each a 2D array indexed as `[y][x]`: `terrainLayer` (strings), `objectLayer` (units), `effectLayer`, `itemLayer` (arrays of items).
- `PLAYER` and `ENEMY_WIZARD` are mutable singletons that hold the wizards' stats and position. Their object-layer cells are
  `{ type: 'player' }` and `{ type: 'enemyWizard', ref: ENEMY_WIZARD }`. Creature cells are `{ type: 'creature', owner, name, ap, current_health, stats, inventory }`.
- The map wraps: use `wrap()` and the `wrapped*Distance` helpers in `utils.js`.
- Creature tiles show `ident_code` from `creatures.js` (e.g. `TRO`).

## Mounts

- `ride_mounts: true` means the unit can ride. `mount: true` means it can be ridden.
- Riding puts the mount inside the rider's cell as `cell.mount = { name, owner, ap, current_health, stats, inventory }`. The tile shows
  the **rider** with an `R` badge, and the info panel shows e.g. "Troll riding Pegasus".
- Whilst mounted, the **mount's** AP and stats are used for movement and melee combat (`getMoverStats` / `getMoverAp` / `withMoverAp`).
  The rider's own AP pays for Ride / Dismount / item actions.
- If the mount is killed, a grounded rider survives on foot, but a rider on a flying mount dies from the fall.
- A mount flies when `mount: true` and `action_points_flying > 0`. Flying mounts use `action_points_flying` as their AP pool, and each tile costs
  `FLYING_MOVE_COST` whatever the terrain (walls and closed doors still block). They cross water, mountains, flood and lava unharmed.
- You can't dismount where the rider couldn't stand (e.g. over water or lava).

## Enemy AI and keys

- On each leg of its turn the enemy wizard picks up any keys underfoot, unlocks adjacent locked doors (using up a key) and opens unlocked ones, then moves again.
- If the portal can't be reached, it heads for a door it can get through, or else a key. With no portal open yet, it collects keys within sight.
- The enemy wizard and enemy creatures ride an adjacent friendly mount when they can.
