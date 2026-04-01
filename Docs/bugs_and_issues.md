# TTRPG Web Tool — Bug Fixes & Issues

## Open Issues

*(none)*

## Resolved Issues

### Soigner — target selection + visual distinction ✓
- `Soigner` skill now displays with a green color in the skill list to distinguish it from regular skills.
- Clicking `Soigner` opens a target picker modal showing "Soi-même" plus any online players (seen via presence in the last 30s).
- On success: heals the selected target. If self, applies HP directly; if another player, sends a `heal` message on `aria-damage` with `source: 'player'`.
- On failure: always damages the caster (no change to that behavior).
- Receiving players handle player-originated heals by computing HP changes locally (since the sender doesn't know their HP).

### Light mode — text contrast ✓
- **Player CSS**: Added light-mode overrides for `.crit-success .fc-crit-sub`, `.crit-fail .fc-crit-sub`, `.other-roll-toast .ort-verdict.cs/.cf`, and `.hp-number.low`.
- **GM CSS**: Added light-mode overrides for `.topbar-badge`, `.tab-btn.active`, monster card elements (`.mc-atk-name`, `.mc-atk-pct`, `.mc-atk-col-label`), add-monster form (`.add-monster-form h3`, `.amf-label`, `.amf-add-btn`), attack editor (`.atk-row input`, `.add-atk-btn`), action buttons (`.gm-action-dmg`, `.gm-action-heal`, `.pc-btn.heal`), target buttons (`.gm-target-btn.applied`), and roll feed (`.re-verdict.cs/.cf`, `.roll-entry.crit-success/.crit-fail`).
