# CLAUDE.md

TTRPG client and OBS overlay for the ARIA role-playing game, vanilla HTML/CSS/JS (no framework, no build step). Pages talk in real time over Ably and persist to Supabase. This repository **is production**: it is published as-is on GitHub Pages at `https://mathieu-chateigner.github.io/Aria/`.

---

## Workflow

**Never commit or push.** The user commits and pushes manually — a push publishes to production.

Last step of every task: overwrite the `commits` file at the repo root (gitignored) with a plain-text summary of this batch only. No markdown. Format:

```
type: short summary line (this becomes the GitHub commit title)

Changes:

- file : what changed and why
```

Types: `feat`, `fix`, `docs`, `refactor`, `style`.

---

## Skills — load the one matching the task

The detailed notes live in `.claude/skills/` (gitignored: this repository is public, the notes stay on the machine). They are copied from the private AriaTest checkout (`../AriaTest/.claude/skills/`), which holds the reference copy.

| skill | load before |
|---|---|
| `vdo-camera` | anything camera: push/viewer iframes, stream ids, room, kill switch, device picker |
| `ably-message` | a channel, payload, presence field, chat, or `supabase/functions/ably-token` |
| `add-table` | any `specs/*.sql`, RLS, Storage, `ENT`, sync or delete cascade |
| `shared-widget` | a feature on both panels, a new top-level name, `aria-shared.js`, `aria-panel.css` |
| `game-rules` | rolls, thresholds, modifiers, Soigner, the character object, `commitCharacter` |
| `gm-panel` | non-trivial `aria-gm.js` work: campaigns, join codes, music, groups, files |
| `overlay` | `aria-overlay.js`, `aria-overlay-editor.js`, the OBS URL |
| `port-handoff-page` | a redesigned page: Connexion, Hub, Accueil, Fiche, Journal, legal, or a new one |
| `verify` | finishing any code change |

Map feature (world map + tactical map): design in `specs/2026-08-28-carte-points-interet-design.md` and `specs/2026-10-05-carte-tactique-design.md`; renderer `mapView()` in `aria-shared.js`.

---

## Development

- No build, no package manager, no test runner. Checks: see the `verify` skill (`node --check`, the three `js/*.selfcheck.js`, then the browser).
- Chrome only (OBS browser sources use CEF). Hard-refresh after edits (`Ctrl+Shift+R`).
- Preview server: `.claude/launch.json` (`aria-static`, `python -m http.server 8082`). Hub, Accueil, Fiche and Journal render without an account with `?demo`. The panels need a signed-in session. Streamlabs needs HTTP too; standard OBS works from `file://`.

---

## Supabase — production vs test

- **Aria** `npybuksklkvdmbhyzdjs` is production and is what `js/aria-supabase.js` points at (`SUPABASE_URL` / `SUPABASE_ANON_KEY`, the only place to change). Accounts, RLS and Ably tokens are live there since 2026-11-08.
- **Reading** production to compare a schema or count rows is fine. **Never write to it** — no migration, no backfill, no function deploy — unless the user asks for that exact action. A new `specs/*.sql` is written here and run by the user.
- **AriaTest** `qpxaaauzzbahsdhsjaqn` (eu-west-3) is the test project, used by the sibling `../AriaTest` checkout. Try SQL there first, and always pass `--project-ref` explicitly to `supabase` commands.

---

## Files

```
index.html                  Connexion (login / signup / reset)
og-image.png                social preview card (1200x630)
views/
  aria-hub.html             Hub "la taverne": tables, explore, create, requests, messages
  aria-accueil.html         Accueil "le seuil": per-campaign menu (?camp=ID)
  aria-fiche.html           character sheet of that campaign (?camp=ID)
  aria-journal.html         campaign notes by session (?camp=ID)
  aria-code.html            CGU (accepted by the signup checkbox)
  aria-confidentialite.html privacy policy (GDPR art. 13)
  aria-mentions.html        mentions légales (LCEN)
  aria-player.html          player panel (the Table; vue de jeu frame, ?ui=old = previous layout)
  aria-gm.html              GM panel
  aria-overlay.html         OBS overlay
  aria-overlay-editor.html  overlay layout editor
css/
  aria-tokens.css           redesign palette + fonts; first on redesigned pages
  aria-fonts.css            Archivo + Cormorant Garamond as data URIs (file:// refuses font files)
  aria-panel.css            rules shared by both panels; loaded before aria-player/gm.css
  aria-play.css             vue de jeu frame (rail, drawers, bottom bar), all under body.ui-play
  aria-<page>.css           one per page; aria-code.css serves the three legal pages
js/
  aria-supabase.js          Supabase REST + auth session + ENT mapping + Ably token connect
  aria-shared.js            shared panel runtime: el(), factories, split panes, music, map view
  aria-roll.js              d100 resolution, the only definition
  aria-bg.js                procedural backgrounds (ariaBg.mount(scene))
  aria-chargement.js        boot screen: ariaLoading(promise)
  aria-hub-data.js          data layer of Hub/Accueil/Fiche/Journal (live + ?demo)
  aria-<page>.js            one per page
  *.selfcheck.js            node-runnable checks
  vendor/ably.min-2.29.0.js Ably, self-hosted and pinned (the CSP allows no CDN script)
specs/                      SQL migrations (*.sql), attack scripts (*.check.py), design docs (*.md)
supabase/functions/         ably-token, purge-inactive (Edge Functions, deployed by the user)
plans/                      implementation plans
```

The redesign prototypes (`design_handoff_aria/*.dc.html`) live in the AriaTest checkout only; source comments cite them as `AriaTest/design_handoff_aria/…`. `Docs/` is gitignored and local (holds `Aide aux combats.pdf`, the parade/esquive source of truth). `Aria.sln` is tracked (Visual Studio), `.vs/` ignored.

---

## Architecture in one screen

- **Realtime: Ably.** Game channels are suffixed with the campaign join code (`campaignChannel(base)`; codes are 8 characters). No page holds the Ably key: tokens come from the `ably-token` Edge Function with a bound clientId (player = `charId`, GM = `gm-{campaignId}`, overlay and editor = none). **Consumers trust `msg.clientId` / `member.clientId`, never identity claims in payloads** — a message with no clientId comes from an overlay token and must not be acted on. Presence sets are the roster; there is no heartbeat and no `beforeunload`. Details: `ably-message`.
- **Persistence: Supabase.** Every table but `overlay_configs` is behind RLS keyed on `saves.owner`. localStorage is the runtime truth; Supabase persists through per-entity debounced syncs. `ENT` in `aria-supabase.js` is the only row↔object mapping. **After a successful load the database is authoritative, an empty result included** (it means "deleted on another device"), so the panels' `loadFromSupabase()` reads with `sbSelectStrict()` — a failed request must never pass for an empty one. Details: `add-table`.
- **Accounts.** Signing in happens on Connexion only (email + password, or Discord). The panels' `tryRestoreSupabase()` asks for the session (none → back to Connexion), then `enterWithSession()` picks the owned save whose `type` matches the panel; the gateway's second stage (`#file-gateway`, starts `display:none` — never `flex` in HTML) only shows when the account owns none. `submitExistingKey()` claims a pre-account key via `claim_save_key`. "Se souvenir de moi" unticked = `aria-forget` + session cookie `aria-alive`.
- **Per-browser config** `aria-config` = `{ youtubeApiKey }` only. Campaign settings (VDO room) live on the campaign; per-character state on `CHAR_KEYS`, per-campaign on `CAMP_KEYS`.
- **Rolls.** `aria-roll.js`: seuil clamped to 1–100 (100 % is still not auto-success), critical success at roll ≤ max(1, floor(seuil / 10)), critical failure at roll ≥ 96 even under the seuil. Details: `game-rules`.
- **Overlay** runs in OBS without a session, bootstrapped from the save key (`?s=`), which is therefore a secret. Details: `overlay`.

---

## Panels

Player tabs: Compétences · Caractéristiques · Jet libre · Inventaire · Notes · Messages · Cartes · Alchimie · Documents · Carte · Caméras · Personnage. Cartes/Alchimie appear when the GM enables them (`tab-config`), Documents when a file is granted, Carte when a map is shown, Caméras while a VDO room is known.

GM tabs: Joueurs · Monstres · Carte · Jets · Cartes · Alchimie · Fichiers · Musique · Messages · Notes.

**Vue de jeu** (`specs/2026-11-25-vue-de-jeu-design.md`, steps 1–7 coded; only the removal of `?ui=old` is left): `mountPlayUI()` moves the old page's nodes into new regions at load — tab bar → section rail, HP/karma/modifier → bottom bar (`#play-bar`), table thread → right column (`#play-side`) — so every id and handler is unchanged and `?ui=old` (`UI_OLD`) skips the move and shows the previous layout (also remembered per browser as `aria-ui` = 'old' by the Configuration switch `toggleUiOld()`; `?ui=new` / `?ui=old` win). Panes then go through the drawer layout in `aria-shared.js` (`ARIA.drawers` / `ARIA.stagePane` hooks): the stage (map, else cameras, else `#play-stage-empty`) fills the centre, the cameras go to the right column above the thread when the map holds the centre (`ARIA.sidePane`; `.main` is a grid and `.content` is `display:contents`, so the pane changes place by CSS only — never reparent it, its iframes would reload), and at most one drawer (`drawerPane`, `toggleDrawer` / `closeDrawer`, Esc) opens over it; `openPanes` still lists what is on screen. The presence densities are off there (`presenceMode = 'play'`, not persisted). Pinned skills are `skill.pinned` on the character (★ in Compétences); with none, the bottom bar offers Parade/Esquive. The GM panel uses the same frame (`mountPlayRail` / `playMove` in `aria-shared.js`): its stage is the map, else Joueurs (which then moves to the right column above the roll feed); the bottom bar follows the monster selected by a click on its card (`selectMonster`, `renderGMPlayBar`): HP with damage/heal (`damageMonster` / `healMonster`, the one HP path), attacks as pins, and the hidden GM d100 + dice; the last roll shows above the bar (`#pb-gm-result`). On a tactical map, a click on a monster token selects it the same way, and a monster card dragged by its grip (⠿) onto the map becomes a hidden linked token (`_mapStageDrop`). `mountPlayRail` also binds `1`–`8` to the rail, plus the letters of `ARIA.keys` (`M` ruler, `F` follow the GM) and `ARIA.escape` (Esc drops a map tool before closing a drawer). Step 5: `mapView` measures (right-click drag, or the ruler tool), pings (long press, or the ping tool; GM Maj = recentre everyone) and reports its view; `makeMapFx` carries rulers and pings over `aria-map` (author = `msg.clientId`), the GM sends `view` for « Suivre le MJ », the overlay draws rulers and pings. The GM's map tools are a vertical toolbar (`_gmMapTools`, `setMapTool`); « Placer » opens `_placeMenu` (monsters, characters, free token `{ ref: null, free: true, name }`). Step 6, the manual fog of a tactical map: `map.fog = { base: 'dark' | 'clear', ops: [{ t: 'r' | 'h', pts }] }` replayed in order, published as `state.fogMask` (`state.fog` is the POI fog); `mapFog` / `fogVisible` in `aria-supabase.js` are the only rule and `visibleTokens()` drops what stands under it (one's own token excepted); drawn by `_mapFogLayer` (GM see-through) and `_owFog`. Step 7: every roll and card draw of the table is a card of `makeRollRow()` over the centre (`rollRow`, null under `?ui=old`; the player's own goes through `showOwnRoll()`, a card that leaves becomes a local `chat.note` line; the GM's own rolls never go there); GM top bar mini-player (`#tb-music-play` / `#tb-music-vol`) and ⚑ `#tb-flag` (`focusOldestMove`); a drawer open over the map folds the player's camera column into round portraits by CSS, with « Fil » (`mountFil`) floating the thread; the GM's ☀ spotlight is the Projecteur (`.cameras-grid.has-spot`); below 1280 px `mountPlayNarrow()` covers the page.

Both re-enter the last character/campaign on load (`aria-last-character` / `aria-gm-last-campaign`, cleared by `switchCharacter()` / `switchCampaign()`). "← Seuil" (`goSeuil`) opens the campaign's Accueil; `ARIA` opens the selection screen. Under `?ui=old`, panes dock by drag only (split-pane engine in `aria-shared.js`).

A campaign's variant (`ariaType`: `ancient` médiéval / `contemporary`) is chosen when it is created — in the Hub form or the GM panel — and never changes: it picks the character template of whoever sits down, and the GM only lists characters of that variant.

---

## Conventions

- Each page = `.html` + `.css` + `.js`. Code both panels need lives once in `aria-shared.js` behind an `ARIA` hook or a factory option — never a `gm`-prefixed twin.
- Every page but the OBS overlay carries a CSP meta: `script-src 'self'` (no inline script, no CDN) on redesigned pages; the panels still allow `'unsafe-inline'` for their legacy `on*=` attributes. A new external script means a CSP change and a legal-page check.
- Build DOM with `el()` / `fill()` / `reconcile()`; data never becomes markup and generated markup has no inline `on*=`. The overlay is the exception (string-built, every field through `esc()`).
- Never detach or re-src a live camera iframe; never `innerHTML = ''` a container holding one.
- Numeric inputs: `type="text" inputmode="numeric"` + `oninput` filter (`/[^0-9]/g`, or `/[^0-9-]/g` then `/(?!^)-/g` for a sign). No `type="number"`.
- Layout-shifting elements toggle `visibility`, not `display:none`.
- Colors through CSS variables only. Dark only. Redesign palette in `css/aria-tokens.css` (`--ember` player accent, `--violet` GM accent, `--text`, `--warm`, `--dim`, `--ok`, `--bad`); fonts Archivo (UI) and Cormorant Garamond (display).
- New personal data, recipient or third-party script → update the legal pages. No external trackers, fonts or embeds without a consent banner.
- A known limit left in code gets a `shortcut:` comment (older ones say `ponytail:`).
