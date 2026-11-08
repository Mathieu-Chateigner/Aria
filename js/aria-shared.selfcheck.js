// Self-check for the pure logic in aria-shared.js — the parts with real branching
// that no longer have a second copy to disagree with. Run it after touching the dice
// grammar or the roll-filter pills:
//
//     node js/aria-shared.selfcheck.js
//
// No framework and no build: it stubs the two browser globals aria-shared.js touches
// at load time, evals the file, and asserts. Everything else in that file needs a
// real DOM and is exercised by opening the panels.
const assert = require('assert');
const fs = require('fs');

// aria-shared.js is a classic script: eval it in this scope so its top-level
// declarations become visible here, with the globals it reads at load time stubbed.
const _listeners = {};
global.window = { addEventListener(type, fn) { (_listeners[type] ||= []).push(fn); } };
const _store = new Map();
global.localStorage = {
    getItem: k => (_store.has(k) ? _store.get(k) : null),
    setItem: (k, v) => _store.set(k, String(v)),
    removeItem: k => _store.delete(k),
};
const src = fs.readFileSync(__dirname + '/aria-roll.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/aria-shared.js', 'utf8');
global.SUPABASE_URL = 'https://proj.supabase.co';
const { rollDiceFormula, rollPassesFilter, rollType, append, makeCamera, makeChat, _fileUrl, generateJoinCode } =
    new Function(src + '\nreturn { rollDiceFormula, rollPassesFilter, rollType, append, makeCamera, makeChat, _fileUrl, generateJoinCode };')();

// ── Shared file URLs ─────────────────────────────────────────────────────────
// Only our own public storage: a file grant is remote-controlled.
const okFile = 'https://proj.supabase.co/storage/v1/object/public/campaign-files/a.png';
assert.strictEqual(_fileUrl(okFile), okFile);
assert.strictEqual(_fileUrl('javascript:alert(1)'), '');
assert.strictEqual(_fileUrl('https://evil.example/storage/v1/object/public/x.png'), '');
assert.strictEqual(_fileUrl('https://proj.supabase.co.evil.example/storage/v1/object/public/x'), '');
assert.strictEqual(_fileUrl(okFile + '" onerror="x'), '');

// ── Dice formulas ─────────────────────────────────────────────────────────────
// Flat terms are exact, so assert their totals directly.
assert.strictEqual(rollDiceFormula('5').total, 5);
assert.strictEqual(rollDiceFormula('2+3').total, 5);
assert.strictEqual(rollDiceFormula('10-4').total, 6);
assert.deepStrictEqual(rollDiceFormula(''), { total: 0, breakdown: '' });
assert.deepStrictEqual(rollDiceFormula(null), { total: 0, breakdown: '' });

// Dice terms are random, so assert the bounds and the breakdown shape instead.
for (let i = 0; i < 200; i++) {
    const r = rollDiceFormula('2d6+2');
    assert.ok(r.total >= 4 && r.total <= 14, 'total out of range: ' + r.total);
    assert.match(r.breakdown, /^\[\d+\+\d+\] \+2$/, 'bad breakdown: ' + r.breakdown);

    const neg = rollDiceFormula('1d4-1');
    assert.ok(neg.total >= 0 && neg.total <= 3, 'negative modifier: ' + neg.total);
    assert.match(neg.breakdown, /^\[\d+\] −1$/, 'bad breakdown: ' + neg.breakdown);
}
// Whitespace and case are normalised away.
assert.match(rollDiceFormula(' 3 D 4 ').breakdown, /^\[\d+\+\d+\+\d+\]$/);


// ── Roll filter pills ─────────────────────────────────────────────────────────
// The regression this replaced: the GM's copy ended in `has(type)`, so a critical
// success vanished while "Succès" was lit. Succès/Échec include their crits.
const critSuccess = { roll: 5,  threshold: 50, success: true  };   // <= floor(50/10)
const critFail    = { roll: 97, threshold: 50, success: false };   // >=96
const plainOk     = { roll: 40, threshold: 50, success: true  };
const plainFail   = { roll: 60, threshold: 50, success: false };
const die         = { roll: 4,  threshold: null, success: null };
assert.strictEqual(rollType(5, 50), 'crit-success');   // guards the fixtures
assert.strictEqual(rollType(97, 50), 'crit-fail');

const S = (...k) => new Set(k);
// Empty filter passes everything, dice rolls included.
for (const e of [critSuccess, critFail, plainOk, plainFail, die])
    assert.ok(rollPassesFilter(e, S()), 'empty filter must pass everything');

assert.ok(rollPassesFilter(critSuccess, S('success')), 'Succès must include crit successes');
assert.ok(rollPassesFilter(critFail,    S('fail')),    'Échec must include crit failures');
assert.ok(rollPassesFilter(plainOk,     S('success')));
assert.ok(rollPassesFilter(plainFail,   S('fail')));
assert.ok(rollPassesFilter(critSuccess, S('crit')));
assert.ok(rollPassesFilter(critFail,    S('crit')));

assert.ok(!rollPassesFilter(plainFail, S('success')));
assert.ok(!rollPassesFilter(plainOk,   S('fail')));
assert.ok(!rollPassesFilter(plainOk,   S('crit')), 'a plain success is not a crit');
// Dice rolls (threshold null) answer only to the Dés pill.
assert.ok(rollPassesFilter(die, S('die')));
assert.ok(!rollPassesFilter(die, S('success')));
assert.ok(!rollPassesFilter(plainOk, S('die')));
// Pills combine as a union.
assert.ok(rollPassesFilter(die, S('success', 'die')));
assert.ok(rollPassesFilter(plainFail, S('success', 'fail')));

// ── Child appending (append/el) ──────────────────────────────
// `0` is falsy but was appended as the text "0", so `online.length && el(...)` printed
// a stray 0 in the Jet MJ panel whenever nobody was online. Numbers are skipped too:
// pass String(n) to render a real zero.
const fakeParent = { kids: [], append(k) { this.kids.push(k); } };
append(fakeParent, [0, '', null, undefined, false, NaN, 'a', ['b', 0, ['c']]]);
assert.deepStrictEqual(fakeParent.kids, ['a', 'b', 'c']);

// ── Map filters (aria-supabase.js) ────────────────────────────────────────────
// Loaded by all four pages, so both filters are written once. They decide what each
// spectator sees; a divergence here is a leak on stream.
const sbSrc = fs.readFileSync(__dirname + '/aria-supabase.js', 'utf8');
const { visiblePois, fogZones, mapVB, mapGrid, gridSnap, gridCalib, gridDistance, visibleTokens } =
    new Function(sbSrc + '\nreturn { visiblePois, fogZones, mapVB, mapGrid, gridSnap, gridCalib, gridDistance, visibleTokens };')();

// ── Tactical map geometry ─────────────────────────────────────────────────────
// A world map works in percentages, a tactical one in image pixels.
assert.deepStrictEqual(mapVB({ kind: 'monde', size: { w: 1600, h: 900 } }), { w: 100, h: 100 });
assert.deepStrictEqual(mapVB({ kind: 'tactique', size: { w: 1600, h: 900 } }), { w: 1600, h: 900 });
// A tactical map whose size is missing or forged falls back rather than dividing by 0.
assert.deepStrictEqual(mapVB({ kind: 'tactique', size: { w: 0, h: 'x' } }), { w: 100, h: 100 });
assert.strictEqual(mapGrid({ kind: 'monde', grid: { cell: 70 } }), null);
assert.strictEqual(mapGrid({ kind: 'tactique', grid: { cell: 1 } }).cell, 8);   // clamped
assert.strictEqual(mapGrid({ kind: 'tactique', grid: {} }).snap, true);
// Snapping lands on the centre of the cell: 70 px cells, a pin dropped at 100 px → cell 2.
assert.deepStrictEqual(gridSnap(100, 10, { cell: 70, ox: 0, oy: 0 }), { x: 105, y: 35 });
// …and honours the offset, including a point left of it.
assert.deepStrictEqual(gridSnap(5, 5, { cell: 70, ox: 10, oy: 10 }), { x: -25, y: -25 });
// Calibration from the two corners of one drawn cell, in either order.
assert.deepStrictEqual(gridCalib({ x: 150, y: 80 }, { x: 220, y: 150 }), { cell: 70, ox: 10, oy: 10 });
assert.deepStrictEqual(gridCalib({ x: 221, y: 151 }, { x: 150, y: 80 }), { cell: 71, ox: 8, oy: 9 });
assert.strictEqual(gridCalib({ x: 0, y: 0 }, { x: 2, y: 2 }), null);   // too small to be a cell
// A 2-cell token lands on an intersection, a 3-cell one on a cell centre.
assert.deepStrictEqual(gridSnap(100, 100, { cell: 70, ox: 0, oy: 0 }, 2), { x: 70, y: 70 });
assert.deepStrictEqual(gridSnap(100, 100, { cell: 70, ox: 0, oy: 0 }, 3), { x: 105, y: 105 });
// 210 px at 70 px a cell and 1.5 m a cell: 3 cells, 4.5 m.
assert.strictEqual(gridDistance({ x: 0, y: 0 }, { x: 210, y: 0 }, { cell: 70, per: 1.5, unit: 'm' }).text, '3 cases · 4,5 m');
assert.strictEqual(gridDistance({ x: 0, y: 0 }, { x: 70, y: 0 }, { cell: 70, per: 1.5, unit: 'm' }).text, '1 case · 1,5 m');
// Hidden tokens never reach a spectator, even in a forged state; junk renders as nothing.
assert.deepStrictEqual(visibleTokens({ tokens: [{ id: 'a', x: 1, y: 1 }, { id: 'b', x: 2, y: 2, hidden: true }] }, 'alice').map(t => t.id), ['a']);
assert.deepStrictEqual(visibleTokens({ tokens: 'x' }, null), []);
assert.deepStrictEqual(visibleTokens({ tokens: [null, { id: 'c', x: 'nope', y: 1 }] }, null), []);

const poiA = { id: 'a', name: 'Taverne', x: 10, y: 10, publicDesc: 'ok', discoveredBy: ['alice'], zone: [] };
const poiB = { id: 'b', name: 'Crypte',  x: 20, y: 20, publicDesc: '',   discoveredBy: ['bob'],   zone: [[0,0],[10,0],[10,10]] };
const poiC = { id: 'c', name: 'Secret',  x: 30, y: 30, publicDesc: '',   discoveredBy: [],        zone: [] };
const mapState = { pois: [poiA, poiB, poiC], fog: [], positions: {}, players: {} };

// 1. A player sees only the POIs whose discoveredBy contains them.
assert.deepStrictEqual(visiblePois(mapState, 'alice').map(p => p.id), ['a']);
assert.deepStrictEqual(visiblePois(mapState, 'bob').map(p => p.id),   ['b']);
// 2. The table view (null charId) sees the union of every discovery.
assert.deepStrictEqual(visiblePois(mapState, null).map(p => p.id), ['a', 'b']);
// 3. A POI nobody has discovered appears in neither view.
assert.ok(!visiblePois(mapState, 'alice').some(p => p.id === 'c'));
assert.ok(!visiblePois(mapState, null).some(p => p.id === 'c'));
// 4. An empty pois list does not throw.
assert.deepStrictEqual(visiblePois({ pois: [] }, 'alice'), []);
assert.deepStrictEqual(visiblePois({ pois: [] }, null), []);

// state.pois carries what at least one player discovered, state.fog what nobody did but
// which has a zone. fogZones() recomposes, per spectator, the set of black districts.
const fogState = {
    pois: [poiA, poiB, poiC],                       // a: alice, b: bob (zone), c: nobody, no zone
    fog:  [{ id: 'd', zone: [[50,50],[60,50],[60,60]] }],   // nobody discovered d
};
// 5. A POI nobody discovered, with a zone, is in the fog.
assert.ok(fogZones(fogState, 'alice').some(z => z.id === 'd'));
assert.ok(fogZones(fogState, null).some(z => z.id === 'd'));
// 6. A POI Bob discovered and Alice did not is in Alice's fog, not in Bob's.
assert.ok(fogZones(fogState, 'alice').some(z => z.id === 'b'));
assert.ok(!fogZones(fogState, 'bob').some(z => z.id === 'b'));
// 7. An undiscovered POI WITHOUT a zone shows up nowhere — neither clear nor fogged.
assert.ok(!visiblePois(fogState, 'alice').some(p => p.id === 'c'));
assert.ok(!fogZones(fogState, 'alice').some(z => z.id === 'c'));
// 8. No fog entry carries a name or a description. This is the assertion that guards the
//    "geometry only" rule: a player must be able to draw a black district without
//    learning anything about what is in it.
const aliceFog = fogZones(fogState, 'alice');
// Non-empty on purpose: a loop over an empty array would pass vacuously, the exact failure
// mode assertion 7 just had. Alice's fog must hold d (nobody found it) and b (Bob did,
// she did not).
assert.strictEqual(aliceFog.length, 2);
for (const z of aliceFog) {
    assert.deepStrictEqual(Object.keys(z).sort(), ['id', 'zone']);
    assert.strictEqual(z.name, undefined);
    assert.strictEqual(z.publicDesc, undefined);
}

// ── VDO.ninja stream ids ──────────────────────────────────────────────────────
// VDO.ninja rewrites every stream id to [A-Za-z0-9_] before publishing, so an id we
// push as `aria-gm-c2ac119b` is announced in the room as `aria_gm_c2ac119b`. What we
// push, advertise and view must already be in that form or the viewer asks for a
// stream nobody publishes and renders black — which is exactly what happened.
const cam = makeCamera({
    tag: '[TEST]', sidPrefix: 'aria_gm_', lockPrefix: 'x-', frameId: 'x',
    ownerId: () => 'c2ac119b-25ff-439d-a37c-721ce29bb86d',
    offKey: () => 'k', room: () => 'salle', password: () => 'pw',
});
assert.strictEqual(cam.streamId(), 'aria_gm_c2ac119b');
assert.strictEqual(cam.advertisedId(), 'aria_gm_c2ac119b');
// A peer on an older build still advertises hyphens; the viewer must normalise it
// rather than open a URL VDO.ninja will never match.
assert.ok(cam.viewSrc('aria-11b0286b').includes('view=aria_11b0286b'));
assert.ok(!cam.viewSrc('aria-11b0286b').includes('aria-11b0286b'));
// No room ⇒ nothing is published, so nothing is advertised.
const dark = makeCamera({ tag: '[TEST]', sidPrefix: 'aria_', lockPrefix: 'x-', frameId: 'x',
    ownerId: () => '11b0286b-09c0-4b93-82c2-c08116d09cae', offKey: () => 'k',
    room: () => '', password: () => '' });
assert.strictEqual(dark.streamId(), 'aria_11b0286b');
assert.strictEqual(dark.advertisedId(), '');

// -- Camera device selection ---------------------------------------------------
// VDO.ninja picks whatever camera Chrome hands it first, which on a machine running
// OBS is the OBS virtual camera. &videodevice pins it, matched against the label
// normalised the same way VDO.ninja's own normalizeDeviceLabel does.
{
    // Minimal fake push iframe. syncPushFrame only reads .src and sets .onload, and
    // the message handler checks e.source against .contentWindow.
    const frame = { src: '', onload: null, contentWindow: { posted: [], postMessage(m) { this.posted.push(m); } } };
    global.document = { getElementById: () => frame };
    const dcam = makeCamera({
        tag: '[TEST]', sidPrefix: 'aria_', lockPrefix: 'x-', frameId: 'x',
        ownerId: () => '11b0286b-09c0-4b93-82c2-c08116d09cae',
        offKey: () => 'off', room: () => 'salle', password: () => 'secret',
    });
    dcam.acquireLock();                     // no navigator.locks in node => sole owner
    assert.ok(dcam.lockHeld);
    dcam.syncPushFrame();
    assert.ok(frame.src.includes('push=aria_11b0286b'));
    assert.ok(!frame.src.includes('videodevice'), 'no device chosen => let VDO.ninja decide');

    // The push iframe answers getDeviceList with a flat array; only cameras with a
    // label are usable, since the label is what &videodevice matches on.
    const onMessage = _listeners.message[_listeners.message.length - 1];
    onMessage({ source: frame.contentWindow, data: { deviceList: [
        { kind: 'videoinput', label: 'OBS Virtual Camera' },
        { kind: 'audioinput', label: 'Microphone (USB)' },
        { kind: 'videoinput', label: 'HD Pro Webcam C920' },
        { kind: 'videoinput', label: '' },
    ] } });
    assert.deepStrictEqual(dcam.devices(), [
        { value: 'obs_virtual_camera', label: 'OBS Virtual Camera' },
        { value: 'hd_pro_webcam_c920', label: 'HD Pro Webcam C920' },
    ]);

    // Choosing one re-srcs the push frame with the pinned device, and it survives a
    // reload: the value is stored, not held in the page.
    dcam.setVideoDevice('hd_pro_webcam_c920');
    assert.ok(frame.src.includes('videodevice=hd_pro_webcam_c920'), frame.src);
    assert.strictEqual(localStorage.getItem('aria-camera-device'), 'hd_pro_webcam_c920');
    const reloaded = makeCamera({
        tag: '[TEST]', sidPrefix: 'aria_', lockPrefix: 'x-', frameId: 'x',
        ownerId: () => '11b0286b-09c0-4b93-82c2-c08116d09cae',
        offKey: () => 'off', room: () => 'salle', password: () => 'secret',
    });
    assert.strictEqual(reloaded.videoDevice, 'hd_pro_webcam_c920');
    assert.strictEqual(reloaded.devices().length, 2, 'device list is cached for the next load');

    // Back to automatic clears the param rather than pinning an empty device.
    dcam.setVideoDevice('');
    assert.ok(!frame.src.includes('videodevice'), frame.src);
    delete global.document;
}

// -- Chat thread ids ----------------------------------------------------------
// The whole private-chat design rests on both ends deriving the same thread id from
// their own point of view, with no roster and nothing agreed on first. If these two
// ever disagree, each side writes into a thread the other never reads.
{
    const mk = id => makeChat({ selfId: () => id, selfName: () => id, contacts: () => [] });
    const gm = mk('gm'), player = mk('abc-123');
    assert.strictEqual(gm.dmId('abc-123'), player.dmId('gm'));
    assert.strictEqual(gm.dmId('abc-123'), 'abc-123|gm');
    // A thread id carries both participants, so the Supabase read filter
    // (thread LIKE %self%) and the inbox routing both find it from either side.
    assert.ok(gm.dmId('abc-123').includes('gm') && player.dmId('gm').includes('abc-123'));
}

// join codes: 8 characters of the read-aloud alphabet, never one already used
{
    for (let i = 0; i < 200; i++) assert.match(generateJoinCode(), /^[A-HJ-NP-Z2-9]{8}$/);
    const first = generateJoinCode();
    assert.notStrictEqual(generateJoinCode(new Set([first])), first);
}

console.log('aria-shared self-check: all assertions passed');
