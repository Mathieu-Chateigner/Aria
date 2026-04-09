# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project overview

TTRPG overlay system for OBS streaming built with vanilla HTML/CSS/JS (no framework, no build step).
Three apps that communicate in real time over Ably, each split into separate HTML/CSS/JS files.

Live at: `https://mathieu-chateigner.github.io/Aria/`

---

## Workflow

### Commits
**Never commit or push.** The user commits and pushes manually.

After every set of changes, update the `commits` file at the repo root with a plain-text summary of what was changed and why. Overwrite the previous content — it only needs to describe the most recent batch of changes, not a full history. No markdown — plain text only. Format:

```
type: short summary line (this becomes the GitHub commit title)

Changes:

- file : what changed and why
```

Common types: `feat`, `fix`, `docs`, `refactor`, `style`. The first line is what appears on GitHub — keep it concise and meaningful.

Always update `commits` as the last step of any task.

---

## Development

**No build step, no package manager, no test suite.**

- Open any `.html` directly in a browser (`file://`). Chrome is required (OBS browser sources use CEF).
- To test changes: save the file, hard-refresh (`Ctrl+Shift+R`).
- For Streamlabs OBS: serve over HTTP (`python -m http.server 8080`) — Streamlabs blocks WebSocket from `file://` origins. Standard OBS works fine with `file://`.

---

## Files

```
index.html              ← Home/selection screen + shared config panel
views/
  aria-player.html
  aria-gm.html
  aria-overlay.html
css/
  aria-player.css
  aria-gm.css
  aria-overlay.css
js/
  aria-player.js
  aria-gm.js
  aria-overlay.js
```

`aria-control-panel.html` and `aria-dice-roller.html` are **deprecated**.

---

## Architecture

### Communication — Ably (free tier)

All three apps share **one Ably key** (entered on `index.html`) and use three channels:

| Channel | Published by | Consumed by |
|---|---|---|
| `aria-rolls` | `aria-player` (per roll) | `aria-gm` (roll feed) + other `aria-player` instances (toast) + `aria-overlay` |
| `aria-cards` | `aria-player` or `aria-gm` | `aria-overlay` |
| `aria-damage` | `aria-gm` (damage/heal events) + `aria-player` (presence heartbeat every 5s) | `aria-player` (receives GM damage) + `aria-gm` (receives presence) |

### Save key / Supabase sync

Both player and GM use a **save key** (UUID) to sync localStorage to Supabase, enabling multi-device access.

- On page load, `#file-gateway` starts `display:none`. `tryRestoreSupabase()` checks `localStorage('aria-save-key')`:
  - Key found → calls `loadFromSupabase()` then `hideGateway()` + `showSelectionScreen()` (no flash)
  - No key → calls `showGateway()` which sets `display:flex`, prompting the user to create or enter a key
- `saveKey` is stored in `localStorage('aria-save-key')` and also held in the module-level `saveKey` variable
- Sync is debounced (`debouncedSync()` → 800ms → `syncToSupabase()`) to avoid hammering the API
- **Never set `#file-gateway` to `display:flex` in HTML** — it must start hidden to avoid the flash on load

### No server, no build

- State persisted in `localStorage` (character, config, cards, HP, monsters, potions)
- `sessionStorage` holds the per-tab `playerId` (UUID, regenerates per tab)

### Config — shared between player and GM

Both apps read from the **same** key:

```js
// localStorage: aria-config
{ ablyKey, dddiceKey, dddiceRoom, dddiceTheme, lightMode: bool }
```

Keys are entered once on `index.html`. The in-app ⚙ modal in each panel can also update this key (for theme and reconnecting), but uses the same `aria-config` storage. **Never use `aria-gm-config`** — it is obsolete.

### Campaign system (GM)

The GM panel supports multiple campaigns. Each campaign has a **join code** (5-char, e.g. `X7K2M`) that players enter to link their character. Only players whose `campaignKey` matches the active campaign's `joinCode` appear in the Joueurs tab.

All campaign-scoped data uses keys suffixed with `currentCampaignId`:

| localStorage key | Content |
|---|---|
| `aria-gm-campaigns` | `[{ id, name, joinCode }]` campaign list |
| `aria-gm-monsters-{id}` | monsters for campaign |
| `aria-gm-rolls-{id}` | roll history |
| `aria-gm-card-history-{id}` | card draw log |
| `aria-gm-potions-{id}` | alchemy recipes |

Helper functions `monstersKey()`, `rollsKey()`, `cardHistKey()`, `potionsKey()` return the scoped key for the active campaign. Always use these — never hardcode the bare key.

`generateJoinCode()` produces the join code. If a campaign loaded from storage lacks one, it is generated and saved on `loadCampaignState()`.

### Player identity

Player is identified by `character.name` from their character sheet. This is used as `playerId` in roll and damage payloads.

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

`localStorage: aria-characters` → `[{ id, name, class, stats, ... }]`

Each character carries its own `id` (UUID). HP and card state are keyed by that ID:

| localStorage key | Content |
|---|---|
| `aria-characters` | `[{ id, ...charFields }]` full character list |
| `aria-current-hp-{id}` | current HP integer for that character |
| `aria-cards-{id}` | card deck state for that character |
| `aria-player-tabs-{id}` | `{ cards: bool, alchemy: bool }` tab visibility |

Tab visibility is managed separately from the character object and persisted per character ID. Helper functions `hpKey()` and `cardKey()` return the scoped key for the active character. Always use these — never hardcode the bare key.

The **empty vials counter** in the Inventaire tab (`#inv-vials-section`) is only rendered when `playerTabs.alchemy === true`. `renderVialsInInventory()` checks this and empties the section if alchemy is not granted. `applyTabVisibility()` calls `renderVialsInInventory()` so the inventory updates immediately when the GM toggles the alchemy tab.

### Character fields (`aria-characters[n]`)

```js
{
  id: string,                                // UUID
  name: string,
  class: string,
  campaignKey: string,                       // join code of the linked campaign (e.g. 'X7K2M')
  stats: { FOR, DEX, END, INT, CHA, PV },   // all integers
  physical: { age, taille, poids, yeux, cheveux, signes },
  inventory: [{ name, qty }],
  weapons: [{ nom, degats }, ...],           // always 3 slots; degats = dice formula
  protection: { nom, valeur },
  skills: [{ name, link, pct }],             // link = "FOR/DEX" etc
  specials: [{ name, desc, pct }],           // fully editable
  potions: [{ name, desc, ingredients, qty }],
  potionRecipes: [{ id, name, desc, ingredients, chance }],
  vials: number,
}
```

> `blessures` was removed. `tabs` was removed from the character object — stored separately as `aria-player-tabs-{id}`.

### Monsters (`localStorage: aria-gm-monsters-{id}`)
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
{ targetId, damage, hpBefore, hpAfter, maxHP, source: 'gm' }
{ targetId, amount, hpBefore, hpAfter, maxHP, source: 'gm' }
```

### `aria-damage` / `presence` (heartbeat every 5s)
```js
{ playerId, charId, name, charClass, hp, maxHP, stats, protection, skills, specials,
  weapons, inventory, potions, vials, potionRecipeIds, tabs, campaignKey, ts }
```
- `playerId` — session UUID (sessionStorage, changes per tab/refresh); used only for Ably targeting
- `charId` — character UUID (stable; never changes even if name changes); used as the key in the GM `players` Map

The GM filters incoming presence by `campaignKey === currentJoinCode` — messages with a non-matching key are ignored entirely.

### `aria-damage` / `tab-config`
```js
{ playerId, tabs: { cards: bool, alchemy: bool } }
```

### `aria-damage` / `potion-grant` | `vial-grant`
```js
{ playerId, potion: { id, name, desc, ingredients, chance } }
{ playerId, qty: number }
```

### `aria-cards` / `draw` | `reshuffle`
```js
{ cardId, excluded: [...], drawn: [...], deckIds: [...], lastCardId }
{ excluded: [...], drawn: [], deckIds: [...], lastCardId: null }
```

---

## Key UI components

### Home screen (`index.html`)
Displays Joueur / Maître de Jeu cards and a **⚙ Configuration** panel at the bottom. Reads and writes `aria-config` via inline `<script>`. This is the canonical entry point for key configuration.

### Player character selection screen
Lists all saved characters. Creating a character prompts for name, class, and an optional campaign join code. The join code is shown as a badge on each character card. `selectCharacter(id)` → `loadCharacterState(id)` → `initApp()`. `switchCharacter()` tears down Ably and dddice before returning.

### GM campaign selection screen
Lists all campaigns, each showing its join code (click to copy). `selectCampaign(id)` → `loadCampaignState(id)` → `initApp()`. After entering a campaign, the join code is shown in the topbar (click to copy) so the GM can share it with players.

### Player panel tabs
`Compétences` | `Caractéristiques` | `Jet libre` | `Inventaire` | `Notes` | `Cartes` | `⚗ Alchimie` | `Personnage`

`Cartes` and `⚗ Alchimie` are hidden by default — shown only when GM enables them via `tab-config`.

### GM panel tabs
`Joueurs` | `Monstres` | `Jets` | `Jet MJ` | `Cartes` | `⚗ Alchimie`

### Bonus/Malus bar
Persistent bar between topbar and content. Buttons: +10/+20/+30/−10/−20/−30 + custom ± + reset. Applied to all rolls.

### Player presence (GM — Joueurs tab)
- Players send heartbeat every 5s on `aria-damage` channel
- GM's `handlePresence()` rejects any message where `campaignKey !== currentJoinCode`
- GM sweeps offline players every 10s (threshold: 30s = offline)
- 📋 modal shows full character data and tab toggles

### Post-roll effect pattern
Skills with side-effects after a roll use a flag set before `doRoll()` and checked at the top of `handleResult()`:
```js
pendingCraft = recipeIdx;   // or pendingSoigner = true
doRoll(skillName, pct, /*skipBM=*/true);

// In handleResult():
if (pendingCraft !== null) { applyCraft(success, pendingCraft); pendingCraft = null; }
if (pendingSoigner)        { applySoigner(success); pendingSoigner = false; }
```
`applyCraft` / `applySoigner` use a 1500ms `setTimeout` so the float card shows before the effect fires.

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

**Light mode:** Toggled via `config.lightMode`. Applied at module level (before `initApp`) to prevent flash. All overrides live in a `body.light-mode` block at the bottom of each CSS file. Always use CSS variables — never hardcode dark colors.

---

## Conventions

- **No frameworks** — pure vanilla JS, no npm, no bundler
- **No `type="number"` spinners** — use `type="text" inputmode="numeric"` with `oninput` regex filter
  - Numeric only: `oninput="this.value=this.value.replace(/[^0-9]/g,'')"`
  - Allows minus: `oninput="this.value=this.value.replace(/[^0-9-]/g,'').replace(/(?!^)-/g,'')"`
- **No `display:none` for layout-shifting elements** — use `visibility:hidden/visible`
- **Each app = 3 files** — logic in `.js`, styles in `.css`, structure in `.html`

---

## Known pitfalls

### `element.className = ''` strips base CSS classes
Always reset to the base class string, not `''`:
```js
card.className = 'float-roll-card'; // not ''
```

### dddice resize listener accumulation
Store the handler reference and call `removeEventListener` before re-registering (done in `saveConfig()`).

### dddice init order
Must call `.start()` before `.connect()`. The safety timer must be cleared inside `RollFinished`, not after `await sdk.roll()`.

### Campaign join code filtering
`handlePresence()` in `aria-gm.js` early-returns if `data.campaignKey !== currentJoinCode`. When `currentJoinCode` is `null` (e.g. during init), no filtering is applied — all presence messages are accepted.

---

## OBS setup

```
https://mathieu-chateigner.github.io/Aria/views/aria-overlay.html?mode=player&ably=KEY&dddice_key=KEY&dddice_room=SLUG
https://mathieu-chateigner.github.io/Aria/views/aria-overlay.html?mode=gm&ably=KEY&dddice_key=KEY&dddice_room=SLUG
```

Browser source size: 1920×1080, transparent background.
