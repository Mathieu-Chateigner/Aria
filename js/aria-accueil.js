// ═══════════════════════════════════════════
//  ACCUEIL — le seuil (views/aria-accueil.html?camp=ID)
// ═══════════════════════════════════════════
// design_handoff_aria/Aria Accueil.dc.html: the per-campaign menu between the Hub
// and the Table, driven from the keyboard (↑↓ / z w s, Entrée / Espace, Échap).
//
//   Joueur: Entrer à la table · Ma fiche (aria-fiche.html) · Journal (aria-journal.html)
//           · Options · Retour à la taverne
//   MJ:     Lancer la séance · Préparer la séance · Joueurs & invitations · Options
//           · Retour à la taverne
//
// The role comes from the campaign (its GM is the account that owns it); the
// prototype's "Voir en" switch is not ported. The companions at the door are the
// campaign's presence set, observed without entering it. Options are this browser's
// own settings, the ones the Table reads: music volume, the camera kill switch and
// the microphone (table voice over VDO.ninja) — plus, for the GM, whether players'
// Fiche edits wait for validation (campaigns.sheet_approval). Sheets waiting show
// first in "Joueurs & invitations" and open the Fiche in review mode.
//
// Nodes are built once per screen and updated in place, so the menu's line and
// gem transitions play as in the prototype.

const $ = id => document.getElementById(id);
const S = {
    screen: 'menu', sel: 0, panel: null, slot: 0, opt: 0,
    camp: null, char: null, here: new Set(), slots: [],
};
const PARTY = ['#8fb3d9', '#eca456', '#d98f8f', '#b9c98a', '#c4a8e0', '#9fd1c4', '#d9c38f', '#d98fb8'];
const TIPS = [
    'Un critique au d20 déclenche l\'effet de la carte tirée — gardez un œil sur le talon.',
    'Ce que vous n\'avez pas découvert reste noir sur la carte. Le MJ, lui, voit tout.',
    'Glissez un panneau fermé sur un panneau ouvert pour les consulter côte à côte.',
    'Votre clé de sauvegarde suit votre personnage d\'un appareil à l\'autre.',
];
const LIST_PANELS = ['prep', 'players'];

const isGM = () => S.camp.role === 'MJ';
// Fiche / Journal / Hub keep ?demo (and ?camp) so a demo walk-through stays one.
const pageUrl = page => page + location.search;
const hubUrl = () => {
    const d = new URLSearchParams(location.search).get('demo');
    return 'aria-hub.html' + (d === null ? '' : '?demo' + (d ? '=' + d : ''));
};

function items() {
    return isGM() ? [
        { id: 'enter', label: 'Lancer la séance' },
        { id: 'prep', label: 'Préparer la séance' },
        { id: 'players', label: 'Joueurs & invitations' },
        { id: 'options', label: 'Options' },
        { id: 'back', label: 'Retour à la taverne' },
    ] : [
        { id: 'enter', label: 'Entrer à la table' },
        { id: 'sheet', label: 'Ma fiche de personnage' },
        { id: 'journal', label: 'Journal de campagne' },
        { id: 'options', label: 'Options' },
        { id: 'back', label: 'Retour à la taverne' },
    ];
}

// ── options: this browser's settings, as the Table reads them ───────────────
const camKey = () => isGM() ? 'aria-gm-camera-off-' + S.camp.id : S.char ? 'aria-camera-off-' + S.char.ch.id : null;
const OPT_APPROVAL = { id: 'approval', label: 'Validation des fiches', vals: ['Désactivée', 'Activée'], gm: true,
    get: () => S.camp.approval ? 1 : 0,
    set: v => { S.camp.approval = !!v; hubData.setApproval(S.camp, !!v); } };
const OPTS_ALL = [
    { id: 'music', label: 'Musique', bar: true,
      get: () => Math.round((+(localStorage.getItem('aria-music-volume') ?? 80) || 0) / 10),
      set: v => localStorage.setItem('aria-music-volume', String(v * 10)) },
    { id: 'cam', label: 'Caméra', vals: ['Désactivée', 'Activée'],
      get: () => camKey() && localStorage.getItem(camKey()) === '1' ? 0 : 1,
      set: v => { const k = camKey(); if (!k) return; if (v) localStorage.removeItem(k); else localStorage.setItem(k, '1'); } },
    { id: 'mic', label: 'Micro', vals: ['Désactivé', 'Activé'],
      get: () => localStorage.getItem('aria-mic') === '1' ? 1 : 0,
      set: v => localStorage.setItem('aria-mic', v ? '1' : '0') },
    OPT_APPROVAL,
];
let OPTS = OPTS_ALL;
function moveOpt(dir) {
    const d = OPTS[S.opt], v = d.get();
    d.set(d.bar ? Math.max(0, Math.min(10, v + dir)) : (v + dir + d.vals.length) % d.vals.length);
    update();
}

// ── list panels ─────────────────────────────────────────────────────────────
const names = list => list.slice(0, 3).join(' · ') + (list.length > 3 ? '…' : '');
async function slotData(p) {
    const k = S.camp;
    if (p === 'prep') {
        const r = await hubData.prep(k);
        return [
            { name: 'Cartes', meta: names(r.maps) || 'Aucune carte', stat: String(r.maps.length), when: r.maps.length > 1 ? 'prêtes' : 'prête' },
            { name: 'Monstres', meta: names(r.monsters) || 'Aucun adversaire', stat: String(r.monsters.length), when: 'préparés' },
            { name: 'Documents', meta: names(r.files) || 'Rien à partager', stat: String(r.files.length), when: 'à partager' },
            { name: 'Ambiance', meta: names(r.music) || 'Aucune piste', stat: String(r.music.length), when: 'pistes' },
        ];
    }
    if (p === 'players') {
        const [r, sheets] = await Promise.all([hubData.roster(k), hubData.pendingSheets(k)]);
        return sheets.map(x => ({ name: x.name || '—', meta: 'Fiche à valider', stat: 'Voir →', when: '',
                                  go: 'aria-fiche.html' + location.search + '&char=' + encodeURIComponent(x.id) }))
            .concat(r.map(x => ({ name: x.name, meta: 'Joueur', stat: S.here.has(x.id) ? 'À la porte' : 'Absent', when: '' })))
            .concat(k.code ? [{ name: 'Code d\'invitation', meta: 'À partager avec un nouveau joueur', stat: k.code, when: '', copy: k.code }] : [])
            .concat(k.taken < k.seats ? [{ name: 'Places libres', meta: 'Visibles dans Explorer', stat: String(k.seats - k.taken), when: '' }] : []);
    }
    return [];
}

// ── navigation ──────────────────────────────────────────────────────────────
function openItem(i) {
    const it = items()[i];
    if (it.id === 'back') return location.assign(hubUrl());
    if (it.id === 'enter') return enter();
    if (it.id === 'sheet') return location.assign(pageUrl('aria-fiche.html'));
    if (it.id === 'journal') return location.assign(pageUrl('aria-journal.html'));
    Object.assign(S, { sel: i, screen: 'panel', panel: it.id, slot: 0, opt: 0, slots: [] });
    buildPanel();
    if (LIST_PANELS.includes(it.id)) slotData(it.id).then(s => { if (S.panel === it.id) { S.slots = s; buildPanel(); } });
}
function goBack() {
    if (S.screen !== 'panel') return;
    Object.assign(S, { screen: 'menu', panel: null });
    update();
}

function enter() {
    const k = S.camp, n = k.session || 1;
    S.screen = 'loading';
    $('ac-load-kicker').textContent = isGM() ? 'Ouverture de la séance ' + n : 'Entrée à la table · séance ' + n;
    $('ac-load-title').textContent = k.name;
    $('ac-load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    $('ac-load').hidden = false;
    let load = 0;
    const iv = setInterval(() => {
        load = Math.min(1, load + 0.014 + Math.random() * 0.02);
        $('ac-load-fill').style.width = Math.round(load * 100) + '%';
        if (load < 1) return;
        clearInterval(iv);
        setTimeout(() => {
            if (hubData.demo) { S.screen = 'menu'; $('ac-load').hidden = true; $('ac-load-fill').style.width = '0'; update(); return; }
            location.assign(hubTableUrl(k, S.char && S.char.ch.id));
        }, 500);
    }, 60);
}

// ── rendering ───────────────────────────────────────────────────────────────
function svg(tag, attrs, ...kids) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v);
    kids.forEach(k => n.append(k));
    return n;
}
function mate(c, lit) {
    const eye = lit ? c : '#1a120c';
    return el('div', { className: 'ac-mate', style: { opacity: lit ? 1 : 0.35 } },
        el('div', { className: 'ac-mate-frame', style: { borderColor: c } },
            svg('svg', { viewBox: '0 0 40 40', width: 30, height: 30 },
                svg('path', { d: 'M1 41 C3 32 10 29 14 28 L26 28 C30 29 37 32 39 41 Z', fill: '#22150c' }),
                svg('path', { d: 'M20 5 C13 5 9.5 11 9.5 18 C9.5 23 11.5 27 14 30 L26 30 C28.5 27 30.5 23 30.5 18 C30.5 11 27 5 20 5 Z', fill: '#3a2616', stroke: c, 'stroke-width': '.8', 'stroke-opacity': '.7' }),
                svg('path', { d: 'M20 11.5 C16 11.5 14.5 15.5 14.5 19.5 C14.5 23.5 17 27 20 27 C23 27 25.5 23.5 25.5 19.5 C25.5 15.5 24 11.5 20 11.5 Z', fill: '#070403' }),
                svg('ellipse', { cx: '17.6', cy: '19.6', rx: '1.4', ry: '.85', fill: eye }),
                svg('ellipse', { cx: '22.4', cy: '19.6', rx: '1.4', ry: '.85', fill: eye }))));
}

// GM first, then one seat per player at the table; lit = in the presence set.
function renderParty() {
    const k = S.camp, n = k.taken + 1;
    const gmHere = [...S.here].some(id => id.startsWith('gm-'));
    const arr = Math.min(n, (gmHere ? 1 : 0) + [...S.here].filter(id => !id.startsWith('gm-')).length);
    fill($('ac-party-row'), Array.from({ length: n }, (_, i) => mate(PARTY[i % PARTY.length], i < arr)));
    $('ac-party-label').textContent = arr + ' / ' + n + ' à la porte' + (arr > 0 ? ' · MJ ' + (isGM() ? 'vous' : k.gm) : '');
}

function buildMenu() {
    fill($('ac-menu'), items().map((it, i) => el('div', {
        className: 'ac-item',
        onmouseenter: () => { if (S.sel !== i) { S.sel = i; update(); } },
        onclick: e => { e.stopPropagation(); openItem(i); },
    }, el('div', { className: 'ac-item-row' },
        el('div', { className: 'ac-item-line l' }), el('div', { className: 'ac-item-mark' }),
        el('div', { className: 'ac-item-label', textContent: it.label }),
        el('div', { className: 'ac-item-mark' }), el('div', { className: 'ac-item-line r' })))));
}

const TITLES = { prep: 'Préparer la séance', players: 'Joueurs & invitations', options: 'Options' };
function buildPanel() {
    $('ac-panel-title').textContent = TITLES[S.panel] || '';
    if (S.panel === 'options') {
        fill($('ac-panel-body'), el('div', { className: 'ac-opts' }, OPTS.map((d, i) => el('div', {
            className: 'ac-opt', onmouseenter: () => { if (S.opt !== i) { S.opt = i; update(); } },
        }, el('div', { className: 'ac-opt-label', textContent: d.label }),
            el('div', { className: 'ac-opt-arrow', textContent: '◀', onclick: () => { S.opt = i; moveOpt(-1); } }),
            el('div', { className: 'ac-opt-val' }, d.bar
                ? Array.from({ length: 10 }, () => el('div', { className: 'ac-tick' }))
                : el('div', { className: 'ac-opt-text' })),
            el('div', { className: 'ac-opt-arrow', textContent: '▶', onclick: () => { S.opt = i; moveOpt(1); } })))));
    } else {
        fill($('ac-panel-body'), el('div', { className: 'ac-slots' }, S.slots.map((s, i) => el('div', {
            className: 'ac-slot',
            onmouseenter: () => { if (S.slot !== i) { S.slot = i; update(); } },
            onclick: () => { if (s.go) return location.assign(s.go); S.slot = i; update(); if (s.copy && navigator.clipboard) navigator.clipboard.writeText(s.copy).catch(() => {}); },
        }, el('div', { className: 'ac-slot-num', textContent: String(i + 1).padStart(2, '0') }),
            el('div', { className: 'ac-slot-body' },
                el('div', { className: 'ac-slot-name', textContent: s.name }),
                el('div', { className: 'ac-slot-meta', textContent: s.meta })),
            el('div', { className: 'ac-slot-end' },
                el('div', { className: 'ac-slot-stat', textContent: s.stat }),
                el('div', { className: 'ac-slot-when', textContent: s.when }))))));
    }
    update();
}

function update() {
    const menu = S.screen === 'menu', panel = S.screen === 'panel';
    $('ac-menu').hidden = $('ac-party').hidden = !menu;
    $('ac-panel').hidden = !panel;
    [...$('ac-menu').children].forEach((n, i) => n.classList.toggle('on', i === S.sel));
    if (!panel) return;
    if (S.panel === 'options') {
        [...$('ac-panel-body').firstChild.children].forEach((row, i) => {
            const d = OPTS[i], v = d.get();
            row.classList.toggle('on', i === S.opt);
            if (d.bar) [...row.querySelectorAll('.ac-tick')].forEach((t, j) => t.classList.toggle('full', j < v));
            else row.querySelector('.ac-opt-text').textContent = d.vals[v];
        });
    } else {
        [...$('ac-panel-body').firstChild.children].forEach((n, i) => n.classList.toggle('on', i === S.slot));
    }
}

// ── keyboard (the prototype's onKey) ────────────────────────────────────────
function onKey(e) {
    if (S.screen === 'loading') return;
    const k = e.key;
    if (k === 'Escape') { e.preventDefault(); goBack(); return; }
    if (S.screen === 'menu') {
        const n = items().length;
        if (k === 'ArrowDown' || k === 's') { e.preventDefault(); S.sel = (S.sel + 1) % n; update(); }
        else if (k === 'ArrowUp' || k === 'z' || k === 'w') { e.preventDefault(); S.sel = (S.sel - 1 + n) % n; update(); }
        else if (k === 'Enter' || k === ' ') { e.preventDefault(); openItem(S.sel); }
        return;
    }
    if (LIST_PANELS.includes(S.panel)) {
        const n = S.slots.length;
        if (!n) return;
        if (k === 'ArrowDown') { e.preventDefault(); S.slot = (S.slot + 1) % n; update(); }
        else if (k === 'ArrowUp') { e.preventDefault(); S.slot = (S.slot - 1 + n) % n; update(); }
    } else if (S.panel === 'options') {
        const n = OPTS.length;
        if (k === 'ArrowDown') { e.preventDefault(); S.opt = (S.opt + 1) % n; update(); }
        else if (k === 'ArrowUp') { e.preventDefault(); S.opt = (S.opt - 1 + n) % n; update(); }
        else if (k === 'ArrowLeft') { e.preventDefault(); moveOpt(-1); }
        else if (k === 'ArrowRight') { e.preventDefault(); moveOpt(1); }
    }
}

// The UI shares the stone stage's cover scale.
function fit() {
    const k = Math.max(innerWidth / 1600, innerHeight / 960);
    if (k) $('ac-ui').style.transform = 'translate(-50%,-50%) scale(' + k + ')';
}

// ── boot ────────────────────────────────────────────────────────────────────
(async () => {
    if (!hubData.demo && !sbSignedIn()) { location.replace('../index.html'); return; }
    const id = new URLSearchParams(location.search).get('camp');
    S.camp = id && await hubData.camp(id);
    if (!S.camp) { location.replace(hubUrl()); return; }
    S.char = await hubData.character(S.camp);

    const k = S.camp, when = k.next == null ? 'séance à fixer' : k.next === 0 ? 'ce soir' : k.next === 1 ? 'demain' : 'dans ' + k.next + ' jours';
    document.title = 'ARIA — ' + k.name;
    $('ac-root').classList.toggle('mj', isGM());
    OPTS = OPTS_ALL.filter(d => !d.gm || isGM());
    $('ac-kicker').textContent = 'Séance ' + (k.session || 1) + ' · ' + when + (k.hour ? ' · ' + k.hour.replace(':', 'h') : '');
    $('ac-name').textContent = k.name;
    $('ac-back').onclick = () => location.assign(hubUrl());
    $('ac-panel-back').onclick = goBack;
    $('ac-panel').onclick = e => e.stopPropagation();

    ariaBg.mount('arch', $('ac-root'));
    fit();
    addEventListener('resize', fit);
    addEventListener('keydown', onKey);
    window.addEventListener('storage', e => { if (e.key === 'aria-session' && !e.newValue && !hubData.demo) location.assign('../index.html'); });

    buildMenu();
    renderParty();
    update();
    hubData.presence(k, S.char, here => {
        S.here = here;
        renderParty();
        if (S.panel === 'players') slotData('players').then(s => { if (S.panel === 'players') { S.slots = s; buildPanel(); } });
    });
})();
