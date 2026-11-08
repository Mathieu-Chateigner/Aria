// ═══════════════════════════════════════════
//  JOURNAL — campaign journal (views/aria-journal.html?camp=ID)
// ═══════════════════════════════════════════
// design_handoff_aria/Aria Journal.dc.html: one session per page, newest first in
// the index, "← Session précédente" / "Session suivante →", and a search over every
// note (case- and accent-insensitive, matches highlighted).
//
// Sessions come from hubData.journal() — journal_notes(): the reader's own notes and
// the ones the table shared (a note's "Partagée" toggle in the panels' Notes tab),
// GM notes signed 'MJ', grouped by the day they were written (see hubJournal).

const $ = id => document.getElementById(id);
const J = { D: [], cur: 0, q: '' };
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// A paragraph with every match of q (already normalised) highlighted.
function para(text, q) {
    const p = el('div', { className: 'jr-p' });
    if (!q) { p.textContent = text; return p; }
    const nt = norm(text);
    let i = 0, j;
    while ((j = nt.indexOf(q, i)) !== -1) {
        if (j > i) p.append(text.slice(i, j));
        p.append(el('mark', { textContent: text.slice(j, j + q.length) }));
        i = j + q.length;
    }
    if (i < text.length) p.append(text.slice(i));
    return p;
}

function goSession(i) { J.cur = i; J.q = ''; $('jr-q').value = ''; render(); $('jr-root').scrollTo(0, 0); }

function noteEl(n, s, q, showSession) {
    return el('div', { className: 'jr-note' },
        el('div', { className: 'jr-note-meta' },
            showSession && el('div', { className: 'jr-meta goto', textContent: 'Session ' + s.n + ' →', onclick: () => goSession(J.D.indexOf(s)) }),
            el('div', { className: 'jr-meta by' + (n.by === 'me' ? ' me' : ''), textContent: n.by === 'me' ? 'Moi' : n.by }),
            el('div', { className: 'jr-meta', textContent: n.shared ? 'Partagée' : 'Privée' })),
        el('div', { className: 'jr-note-t', textContent: n.title }),
        el('div', { className: 'jr-note-ps' }, n.body.split(/\n\s*\n/).map(t => para(t, q))));
}

function render() {
    const D = J.D, q = norm(J.q).trim();
    const match = n => !q || norm(n.title + ' ' + n.body).includes(q);
    const idxs = D.map((_, i) => i).reverse();   // order 'récent'
    $('jr-q-x').hidden = !J.q;

    fill($('jr-sessions'), idxs.map(i => {
        const s = D[i], k = s.notes.filter(match).length;
        return el('div', {
            className: 'jr-ses' + (!q && i === J.cur ? ' on' : '') + (q && !k ? ' miss' : '') + (q && k ? ' hit' : ''),
            onclick: () => goSession(i),
        }, el('div', { className: 'jr-ses-n', textContent: String(s.n) }),
            el('div', { className: 'jr-ses-mid' },
                el('div', { className: 'jr-ses-t', textContent: s.title }),
                el('div', { className: 'jr-ses-d', textContent: s.date })),
            el('div', { className: 'jr-ses-c', textContent: String(k || '—') }));
    }));

    const cur = D[J.cur];
    let notes;
    if (q) { notes = []; idxs.forEach(i => D[i].notes.filter(match).forEach(n => notes.push(noteEl(n, D[i], q, true)))); }
    else notes = cur ? cur.notes.map(n => noteEl(n, cur, '', false)) : [];

    const nav = (i, cls, k) => {
        const ok = i >= 0 && i < D.length;
        return el('div', { className: 'jr-nav-b ' + cls + (ok ? '' : ' off'), onclick: () => { if (ok) goSession(i); } },
            el('div', { className: 'jr-nav-k', textContent: k }),
            el('div', { className: 'jr-nav-l', textContent: ok ? D[i].n + ' · ' + D[i].title : '—' }));
    };
    const empty = q ? 'Aucune note ne mentionne « ' + J.q.trim() + ' ».'
                : cur ? 'Aucune note pour ce filtre dans cette session.'
                : 'Aucune note pour l’instant. Celles que vous prenez à la table apparaîtront ici.';

    fill($('jr-page'),
        !q && cur && el('div', { className: 'jr-head' },
            el('div', { className: 'jr-head-k' },
                el('div', { className: 'jr-kicker', textContent: 'Session ' + cur.n }),
                J.cur === D.length - 1 && el('div', { className: 'jr-last', textContent: 'Dernière' })),
            el('div', { className: 'jr-title', textContent: cur.title }),
            el('div', { className: 'jr-date', textContent: cur.date + (cur.present ? ' · ' + cur.present : '') })),
        q && el('div', { className: 'jr-shead' },
            el('div', { className: 'jr-kicker', textContent: 'Recherche' }),
            el('div', { className: 'jr-stitle', textContent: notes.length + (notes.length > 1 ? ' notes' : ' note') + ' pour « ' + J.q.trim() + ' »' })),
        notes,
        !notes.length && el('div', { className: 'jr-empty', textContent: empty }),
        !q && cur && el('div', { className: 'jr-nav' },
            nav(J.cur - 1, 'prev', '← Session précédente'),
            nav(J.cur + 1, 'next', 'Session suivante →')));
}

(async () => {
    if (!hubData.demo && !sbSignedIn()) { location.replace('../index.html'); return; }
    const id = new URLSearchParams(location.search).get('camp');
    const camp = id && await hubData.camp(id);
    if (!camp) { location.replace('aria-hub.html'); return; }
    J.D = await hubData.journal(camp);
    J.cur = J.D.length - 1;

    $('jr-back').href = 'aria-accueil.html' + location.search;
    $('jr-back').textContent = '← ' + camp.name;
    $('jr-q').oninput = e => { J.q = e.target.value; render(); };
    $('jr-q').onkeydown = e => { if (e.key === 'Escape') { J.q = ''; e.target.value = ''; render(); } };
    $('jr-q-x').onclick = () => { J.q = ''; $('jr-q').value = ''; render(); };
    ariaBg.mount('desk', $('jr-root'));
    render();
})();
