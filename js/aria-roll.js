// ═══════════════════════════════════════════
//  ROLL RESOLUTION — d100 roll-under
// ═══════════════════════════════════════════
// The one definition of how a roll resolves (design_handoff_aria/README.md, "Dice
// resolution"). Standalone, no DOM and no dependency, so the player, the GM and the
// overlay all load it. Rolls stay client-side on purpose: no server round-trip on
// every roll for the sake of a player who would cheat at a TTRPG table anyway.
//
//   seuil  clamp(base + modifiers, 1, 99)
//   crit   roll <= max(1, floor(seuil / 10))   'crit-success'
//   fumble roll >= 96                          'crit-fail'   (even under the seuil)
//   ok     roll <= seuil                       'success'
//   ko     otherwise                           'fail'
//   no seuil (plain die)                       'die'
//
// Modifiers are the caller's business (the player adds BM + karma, the GM adds none);
// this file only clamps and classifies. Run `node js/aria-roll.selfcheck.js` after
// touching it.

function rollSeuil(n) {
    return Math.max(1, Math.min(99, Math.round(n)));
}

// Classify a roll against an already-clamped seuil. `null` seuil = plain die.
function rollType(roll, seuil) {
    if (seuil === null || seuil === undefined) return 'die';
    if (roll <= Math.max(1, Math.floor(seuil / 10))) return 'crit-success';
    if (roll >= 96) return 'crit-fail';
    return roll <= seuil ? 'success' : 'fail';
}

function rollSucceeded(type) {
    return type === 'success' || type === 'crit-success';
}

// Roll one die. With a seuil: { roll, threshold, type, success }; without: a plain die.
function resolveRoll(seuil, die = 100) {
    const roll = 1 + Math.floor(Math.random() * die);
    if (seuil === null || seuil === undefined) return { roll, threshold: null, type: 'die', success: null };
    const threshold = rollSeuil(seuil);
    const type = rollType(roll, threshold);
    return { roll, threshold, type, success: rollSucceeded(type) };
}
