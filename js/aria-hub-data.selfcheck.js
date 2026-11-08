// Self-check for the date logic in aria-hub-data.js — when a table's next sitting
// is, which the Hub shows everywhere (hero, "Dans N jours", day badges):
//
//     node js/aria-hub-data.selfcheck.js
const assert = require('assert');
const fs = require('fs');

global.location = { search: '' };
const { hubNextStart, hubDayDiff, hubIsBeginner, hubJournal, hubConvs, hubMsgTime } =
    new Function(fs.readFileSync(__dirname + '/aria-hub-data.js', 'utf8') + '\nreturn { hubNextStart, hubDayDiff, hubIsBeginner, hubJournal, hubConvs, hubMsgTime };')();

const H = 3600e3, D = 24 * H, now = Date.parse('2026-10-02T12:00:00');

// no first session, nothing planned
assert.strictEqual(hubNextStart(null, 'weekly', now), null);

// a one-shot is its own date, then gone once it has run
const once = Date.parse('2026-10-05T20:30:00');
assert.strictEqual(hubNextStart(once, 'once', now), once);
assert.strictEqual(hubNextStart(Date.parse('2026-09-01T20:30:00'), 'once', now), null);
// still "tonight" while it runs (180 min)
assert.strictEqual(hubNextStart(now - H, 'once', now), now - H);

// a past recurring series rolls forward, same local hour and weekday
for (const rec of ['weekly', 'biweekly', 'monthly']) {
    const first = Date.parse('2026-01-02T20:30:00');
    const next = new Date(hubNextStart(first, rec, now));
    assert.ok(next.getTime() + 3 * H >= now, rec + ': still in the past');
    assert.ok(next.getTime() - now <= (rec === 'monthly' ? 32 : rec === 'biweekly' ? 14 : 7) * D, rec + ': skipped a sitting');
    assert.strictEqual(next.getHours(), 20, rec + ': local hour moved (DST)');
    assert.strictEqual(next.getMinutes(), 30);
    if (rec === 'monthly') assert.strictEqual(next.getDate(), 2);
    else assert.strictEqual(next.getDay(), new Date(first).getDay());
}

// day difference counts calendar days, not 24h blocks
assert.strictEqual(hubDayDiff(Date.parse('2026-10-02T23:59:00'), now), 0);
assert.strictEqual(hubDayDiff(Date.parse('2026-10-03T00:01:00'), now), 1);

assert.ok(hubIsBeginner(['Horreur', 'Débutants bienvenus']));
assert.ok(hubIsBeginner(['debutants']));
assert.ok(!hubIsBeginner(['Horreur']));

// the Journal: one session per calendar day with notes, oldest first, titled by its first note
const note = (title, iso) => ({ title, body: '', ts: Date.parse(iso) });
const j = hubJournal([note('c', '2026-09-20T22:00:00'), note('a', '2026-09-13T21:00:00'), note('b', '2026-09-13T23:30:00')]);
assert.deepStrictEqual(j.map(s => [s.n, s.title, s.notes.length]), [[1, 'a', 2], [2, 'c', 1]]);
assert.deepStrictEqual(hubJournal([]), []);

// messages: one conversation per other account, oldest first; unread = theirs, after the last read
const m = (other, mine, iso, body) => ({ other, other_name: other.toUpperCase(), mine, camp_name: 'Valmir', body, created_at: iso });
const cv = hubConvs([m('b', false, '2026-10-02T11:00:00', 'z'), m('a', true, '2026-10-01T10:00:00', 'x'), m('a', false, '2026-10-02T09:00:00', 'y')],
                    { a: Date.parse('2026-10-01T12:00:00') }, now);
assert.deepStrictEqual(cv.a.msgs.map(x => x.text), ['x', 'y']);
assert.strictEqual(cv.a.unread, 1);            // 'y' came after the last read
assert.strictEqual(cv.b.unread, 1);            // never read
assert.strictEqual(cv.a.who, 'A');
assert.strictEqual(hubMsgTime(Date.parse('2026-10-02T09:05:00'), now), '09:05');
assert.strictEqual(hubMsgTime(Date.parse('2026-10-01T23:00:00'), now), 'Hier');

console.log('aria-hub-data selfcheck: ok');
