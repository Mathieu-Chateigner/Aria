# TTRPG Web Tool — Bug Fixes & Issues

## GM Side

### Monster Attack Roll
- Attack result is not displayed on the monster screen
- No damage output shown when the attack succeeds

---

## Player Side

### Skills
- Healing skill behavior:
  - On success: should heal target for 1d6
  - On failure: should deal 1d3 damage instead

### Free Roll
- Dice rolls (d6, d20, etc.) do not appear on the overlay (to check)

---

## Overlay / Streaming

- Not working with Streamlabs OBS
  - Possible causes:
    - Conflict with multiple overlays
    - Streamlabs-specific limitation
    - Rendering or browser source issue

Your job to know why

---