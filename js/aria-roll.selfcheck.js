// Self-check for js/aria-roll.js — the d100 resolution formula.
//
//     node js/aria-roll.selfcheck.js
const assert = require('assert');
const fs = require('fs');
const { rollSeuil, rollType, resolveRoll } =
    new Function(fs.readFileSync(__dirname + '/aria-roll.js', 'utf8') + '\nreturn { rollSeuil, rollType, resolveRoll };')();

// Seuil clamps to 1..99.
assert.strictEqual(rollSeuil(-40), 1);
assert.strictEqual(rollSeuil(0), 1);
assert.strictEqual(rollSeuil(150), 99);
assert.strictEqual(rollSeuil(100), 99);
assert.strictEqual(rollSeuil(55), 55);

// Crit band is floor(seuil / 10), at least 1.
assert.strictEqual(rollType(5, 55), 'crit-success');
assert.strictEqual(rollType(6, 55), 'success');
assert.strictEqual(rollType(1, 5), 'crit-success');   // max(1, 0)
assert.strictEqual(rollType(2, 5), 'success');
assert.strictEqual(rollType(9, 99), 'crit-success');
assert.strictEqual(rollType(10, 99), 'success');

// Fumble at 96+, even under the seuil.
assert.strictEqual(rollType(96, 99), 'crit-fail');
assert.strictEqual(rollType(100, 50), 'crit-fail');
assert.strictEqual(rollType(95, 99), 'success');
assert.strictEqual(rollType(95, 50), 'fail');
assert.strictEqual(rollType(56, 55), 'fail');
assert.strictEqual(rollType(55, 55), 'success');

// Plain die.
assert.strictEqual(rollType(4, null), 'die');

// resolveRoll stays in range and agrees with rollType.
for (let i = 0; i < 2000; i++) {
    const r = resolveRoll(70);
    assert.ok(r.roll >= 1 && r.roll <= 100);
    assert.strictEqual(r.threshold, 70);
    assert.strictEqual(r.type, rollType(r.roll, 70));
    assert.strictEqual(r.success, r.type === 'success' || r.type === 'crit-success');
    const d = resolveRoll(null, 6);
    assert.ok(d.roll >= 1 && d.roll <= 6 && d.type === 'die' && d.success === null);
}
assert.strictEqual(resolveRoll(250).threshold, 99);

console.log('aria-roll selfcheck: ok');
