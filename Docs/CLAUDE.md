# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# ARIA — CLAUDE.md

## Project overview

TTRPG overlay system for OBS streaming built with vanilla HTML/CSS/JS (no framework, no build step).
Three apps that communicate in real time over Ably, each split into separate HTML/CSS/JS files.

---

## Files

Each app is split into three files that must stay in the same directory (paths are relative):

| App | HTML | CSS | JS |
|---|---|---|---|
| Player panel | `aria-player.html` | `aria-player.css` | `aria-player.js` |
| GM panel | `aria-gm.html` | `aria-gm.css` | `aria-gm.js` |
| OBS overlay | `aria-overlay.html` | `aria-overlay.css` | `aria-overlay.js` |

**Player panel** — character sheet, dice rolls, card draws. Open in browser on player's PC.
**GM panel** — player cards, monster manager, roll feed, GM rolls, card draws.
**OBS overlay** — displays roll results, drawn cards, damage animations.

> `aria-control-panel.html` and `aria-dice-roller.html` are **deprecated** — superseded by the player/gm split.

---

## Architecture

### Communication — Ably (free tier)
All three files share **one Ably key** and use three channels:

| Channel | Published by | Consumed by |
|---|---|---|
| `aria-rolls` | `aria-player` (per roll) | `aria-gm` (roll feed) + other `aria-player` instances (toast) + `aria-overlay` |
| `aria-cards` | `aria-player` or `aria-gm` | `aria-overlay` |
| `aria-damage` | `aria-gm` (damage/heal events) + `aria-player` (presence heartbeat) | `aria-player` (receives GM damage) + `aria-gm` (receives presence) |

### No server, no build
- Everything runs as `file://` locally or from any static host
- State persisted in `localStorage` (character, config, cards, HP, monsters)
- `sessionStorage` not used (splash screen removed)

### Player identity
Player is identified by `character.name` from their saved character sheet — **no manual ID input**.
This is used as `playerId` in roll and damage payloads so the GM can target the right player.

---

## ARIA game rules

- Roll **1d100** (simulated as two d10s via dddice: `d10x` tens + `d10` ones, total 0 = 100)
- **≤ threshold** = SUCCÈS, **> threshold** = ÉCHEC
- **SUCCÈS CRITIQUE**: roll ≤ 10 AND roll ≤ threshold (true success)
- **ÉCHEC CRITIQUE**: roll ≥ 91 AND roll > threshold (true failure)
- Threshold calculation:
  - Skill: stored `pct` value + bonus/malus
  - Stat: `multiplier × stat_value + bonus/malus` (multiplier 1–5)
  - Free roll: manual input

---

## Character data structure (`localStorage: aria-character`)

```js
{
  name: string,
  class: string,
  stats: { FOR, DEX, END, INT, CHA, PV },   // all integers
  physical: { age, taille, poids, yeux, cheveux, signes },
  inventory: [{ name, qty }],
  weapons: [{ nom, degats }, { nom, degats }, { nom, degats }],  // always 3 slots
  protection: { nom, valeur },
  blessures: { current, max },
  skills: [{ name, link, pct }],             // link = "FOR/DEX" etc, fixed names
  specials: [{ name, desc, pct }]            // fully editable
}
```

### Config (`localStorage: aria-config`)
```js
{ dddiceKey, dddiceRoom, dddiceTheme, ablyKey }
```

### GM config (`localStorage: aria-gm-config`)
```js
{ ablyKey }
```

### Monsters (`localStorage: aria-gm-monsters`)
```js
[{
  id: timestamp,
  name: string,
  pv: number,          // current HP
  maxPV: number,
  armor: number,
  stats: { FOR, DEX, END, INT, CHA },
  attacks: [{ name, pct, dmg }]
}]
```

---

## Ably message payloads

### `aria-rolls` / `roll`
```js
{ skillName, threshold, roll, success, char, bonusMalus, playerId }
```

### `aria-damage` / `damage`
```js
{ targetId, damage, hpBefore, hpAfter, maxHP, source: 'gm' }
```

### `aria-damage` / `heal`
```js
{ targetId, amount, hpBefore, hpAfter, maxHP, source: 'gm' }
```

### `aria-damage` / `presence` (heartbeat every 5s)
```js
{ playerId, name, charClass, hp, maxHP, stats, ts }
```

### `aria-cards` / `draw`
```js
{ cardId, excluded: [...], drawn: [...], deckIds: [...], lastCardId }
```

### `aria-cards` / `reshuffle`
```js
{ excluded: [...], drawn: [], deckIds: [...], lastCardId: null }
```

---

## dddice integration

- REST API only (no SDK)
- d100 = two dice: `d10x` (tens) + `d10` (units) — total_value 0 treated as 100
- Room slug extracted from full URL or plain slug
- Fallback: `Math.random()` if API unavailable or unconfigured

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

## Key UI components

### Player panel tabs
`Compétences` | `Caractéristiques` | `Jet libre` | `Cartes` | `Personnage`

### GM panel tabs
`Joueurs` | `Monstres` | `Jets` | `Jet MJ` | `Cartes`

### Bonus/Malus bar
Persistent horizontal bar between topbar and content. Buttons: +10/+20/+30/-10/-20/-30 + custom input ± + reset. Applied to all rolls. Inputs are `type="text" inputmode="numeric"` (no spinners).

### HP panel (player sidebar)
- Read-only in player panel — HP is controlled by GM only
- Animated HP bar with ghost (old value) draining to new value on damage
- GM sends damage/heal via Ably → triggers VFX on player side (screen shake, blood particles, vignette, damage number)
- MORT screen at 0 HP

### Player presence (GM side)
- Players send heartbeat every 5s on `aria-damage` channel
- GM sweeps offline players every 10s (threshold: 30s no heartbeat = offline)
- Player cards show HP bar, stats, ⚔ damage input, ♥ heal input

### Card system
- 54-card French deck: ♠ Pique, ♣ Trèfle, ♥ Cœur, ♦ Carreau + 2 Jokers
- Fly animation from deck to stage, flip reveal, tracker pills grid
- Player and GM have **independent decks** (separate localStorage keys)
- Card state: `localStorage: aria-cards` (player) / `aria-gm-cards` (GM)

### Roll result float card
- Appears over content area with scrim, 3 variants: success/fail/crit
- Crits: glow effect, particle burst, auto-dismiss after 8s (normal: 5s)
- Overlay has 3s delay before showing result (lets 3D dice animation finish)

---

## Conventions

- **No frameworks** — pure vanilla JS, no npm, no bundler
- **No `type="number"` spinners** — use `type="text" inputmode="numeric"` with `oninput` regex filter
- **Numeric-only inputs:** `oninput="this.value=this.value.replace(/[^0-9]/g,'')"`
- **BM custom input (allows minus):** `oninput="this.value=this.value.replace(/[^0-9-]/g,'').replace(/(?!^)-/g,'')"`
- **No display:none for layout-shifting elements** — use `visibility:hidden/visible`
- **No external state server** — Ably free tier only, no Railway/WebSocket relay
- **Each app = 3 files** — when editing logic edit `.js`, styles edit `.css`, structure edit `.html`
- When providing updates, **provide only changed files**

---

## Character: Ewald Asrahan (default)

```
Classe : Disciple étranger à l'académie — 28 ans
FOR 9 | DEX 10 | END 15 | INT 14 | CHA 11 | PV 14
Compétence spéciale : Bonneteau 50%
  → Intervertir 2 petits objets dans le champ de vision
```

---

## OBS setup

**Player overlay URL:**
```
file:///PATH/aria-overlay.html?mode=player&ably=KEY
```

**GM overlay URL:**
```
file:///PATH/aria-overlay.html?mode=gm&ably=KEY
```

Browser source size: 1920×1080. Both overlays transparent background.

---

## Development

**No build step, no package manager, no test suite.** Open any `.html` file directly in a browser (`file://`). Chrome is recommended (required for OBS browser sources).

To test changes: save the file, hard-refresh the browser (`Ctrl+Shift+R`). No compilation or server needed.

---

## Recent changes (implemented)

### Weapon dice rolls
- `degats` field on weapons accepts dice notation: `1d6`, `2d8+2`, `1d6-1`, `3d4`, flat numbers, compound expressions (`1d6+1d4+2`)
- `rollDiceFormula(formula)` in `aria-player.js` — splits on `±` tokens, rolls each dice group, returns `{ total, breakdown }`
- Weapons in the **combat sidebar** are clickable when they have a formula — hover shows `⚄ lancer`, click shows damage result in the float card
- Damage rolls are also broadcast to the GM via `aria-rolls` (as `"WeaponName (dégâts)"`, `threshold: null`)

### Character sheet (Personnage tab)
- Refactored from single-column scrollable form → **2-column CSS grid** filling the full tab width
- Block layout: Identité ↔ Traits physiques | Attributs (full) | Armes ↔ Protection & Blessures | Inventaire ↔ Compétences spéciales | Compétences (full, 2-col internal) | Save row
- **Auto-save** on any `input` event (700ms debounce) — writes to `localStorage`, refreshes sidebar/skills/stats, does NOT rebuild editor DOM (avoids losing focus mid-typing)
- `readEditorInputs()` extracts all static inputs; dynamic lists (weapons, inventory, skills, specials) already update `character.*` in real-time via inline `oninput`
- Save button no longer shows `alert()` — a "✓ Sauvegardé" indicator fades in/out instead

---

## Known bugs & issues

> Full details in `Docs/bugs_and_issues.md`

### GM — Monster attacks
- Attack roll result is not displayed on the monster card
- No damage output shown when the attack succeeds

### Player — Healing skill
- On success: should heal the target for 1d6
- On failure: should deal 1d3 damage instead
- Currently no special behavior is wired to the skill name "Soigner"

### Player — Simple dice on overlay
- Rolls from the "Dés simples" buttons (d4, d6, d10, d20, d100) may not appear on the overlay
- Cause: these publish with `threshold: null`; verify the overlay handles that case

### Overlay — Streamlabs OBS compatibility
- Overlay does not render correctly in Streamlabs OBS
- Possible causes: multiple-overlay conflict, Streamlabs-specific browser source restrictions, or rendering engine difference vs standard OBS
- Standard OBS (CEF browser source) works fine

---

## Development roadmap

> Full details in `Docs/development_plan.md`

### P0 — High priority
- **Alchemy**: potion table, create/add custom potions
- **Special skills**: support for special ability mechanics
- **Combat**: parry and dodge mechanics
- **GM interface**: view full player details (skill %, weapons, inventory, stats)

### P1 — Medium priority
- **Player notes**: text-based note system
- **Stream integration**: display player HP on stream during combat
- **Skill editing**: allow players to freely edit their skill percentages in the character sheet
- **Initiative order**: roll-10-based initiative display in main UI and overlay

### P2 — Low priority
- **Magic / card system**: draw multiple cards, retrieve from deck, allow duplicate cards
- **Special skill tracking**: usage markers, cooldown / restoration tracking
- **File sharing**: share files between players with per-user access toggle

### Feature exploration
- **Player notes → quest log**: task list format, organized by quest, completion tracking
- **Text chat**: in-app chat between players (or Discord integration)
- **Dedicated combat page**: participant list (allies + enemies), dynamic add/remove, fog-of-war HP, damage/heal actions, combat overlay

---

## Known pitfalls

### `element.className = ''` strips base CSS classes
When resetting dynamic variant classes (e.g. `crit-success`, `show`, `leaving`) on elements that have a permanent base class, always reset to the base class string rather than `''`. Example:
```js
// Wrong — removes the base class and breaks all CSS targeting `.float-roll-card`
card.className = '';
// Correct
card.className = 'float-roll-card';
```
This applies to any element whose styles depend on a permanent base class plus toggled modifier classes.
