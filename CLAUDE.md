# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project overview

TTRPG overlay system for OBS streaming built with vanilla HTML/CSS/JS (no framework, no build step).
Three apps that communicate in real time over Ably, each split into separate HTML/CSS/JS files.

---

## Development

**No build step, no package manager, no test suite.**

- Open any `.html` directly in a browser (`file://`). Chrome is required (OBS browser sources use CEF).
- To test changes: save the file, hard-refresh (`Ctrl+Shift+R`).
- For Streamlabs OBS: serve over HTTP (`python -m http.server 8080`) — Streamlabs blocks WebSocket from `file://` origins. Standard OBS works fine with `file://`.

---

## Files

Each app is three files in the same directory:

| App | HTML | CSS | JS |
|---|---|---|---|
| Player panel | `Player/aria-player.html` | `Player/aria-player.css` | `Player/aria-player.js` |
| GM panel | `GM/aria-gm.html` | `GM/aria-gm.css` | `GM/aria-gm.js` |
| OBS overlay | `Overlay/aria-overlay.html` | `Overlay/aria-overlay.css` | `Overlay/aria-overlay.js` |

`aria-control-panel.html` and `aria-dice-roller.html` are **deprecated**.

---

## Architecture

### Communication — Ably (free tier)

All three apps share **one Ably key** and use three channels:

| Channel | Published by | Consumed by |
|---|---|---|
| `aria-rolls` | `aria-player` (per roll) | `aria-gm` (roll feed) + other `aria-player` instances (toast) + `aria-overlay` |
| `aria-cards` | `aria-player` or `aria-gm` | `aria-overlay` |
| `aria-damage` | `aria-gm` (damage/heal events) + `aria-player` (presence heartbeat every 5s) | `aria-player` (receives GM damage) + `aria-gm` (receives presence) |

### No server, no build

- State persisted in `localStorage` (character, config, cards, HP, monsters, potions)
- `sessionStorage` holds the per-tab `playerId` (UUID, regenerates per tab)

### Campaign system (GM)

The GM panel supports multiple campaigns. All campaign-scoped data uses keys suffixed with `currentCampaignId`:

| localStorage key | Content |
|---|---|
| `aria-gm-campaigns` | `[{ id, name }]` campaign list |
| `aria-gm-monsters-{id}` | monsters for campaign |
| `aria-gm-rolls-{id}` | roll history |
| `aria-gm-card-history-{id}` | card draw log |
| `aria-gm-potions-{id}` | alchemy recipes |

Helper functions `monstersKey()`, `rollsKey()`, `cardHistKey()`, `potionsKey()` return the scoped key for the active campaign. Always use these — never hardcode the bare key.

### Player identity

Player is identified by `character.name` from their character sheet — no manual ID input. This is used as `playerId` in roll and damage payloads.

### dddice 3D dice (browser SDK)

Loaded at runtime via dynamic `import('https://esm.sh/dddice-js')` — no npm, no build.

- **`ThreeDDice(canvas, apiKey)`** → `.start()` then `.connect(roomSlug)`
- A `<canvas id="dddice-canvas">` is positioned fixed/full-screen with `pointer-events:none` and high `z-index` in all three apps
- `RollFinished` event clears the canvas after 1.5s
- A 12s safety timer (`dddiceRollSafetyTimer`) forces fallback if the SDK stalls
- Overlay syncs Ably roll data with dddice animation via `pendingRollData`/`diceFinished` flags; if SDK is not configured, a 3s fixed delay is used instead
- `saveConfig()` always disconnects/removes resize listener before reinit to prevent accumulation

---

## ARIA game rules

- Roll **1d100** (simulated as two d10s via dddice: `d10x` tens + `d10` ones, total 0 = 100)
- **≤ threshold** = SUCCÈS, **> threshold** = ÉCHEC
- **SUCCÈS CRITIQUE**: roll ≤ 10 AND roll ≤ threshold
- **ÉCHEC CRITIQUE**: roll ≥ 91 AND roll > threshold
- Threshold calculation: Skill (`pct` + bonus/malus) | Stat (`multiplier × stat_value + bonus/malus`) | Free roll (manual)

### Combat reactions (parry & dodge)

Per `Docs/Aide aux combats.pdf`:
- **Parade**: rolls under **Combat rapproché** skill — once per turn, blocks attack, can still attack same turn
- **Esquive**: rolls under **Esquiver** skill — abandons all attacks, can dodge multiple times; ranged dodge has −20% malus

The combat sidebar auto-discovers these via regex: `/combat.rapproch/i` for parade, `/esquiv/i` for esquive.

### Special skill: Soigner
When a skill named exactly `Soigner` is rolled, `applySoigner(success)` fires after the float card (1500ms delay):
- **Success**: rolls `1d6`, heals self (capped at max PV), broadcasts presence
- **Failure**: rolls `1d3`, damages self (floored at 0), triggers damage VFX; shows MORT screen if HP hits 0

---

## Character data structure

### Multi-character system (Player)

The player panel supports multiple characters. On launch, a selection screen is shown (similar to the GM's campaign screen). Characters are stored as an array:

`localStorage: aria-characters` → `[{ id, name, class, stats, ... }]`

Each character carries its own `id` (UUID). HP and card state are keyed by that ID:

| localStorage key | Content |
|---|---|
| `aria-characters` | `[{ id, ...charFields }]` full character list |
| `aria-current-hp-{id}` | current HP integer for that character |
| `aria-cards-{id}` | card deck state for that character |
| `aria-player-tabs-{id}` | `{ cards: bool, alchemy: bool }` tab visibility |

Tab visibility is managed separately from the character object (not inside it) and is persisted per character ID. Both `cards` and `alchemy` tabs can be toggled by the GM via `tab-config` messages.

Helper functions `hpKey()` and `cardKey()` return the scoped key for the active character. Always use these — never hardcode the bare key.

### Character fields (`aria-characters[n]`)

```js
{
  id: string,                                // UUID, added by the multi-char system
  name: string,
  class: string,
  stats: { FOR, DEX, END, INT, CHA, PV },   // all integers
  physical: { age, taille, poids, yeux, cheveux, signes },
  inventory: [{ name, qty }],
  weapons: [{ nom, degats }, ...],           // always 3 slots; degats = dice formula
  protection: { nom, valeur },
  skills: [{ name, link, pct }],             // link = "FOR/DEX" etc
  specials: [{ name, desc, pct }],           // fully editable
  potions: [{ name, desc, ingredients, qty }],   // crafted stock
  potionRecipes: [{ id, name, desc, ingredients, chance }], // GM-granted recipes
  vials: number,                             // empty vial count for alchemy crafting
}
```

> `blessures` was removed — it is no longer part of the character schema.
> `tabs` was removed from the character object — it is now stored separately as `aria-player-tabs-{id}`.

### Config (`localStorage: aria-config`)
```js
{ dddiceKey, dddiceRoom, dddiceTheme, ablyKey, lightMode: bool }
```

### GM config (`localStorage: aria-gm-config`)
```js
{ dddiceKey, dddiceRoom, dddiceTheme, ablyKey, lightMode: bool }
```

### Monsters (`localStorage: aria-gm-monsters`)
```js
[{ id, name, pv, maxPV, armor, stats: { FOR, DEX, END, INT, CHA }, attacks: [{ name, pct, dmg }] }]
```

---

## Ably message payloads

### `aria-rolls` / `roll`
```js
{ skillName, threshold, roll, success, char, bonusMalus, playerId }
```
`threshold: null` for simple die rolls (d4, d6… buttons) — overlay treats these as display-only.

### `aria-damage` / `damage` | `heal`
```js
// damage
{ targetId, damage, hpBefore, hpAfter, maxHP, source: 'gm' }
// heal
{ targetId, amount, hpBefore, hpAfter, maxHP, source: 'gm' }
```

### `aria-damage` / `presence` (heartbeat every 5s)
```js
{ playerId, name, charClass, hp, maxHP, stats, protection, skills, specials, weapons, inventory, potions, vials, potionRecipeIds, ts }
```

### `aria-damage` / `tab-config`
```js
{ playerId, tabs: { cards: bool, alchemy: bool } }
```
GM sends this to enable/disable tabs on a specific player panel.

### `aria-damage` / `potion-grant`
```js
{ playerId, potion: { id, name, desc, ingredients, chance } }
```

### `aria-damage` / `vial-grant`
```js
{ playerId, qty: number }
```

### `aria-cards` / `draw` | `reshuffle`
```js
// draw
{ cardId, excluded: [...], drawn: [...], deckIds: [...], lastCardId }
// reshuffle
{ excluded: [...], drawn: [], deckIds: [...], lastCardId: null }
```

---

## Key UI components

### Player character selection screen
On launch, a selection screen lists all saved characters (stored in `aria-characters`). Players can create, select, or delete characters. Selecting one calls `selectCharacter(id)` → `loadCharacterState(id)` → `initApp()`. `switchCharacter()` returns to this screen, tearing down Ably and dddice connections cleanly before re-init.

### Player panel tabs
`Compétences` | `Caractéristiques` | `Jet libre` | `Cartes` | `⚗ Alchimie` | `Personnage`

`Cartes` and `⚗ Alchimie` tabs are hidden by default — only shown when GM enables them via `tab-config`.

### GM panel tabs
`Joueurs` | `Monstres` | `Jets` | `Jet MJ` | `Cartes` | `⚗ Alchimie`

### Bonus/Malus bar
Persistent bar between topbar and content. Buttons: +10/+20/+30/−10/−20/−30 + custom ± + reset. Applied to all rolls.

### HP panel (player sidebar)
- Read-only on player side — HP is controlled by GM only
- Animated HP bar with ghost drain on damage
- GM sends damage/heal via Ably → VFX on player (screen shake, blood particles, vignette, damage number)
- MORT screen at 0 HP

### Combat sidebar (player)
- Weapons (clickable if damage formula present — rolls and broadcasts to GM)
- Protection
- Reaction buttons: 🛡 Parade (Combat rapproché) and ⚡ Esquive — appear automatically when those skills exist

### Player presence (GM — Joueurs tab)
- Players send heartbeat every 5s on `aria-damage` channel
- GM sweeps offline players every 10s (threshold: 30s = offline)
- Each player card has: HP bar, stats, ⚔ damage input, ♥ heal input, 📋 details button (top-right of card header)
- 📋 opens a full modal with all character data: stats, weapons, skills, specials, inventory, potions (with ingredients)
- GM can toggle per-player tabs (`Cartes`, `⚗ Alchimie`) from the modal — sends `tab-config` message on `aria-damage`

### GM Alchemy tab
- GM manages a list of potion recipes scoped to the current campaign (`gmPotions`, key: `aria-gm-potions-{campaignId}`)
- Each recipe: name, desc, ingredients, success %
- GM grants a recipe to a player via `potion-grant` message on `aria-damage` — only shown in the modal if the player has `tabs.alchemy` enabled and there are recipes

### Alchemy tab (player)
- **Recipes** (`character.potionRecipes`): GM-granted recipes with name, desc, ingredients, success %. Player cannot add these directly.
- **Crafting**: `Créer` button triggers a d100 roll via `doRoll()` with `skipBM=true`. Uses `pendingCraft` flag (same pattern as `applySoigner`) — set before the roll, read in `handleResult()`, cleared immediately. A vial is always consumed regardless of outcome. Crafting disabled if 0 vials.
- **Potions in stock** (`character.potions`): successfully crafted potions. `Utiliser` decrements qty and shows toast.
- **Vials** (`character.vials`): integer. Shown with +/− in both the Alchemy tab and the Inventory tab (`#inv-vials-section`). Players can manually adjust their own count.

### Card system
- 54-card French deck: ♠ ♣ ♥ ♦ + 2 Jokers
- Player and GM have **independent decks** (separate localStorage keys: `aria-cards` / `aria-gm-cards`)
- Re-including an excluded card adds it back into the available deck count

### Roll result float card
- Variants: success / fail / crit-success / crit-fail
- Crits: glow + particle burst, auto-dismiss after 8s (normal: 5s)
- Overlay waits for dddice `RollFinished` before showing result (or 3s fixed delay if SDK not configured)

### GM roll result
- Monster attack: result strip appears above monsters grid (not in the Jet MJ tab)
- On success: rolls damage formula and shows breakdown inline

---

## CSS design system

```css
--gold: #c9a84c          /* primary accent */
--gold-light: #e8c97a
--gold-dim: #6b5020
--bg: #111009            /* darkest background */
--bg2: #1a1610
--bg3: #221e14
--parchment: #f0e6c8     /* primary text */
--parchment-dim: #9e8e6a
--success: #4caf77
--fail: #c0392b
--border: rgba(201,168,76,0.15)
--radius: 4px
--gm-accent: #7b3fa0     /* GM purple (gm file only) */
```

**Fonts:** Cinzel (headings/numbers), EB Garamond (body/italic), Cinzel Decorative (title), Playfair Display (roll card skill name)

**Color identity:**
- Player panel: warm gold topbar + gold badge "Joueur"
- GM panel: deep crimson/purple topbar + purple badge "Maître de Jeu"

---

## Conventions

- **No frameworks** — pure vanilla JS, no npm, no bundler
- **No `type="number"` spinners** — use `type="text" inputmode="numeric"` with `oninput` regex filter
  - Numeric only: `oninput="this.value=this.value.replace(/[^0-9]/g,'')"`
  - Allows minus (BM input): `oninput="this.value=this.value.replace(/[^0-9-]/g,'').replace(/(?!^)-/g,'')"`
- **No `display:none` for layout-shifting elements** — use `visibility:hidden/visible`
- **No external state server** — Ably free tier only
- **Each app = 3 files** — logic in `.js`, styles in `.css`, structure in `.html`
- When providing updates, **provide only changed files**

---

## Known pitfalls

### `element.className = ''` strips base CSS classes
Always reset to the base class string, not `''`:
```js
// Wrong — breaks all CSS targeting .float-roll-card
card.className = '';
// Correct
card.className = 'float-roll-card';
```

### dddice resize listener accumulation
Store the handler reference and call `removeEventListener` before re-registering (done in `saveConfig()`). Same pattern in all three apps.

### dddice init order
Must call `.start()` before `.connect()`. The safety timer must be cleared inside `RollFinished`, not after `await sdk.roll()` (which resolves ~200ms after the API call, long before the animation ends).

### Post-roll effect pattern
Skills with side-effects after a roll (e.g. `Soigner`, crafting) use a flag set before `doRoll()` and checked at the top of `handleResult()`:
```js
// Before roll:
pendingCraft = recipeIdx;   // or pendingSoigner = true
doRoll(skillName, pct, /*skipBM=*/true);

// In handleResult(success, roll, threshold, skillName):
if (pendingCraft !== null) { applyCraft(success, pendingCraft); pendingCraft = null; }
if (pendingSoigner)        { applySoigner(success); pendingSoigner = false; }
```
`applyCraft` / `applySoigner` use a 1500ms `setTimeout` so the float card shows before the effect fires.

### Light mode
Toggled via `config.lightMode` (both player and GM). Applied by adding `body.light-mode` class. **Applied at module level** (not inside `initApp`) to prevent a flash on load:
```js
if (config.lightMode) document.body.classList.add('light-mode');
```
All light-mode overrides live in a `body.light-mode` block at the bottom of each CSS file. **Never hardcode dark colors** in new CSS rules — always use CSS variables so light mode overrides work automatically.

---

## OBS setup

```
file:///PATH/Overlay/aria-overlay.html?mode=player&ably=KEY&dddice_key=KEY&dddice_room=SLUG
file:///PATH/Overlay/aria-overlay.html?mode=gm&ably=KEY&dddice_key=KEY&dddice_room=SLUG
```

Browser source size: 1920×1080, transparent background.
