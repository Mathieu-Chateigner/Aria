# TTRPG Web Tool — Bug Fixes & Issues

## Open Issues

---

### PLAYER — Character selection view

#### Bug 1: Save key can only be changed, not copied

**Location:** `views/aria-player.html` line 57–60 — the `.sel-save-row` div

**Current behavior:** The row shows the save key label (`sel-save-label`) and a "Changer…" button (`changeSaveKey()`). No way to copy the displayed key.

**Expected behavior:** Add a "Copier" button next to the label that copies the current `saveKey` value to clipboard. Same feedback pattern as `copyGatewayKey()` (button text changes to "Copié !" for 2s).

Note: `copyGatewayKey()` already exists in `aria-player.js` line 203 but reads from `gateway-key-display` (only present in the gateway screen). The new copy button for the selection screen needs to copy from the `saveKey` variable directly.

---

#### Bug 2: Campaign key field missing from character creation form

**Location:** `views/aria-player.html` lines 48–55 — the `#new-char-form` div  
**Location:** `js/aria-player.js` lines 354–370 — `createCharacter()` and `confirmCreateCharacter()`

**Current behavior:** The form has only `new-char-name` and `new-char-class` inputs. `confirmCreateCharacter()` does not set `campaignKey`. The field was intentionally removed at some point but should not have been.

**Expected behavior:** Add a third input `new-char-campaign` (placeholder: "Code de campagne (optionnel)"). In `confirmCreateCharacter()`, read its value and set `campaignKey` on the new character object. The field is optional — empty string is fine.

---

### PLAYER — Character view (Inventory tab + left sidebar)

#### Bug 3: Empty vials row shown in Inventory tab when alchemy is disabled

**Location:** `views/aria-player.html` line 192 — `<div id="inv-vials-section"></div>` always rendered in the Inventory tab  
**Location:** `js/aria-player.js` line 1582 — `renderVialsInInventory()`

**Current behavior:** `renderVialsInInventory()` always populates `#inv-vials-section`, regardless of whether the GM has granted the Alchemy tab (`playerTabs.alchemy`). So players without alchemy see a "Fioles vides" row in the Inventory tab even though the Alchemy panel is hidden.

**Expected behavior:** In `renderVialsInInventory()`, if `playerTabs.alchemy === false`, clear `#inv-vials-section` and return early (or hide it). Only render the vials control when alchemy is active.

---

#### Bug 4: Empty vials not shown in the left inventory sidebar

**Location:** `js/aria-player.js` line 805 — `renderInventorySidebar()`

**Current behavior:** `renderInventorySidebar()` only renders `character.inventory` items (the manually-added list). Vials are a separate field (`character.vials`) and never appear in the sidebar, even though they are inventory items.

**Expected behavior:** Append a vials line at the bottom of the inventory sidebar whenever `character.vials > 0`. Format it like a regular inventory item (name + count). This should always show when vials > 0, regardless of whether alchemy is enabled (vials are a physical inventory item).

---

### GAME MASTER — Campaign selection view

#### Bug 5: Save key can only be changed, not copied

Same issue as Bug 1 but in the GM app.

**Location:** `views/aria-gm.html` lines 56–59 — the `.sel-save-row` div

**Fix:** Same as Bug 1. Add a "Copier" button that copies `saveKey` to clipboard. `copyGatewayKey()` is also defined in `aria-gm.js` line 155 but only reads from `gateway-key-display`.

---

### GAME MASTER — Campaign view (in-game topbar)

#### Bug 6: Join code positioned after campaign name instead of before it

**Location:** `views/aria-gm.html` lines 72–73 — the topbar

**Current order:** `Maître de Jeu` badge → campaign name input (`#campaign-display`) → join code (`#joincode-display`) → spacer → player count

**Expected order:** `Maître de Jeu` badge → join code (`#joincode-display`) → campaign name input (`#campaign-display`) → spacer → player count

**Fix:** Swap the two elements in the HTML.

---

#### Bug 7: Player count shows online/online instead of online/total-registered

**Location:** `js/aria-gm.js` line 561–562 — inside `renderPlayers()`

**Current behavior:**
```js
const online = [...players.values()].filter(p => p.online !== false).length;
document.getElementById('player-count').textContent = `${online}/${players.size} joueur(s) en ligne`;
```
`players.size` = players seen this session. If all currently connected players just joined, online === total, giving e.g. 2/2.

**Expected behavior:** `total` = number of characters across all connected clients that have this campaign's join code (`currentJoinCode`) configured as their `campaignKey`. The GM receives this via presence heartbeats (`aria-damage` / `presence`, field `campaignKey`). Players with a mismatched key are already rejected by `handlePresence()`.

The fix: persist the known-players map to `localStorage` keyed by campaign ID (e.g. `aria-gm-known-players-{id}`), merging on each heartbeat. On `loadCampaignState()`, restore this map. On sweep, mark players offline but keep them in the map. The displayed total becomes the count of all entries in the map (online + offline), and online count stays as-is. This way, after a GM page refresh, previously-seen players still count toward the total (e.g. 0/6 at session start).
