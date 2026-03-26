# TTRPG Web Tool — Bug Fixes & Issues

## GM Side

### Monster Attack Roll ✅ FIXED
- **Was:** Attack result was displayed in the "Jet MJ" tab — invisible when on the Monstres tab. No damage rolled on success.
- **Fix:** Added a result strip (`#monster-atk-result`) above the monsters grid in the Monstres tab. It shows attack name, rolled value, threshold, verdict (SUCCÈS/ÉCHEC), and — on success — rolls the damage formula and displays the total with breakdown.
- Added `rollDiceFormula()` to `aria-gm.js` (mirrors the player-side version).
- `rollMonsterAttack` now accepts `dmg` as a 4th argument, passed from the attack row onclick.

---

## Player Side

### Skills

#### Healing skill (Soigner) ✅ FIXED
- **Was:** No special behavior — just a standard d100 roll with no HP consequence.
- **Fix:** After the roll resolves, `applySoigner(success)` runs with a 1500ms delay (so the float card shows first):
  - **Success:** rolls `1d6`, heals self (capped at max PV), shows heal number + toast, broadcasts presence.
  - **Failure:** rolls `1d3`, damages self (floored at 0), triggers damage VFX + toast, shows MORT screen if HP hits 0, broadcasts presence.

### Free Roll

#### Dice rolls on overlay ✅ VERIFIED — no bug
- Investigated: the overlay's `showRoll()` correctly handles `threshold: null` via `const isDie = data.threshold === null`.
- Die rolls show the card with just the roll value and no verdict, for 6 seconds.
- The 3-second delay before the overlay shows the card is intentional (syncs with dddice 3D animation) and applies to all roll types equally.
- No fix needed.

---

## Overlay / Streaming

### Streamlabs OBS compatibility — INVESTIGATED

**Root cause:** Streamlabs OBS browser sources enforce stricter security policies than standard OBS (CEF). The overlay connects to Ably via `wss://` WebSocket from a `file://` URL. Some Streamlabs versions block WebSocket connections from `file://` origins.

**Solutions (in order of preference):**

1. **Serve over HTTP (recommended):** Run a local HTTP server in the `Overlay/` directory:
   ```
   python -m http.server 8080
   ```
   Then set the browser source URL to:
   ```
   http://localhost:8080/aria-overlay.html?mode=player&ably=KEY
   ```

2. **Use OBS instead of Streamlabs:** Standard OBS CEF browser sources work correctly with `file://` URLs.

3. **Check Streamlabs browser source settings:** In the browser source properties, enable "Shutdown source when not visible" OFF, and ensure "Use custom frame rate" is disabled. Some users also need to check "Allow access to local files."

**Status:** Not a code bug — the overlay JS is correct. The issue is the Streamlabs OBS runtime environment.
