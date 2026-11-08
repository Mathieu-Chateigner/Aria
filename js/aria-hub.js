// ═══════════════════════════════════════════
//  HUB — la taverne (views/aria-hub.html)
// ═══════════════════════════════════════════
// design_handoff_aria/Aria Hub.dc.html: your tables, the open tables, forging a
// campaign, and talking to GMs. Data comes from js/aria-hub-data.js (`hubData`).
//
// Rendering follows the prototype's renderVals(): state → DOM, whole sections at a
// time, built with el(). Text fields are created once and never rebuilt, so typing
// never loses the caret; what they drive (search results, the live preview) is
// re-rendered beside them.

const hub = {
    tab: 'mine', q: '', filter: 'all', modal: null, chat: null, typing: false, toast: null, drag: false,
    pick: null,                       // { campId } while choosing a character to sit with
    me: { name: '' }, camps: [], requests: [], convs: {}, friends: [], ready: true,
    f: { name: '', pitch: '', vis: 'public', seats: 4, rhythm: 'Hebdomadaire', date: '', tags: '', cover: '', coverBlob: null },
};

const VIS = {
    public:  { label: 'Publique',       c: 'var(--moss)',     desc: 'Visible, on rejoint librement.' },
    demande: { label: 'Sur demande',    c: 'var(--ember)',    desc: 'Visible, le MJ valide chaque joueur.' },
    prive:   { label: 'Privée · sceau', c: 'var(--hb-seal)',  desc: 'Invisible, accès par code.' },
};
const RHY = ['Hebdomadaire', 'Toutes les 2 semaines', 'Mensuelle', 'One-shot'];
// The handoff's avatar colours by name; anyone else gets one by hash.
const PAL = { 'Élise': '#8fb3d9', 'Aldric': '#eca456', 'Tomas': '#b9c98a', 'Maëlle': '#d98f8f', 'Iris': '#c4a8e0', 'Jonas': '#9fd1c4', 'Soren': '#d9c38f', 'Brune': '#d98fb8', 'Oskar': '#a8b8e0', 'Nox': '#c4a8e0', 'Célian': '#9fd1c4' };
const PAL_LIST = [...new Set(Object.values(PAL))];
const DOT = { on: 'var(--hb-online)', play: 'var(--ember)', off: 'var(--hb-offline)' };
const TOAST = { ok: 'var(--moss)', wait: 'var(--ember)', err: 'var(--bad-soft)' };

const $ = id => document.getElementById(id);
const pal = n => PAL[n] || PAL_LIST[[...(n || '')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % PAL_LIST.length] || 'var(--text-3)';
const campById = id => hub.camps.find(k => k.id === id);
const plural = (n, one, many) => n + (n > 1 ? many : one);

// ── formatting (the prototype's inLabel / dateOf / fmt / status) ────────────
function inLabel(n) { return n == null ? 'À fixer' : n === 0 ? 'Ce soir' : n === 1 ? 'Demain' : 'Dans ' + n + ' jours'; }
function dateOf(n) { const d = new Date(); d.setDate(d.getDate() + n); return d; }
function fmt(k) {
    if (k.next == null) return 'Aucune séance prévue';
    const s = dateOf(k.next).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1) + (k.hour ? ' · ' + k.hour.replace(':', 'h') : '');
}
function campStatus(k) {
    if (k.role) return { t: 'À votre table', c: 'var(--ember)' };
    if (k.pending) return { t: 'Demande en attente', c: 'var(--ember)' };
    const free = k.seats - k.taken;
    return free <= 0 ? { t: 'Complet', c: 'var(--bad-soft)' } : { t: plural(free, ' place libre', ' places libres'), c: 'var(--moss)' };
}
function tagList(s) { return s.split(',').map(t => t.trim()).filter(Boolean).slice(0, 4); }
function dayDiff(d) { return hubDayDiff(d.getTime()); }
function now() { return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }

// ── covers: generated per name when none was uploaded (prototype's coverFor) ─
const _covers = {};
function coverFor(name) {
    const key = name || '';
    if (_covers[key]) return _covers[key];
    const W = 1200, H = 525, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    let h = 7; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    let sd = h || 1; const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; }; const rr = (x, y) => x + rnd() * (y - x);
    const hue = [24, 205, 356, 150, 262, 38][h % 6], cx = W / 2, hz = H * 0.66;
    let g = c.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, 'hsl(' + hue + ',32%,5%)'); g.addColorStop(0.7, 'hsl(' + hue + ',30%,11%)'); g.addColorStop(1, 'hsl(' + (hue + 12) + ',40%,19%)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) { const r = rr(0.5, 1.8); c.fillStyle = 'rgba(240,232,214,' + rr(0.12, 0.7).toFixed(2) + ')'; c.fillRect(rr(0, W), rr(0, hz * 0.8), r, r); }
    const mx = cx + rr(-1, 1) * 330, my = rr(95, 160), mr = rr(38, 56);
    g = c.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 5); g.addColorStop(0, 'rgba(236,190,130,.28)'); g.addColorStop(1, 'rgba(236,190,130,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f1e2c2'; c.beginPath(); c.arc(mx, my, mr, 0, 6.283); c.fill();
    c.fillStyle = 'hsl(' + hue + ',30%,8%)'; c.beginPath(); c.arc(mx + mr * rr(0.35, 0.6), my - mr * 0.15, mr * 0.92, 0, 6.283); c.fill();
    const ridge = (base, amp, col, rough) => {
        c.beginPath(); c.moveTo(0, H); let y = base;
        for (let x = 0; x <= W; x += 12) { y += rr(-rough, rough); y += (base - y) * 0.08; const pk = Math.sin(x / W * Math.PI * rr(1.6, 1.7) + h % 7) * amp; c.lineTo(x, y - pk); }
        c.lineTo(W, H); c.closePath(); c.fillStyle = col; c.fill();
    };
    ridge(hz - 40, 60, 'hsl(' + hue + ',22%,10%)', 7);
    g = c.createLinearGradient(0, hz - 60, 0, hz + 30); g.addColorStop(0, 'rgba(200,170,140,0)'); g.addColorStop(0.6, 'rgba(200,170,140,.1)'); g.addColorStop(1, 'rgba(200,170,140,0)'); c.fillStyle = g; c.fillRect(0, hz - 60, W, 90);
    const side = mx < cx ? 1 : -1, tx = cx + side * W * 0.2, hillTop = hz - 6;
    ridge(hz + 24, 26, 'hsl(' + hue + ',20%,6.5%)', 5);
    c.fillStyle = 'hsl(' + hue + ',20%,5%)'; c.beginPath(); c.moveTo(tx - 330, H);
    c.bezierCurveTo(tx - 250, hz + 70, tx - 110, hillTop, tx - 40, hillTop);
    c.lineTo(tx + 40, hillTop);
    c.bezierCurveTo(tx + 110, hillTop, tx + 250, hz + 70, tx + 330, H); c.closePath(); c.fill();
    const tw = 30, th = rr(150, 180), tb = hillTop + 2;
    c.fillStyle = '#060403';
    c.beginPath(); c.moveTo(tx - tw, tb); c.lineTo(tx - tw * 0.84, tb - th); c.lineTo(tx + tw * 0.84, tb - th); c.lineTo(tx + tw, tb); c.closePath(); c.fill();
    c.fillRect(tx - tw * 1.05, tb - th - 4, tw * 2.1, 8);
    for (let i = -2; i <= 2; i++) c.fillRect(tx + i * tw * 0.42 - 5, tb - th - 18, 10, 16);
    const wd = -side, wx0 = tx + wd * tw * 0.9;
    c.beginPath(); c.moveTo(wx0, tb - 46);
    for (let k = 0; k <= 6; k++) { const x = wx0 + wd * k * 18, y = tb - 46 + k * 6; c.lineTo(x, y); if (k < 6) { c.lineTo(x, y - 8); c.lineTo(x + wd * 9, y - 8); c.lineTo(x + wd * 9, y); } }
    c.lineTo(wx0 + wd * 108, tb + 30); c.lineTo(wx0, tb + 30); c.closePath(); c.fill();
    const win = (x, y, w, hh) => { c.save(); c.globalCompositeOperation = 'lighter'; g = c.createRadialGradient(x, y, 0, x, y, 40); g.addColorStop(0, 'rgba(255,170,80,.5)'); g.addColorStop(1, 'rgba(255,170,80,0)'); c.fillStyle = g; c.fillRect(x - 40, y - 40, 80, 80); c.restore(); c.fillStyle = '#ffc070'; c.fillRect(x - w / 2, y - hh / 2, w, hh); };
    win(tx, tb - th * 0.74, 6, 13); win(tx, tb - th * 0.4, 6, 10);
    c.fillStyle = '#040302'; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) c.lineTo(x, H - 50 - Math.sin(x * 0.006 + h) * 14 - rr(0, 6));
    c.lineTo(W, H); c.closePath(); c.fill();
    for (let i = 0; i < 9; i++) { const px = rr(0, W), ph = rr(60, 150), pw = ph * 0.22; c.beginPath(); c.moveTo(px, H - 40 - ph); c.lineTo(px + pw, H - 40); c.lineTo(px - pw, H - 40); c.closePath(); c.fill(); }
    const bx = cx - side * rr(20, 120), by = rr(110, 170);
    c.strokeStyle = 'rgba(8,6,4,.85)'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const x = bx + rr(-70, 70), y = by + rr(-30, 30), sz = rr(5, 9); c.beginPath(); c.moveTo(x - sz, y - sz * 0.3); c.quadraticCurveTo(x - sz * 0.4, y - sz * 0.6, x, y); c.quadraticCurveTo(x + sz * 0.4, y - sz * 0.6, x + sz, y - sz * 0.3); c.stroke(); }
    g = c.createRadialGradient(cx, H * 0.55, 180, cx, H * 0.55, 720); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.72)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    return (_covers[key] = cv.toDataURL('image/jpeg', 0.85));
}
const coverUrl = k => k.cover || coverFor(k.name);
const bgUrl = u => 'url("' + u + '")';

// ── small builders ──
// The hooded figure every person is drawn as. `col` comes from PAL, never from data.
function avatar(size, col, dot, corner = 6) {
    const svg = '<svg viewBox="0 0 40 40" width="' + size + '" height="' + size + '">'
        + '<path d="M1 41 C3 32 10 29 14 28 L26 28 C30 29 37 32 39 41 Z" fill="#22150c"></path>'
        + '<path d="M20 5 C13 5 9.5 11 9.5 18 C9.5 23 11.5 27 14 30 L26 30 C28.5 27 30.5 23 30.5 18 C30.5 11 27 5 20 5 Z" fill="#3a2616" stroke="' + col + '" stroke-width=".8" stroke-opacity=".7"></path>'
        + '<path d="M20 11.5 C16 11.5 14.5 15.5 14.5 19.5 C14.5 23.5 17 27 20 27 C23 27 25.5 23.5 25.5 19.5 C25.5 15.5 24 11.5 20 11.5 Z" fill="#070403"></path>'
        + '<ellipse cx="17.6" cy="19.6" rx="1.4" ry=".85" fill="' + col + '"></ellipse><ellipse cx="22.4" cy="19.6" rx="1.4" ry=".85" fill="' + col + '"></ellipse></svg>';
    return el('div', { className: 'hb-av', style: { width: size + 'px', height: size + 'px' } },
        el('div', { className: 'hb-av-frame', style: { borderColor: col, boxShadow: size >= 32 ? 'inset 0 0 10px rgba(0,0,0,.8)' : '' }, innerHTML: svg }),
        el('div', { className: 'hb-av-corner', style: { width: corner + 'px', height: corner + 'px', borderColor: col } }),
        dot && el('div', { className: 'hb-av-dot', style: { background: dot, width: (size <= 32 ? 9 : 10) + 'px', height: (size <= 32 ? 9 : 10) + 'px' } }));
}
const tagsRow = (tags, beginner) => el('div', { className: 'hb-tags' },
    beginner && el('div', { className: 'hb-tag-beg', textContent: 'Débutants bienvenus' }),
    tags.map(t => el('div', { className: 'hb-tag', textContent: t })));
const micro = (text, color, cls = 'hb-micro') => el('div', { className: cls, textContent: text, style: { color } });
const btn = (cls, text, onclick) => el('div', { className: cls, textContent: text, onclick });

function flash(text, tone) {
    clearTimeout(flash._t);
    hub.toast = { text, tone };
    renderToast();
    flash._t = setTimeout(() => { hub.toast = null; renderToast(); }, 3200);
}

// ── render ─────────────────────────────────────────────────────────────────
function render() {
    renderTabs();
    $('hb-mine').hidden = hub.tab !== 'mine';
    $('hb-explore').hidden = hub.tab !== 'explore';
    $('hb-create').hidden = hub.tab !== 'create';
    if (hub.tab === 'mine') renderMine();
    if (hub.tab === 'explore') renderBrowse();
    if (hub.tab === 'create') renderCreate();
    renderAside();
    renderModal();
}

const mineRaw = () => hub.camps.filter(k => k.role).sort((a, b) => (a.next ?? 1e9) - (b.next ?? 1e9));
const visible = k => k.vis !== 'prive' && !(k.role === 'MJ');

function renderTabs() {
    const tabs = [['mine', 'Mes tables', mineRaw().length], ['explore', 'Explorer', null], ['create', 'Créer', null]];
    fill($('hb-nav'), tabs.map(([id, label, count]) => el('div', {
        className: 'hb-tab' + (hub.tab === id ? ' on' : ''), onclick: () => { hub.tab = id; render(); } },
        el('span', { textContent: label }),
        count != null && el('span', { className: 'hb-tab-count', textContent: count }))));
}

function enterCamp(k) {
    const url = hubData.entryUrl(k);
    if (url) location.assign(url);
    else flash('Entrée dans « ' + k.name + ' » (démo).', 'wait');
}

function renderMine() {
    const mine = mineRaw(), empty = mine.length === 0;
    $('hb-mine-head').hidden = empty;
    $('hb-welcome').hidden = !empty;
    const nextMine = mine.find(k => k.next != null);
    $('hb-mine-sub').textContent = mine.length + (mine.length > 1 ? ' tables' : ' table') + (nextMine ? ' · prochaine séance ' + inLabel(nextMine.next).toLowerCase() : '');

    // first steps + the beginner suggestion
    $('hb-beg-count').textContent = hub.camps.filter(k => k.beginner && !k.role && k.vis !== 'prive' && k.seats > k.taken).length;
    const sug = hub.camps.filter(k => k.beginner && !k.role && !k.pending && k.vis !== 'prive' && k.seats > k.taken && k.next != null).sort((a, b) => a.next - b.next)[0];
    const sugBox = $('hb-sug');
    sugBox.hidden = !empty || !sug;
    if (empty && sug) {
        const free = sug.seats - sug.taken;
        fill(sugBox,
            el('div', { className: 'hb-label', textContent: 'Une place vous attend bientôt' }),
            el('div', { className: 'hb-sug-card' },
                el('div', { className: 'hb-sug-img', style: { backgroundImage: bgUrl(coverUrl(sug)) } }),
                el('div', { className: 'hb-sug-body' },
                    el('div', { className: 'hb-sug-meta' },
                        el('div', { textContent: 'Débutants bienvenus', style: { color: 'var(--moss)' } }),
                        el('div', { textContent: inLabel(sug.next) + (sug.hour ? ' · ' + sug.hour.replace(':', 'h') : ''), style: { color: 'var(--ember)' } })),
                    el('div', { className: 'hb-sug-name', textContent: sug.name }),
                    el('div', { className: 'hb-pitch', textContent: sug.pitch, style: { fontSize: '17px' } }),
                    el('div', { className: 'hb-sug-gm', textContent: 'MJ ' + sug.gm + ' · ' + plural(free, ' place libre', ' places libres') + ' · ' + sug.rhythm }),
                    el('div', { style: { display: 'flex', marginTop: '4px' } }, btn('hb-btn', 'Voir la table', () => openModal(sug.id))))));
    }

    // hero: the next session
    const heroK = mine.find(k => k.next != null) || mine[0];
    const hero = $('hb-hero');
    hero.hidden = !heroK;
    if (heroK) {
        const isGM = heroK.role === 'MJ', n = heroK.next;
        fill(hero,
            el('div', { className: 'hb-hero-img' }, el('div', { className: 'hb-cover', style: { backgroundImage: bgUrl(coverUrl(heroK)) } })),
            el('div', { className: 'hb-hero-body' },
                el('div', { className: 'hb-hero-label', textContent: n == null ? 'Aucune séance prévue' : 'Prochaine séance · ' + inLabel(n).toLowerCase() }),
                el('div', { className: 'hb-hero-name', textContent: heroK.name }),
                el('div', { className: 'hb-hero-when', textContent: fmt(heroK) }),
                el('div', { className: 'hb-hero-meta', textContent: (isGM ? 'Vous êtes maître du jeu' : 'MJ ' + heroK.gm) + ' · ' + (heroK.session ? 'Session ' + (heroK.session + 1) : 'Première séance') + ' · ' + heroK.taken + '/' + heroK.seats + ' joueurs' }),
                el('div', { className: 'hb-hero-acts' },
                    btn('hb-btn', 'Entrer dans la campagne', () => enterCamp(heroK)),
                    btn('hb-btn-ghost', isGM ? 'Gérer la table' : 'Écrire à ' + heroK.gm, () => isGM ? openModal(heroK.id) : openChat(heroK.gmId, heroK.gm, heroK.name)))));
    }

    // requests to validate (GM)
    const reqs = $('hb-reqs');
    reqs.hidden = hub.requests.length === 0;
    fill(reqs, el('div', { className: 'hb-label', textContent: 'Demandes reçues · à valider', style: { color: 'var(--ember)' } }),
        hub.requests.map(r => {
            const k = campById(r.camp) || { name: '', seats: 0, taken: 0 }, free = k.seats - k.taken, col = pal(r.who);
            return el('div', { className: 'hb-req' },
                avatar(38, col, null),
                el('div', { className: 'hb-req-body' },
                    el('div', { className: 'hb-req-who', textContent: r.who + ' veut rejoindre « ' + k.name + ' »' }),
                    r.text && el('div', { className: 'hb-pitch', textContent: r.text, style: { fontSize: '16px', lineHeight: 'normal' } }),
                    el('div', { className: 'hb-req-seats', textContent: free > 0 ? plural(free, ' place restante', ' places restantes') : 'Table complète' })),
                el('div', { className: 'hb-req-acts' },
                    btn('hb-req-btn hb-req-ok', 'Accepter', () => acceptReq(r)),
                    btn('hb-req-btn hb-req-reply', 'Répondre', () => openChat(r.userId, r.who, k.name)),
                    btn('hb-req-btn hb-req-no', 'Refuser', () => refuseReq(r))));
        }));

    // other tables
    const others = mine.filter(k => k !== heroK);
    $('hb-others-label').hidden = others.length === 0;
    fill($('hb-grid-mine'), others.map(k => {
        const n = k.next, soon = n != null && n <= 7, isGM = k.role === 'MJ', V = VIS[k.vis] || VIS.prive;
        return el('div', { className: 'hb-mcard' + (soon ? ' soon' : '') },
            el('div', { className: 'hb-mcard-img' },
                el('div', { className: 'hb-cover', style: { backgroundImage: bgUrl(coverUrl(k)) } }),
                el('div', { className: 'hb-mcard-badges' },
                    el('div', { className: 'hb-badge', textContent: isGM ? 'Maître du jeu' : 'Joueur',
                        style: { color: isGM ? 'var(--ember)' : 'var(--text-2)', border: '1px solid ' + (isGM ? 'rgba(236,164,86,.5)' : 'rgba(150,168,200,.25)') } }),
                    el('div', { className: 'hb-badge', textContent: V.label, style: { color: V.c } }))),
            el('div', { className: 'hb-mcard-mid' },
                el('div', { className: 'hb-day' + (soon ? ' soon' : '') + (n == null ? ' none' : '') },
                    el('div', { className: 'hb-day-num', textContent: n == null ? '—' : String(n) }),
                    el('div', { className: 'hb-day-unit', textContent: n == null ? 'à fixer' : n <= 1 ? 'jour' : 'jours' })),
                el('div', { className: 'hb-mcard-info' },
                    el('div', { className: 'hb-mcard-name', textContent: k.name }),
                    el('div', { className: 'hb-mcard-when', textContent: fmt(k) }),
                    el('div', { className: 'hb-mcard-meta', textContent: (isGM ? '' : 'MJ ' + k.gm + ' · ') + (k.session ? 'Session ' + k.session : 'Pas encore commencée') + ' · ' + k.taken + '/' + k.seats + (k.code && isGM ? ' · ' + k.code : '') }))),
            el('div', { className: 'hb-mcard-acts' },
                btn('hb-btn', 'Entrer', () => enterCamp(k)),
                btn('hb-btn-ghost', 'Détails', () => openModal(k.id))));
    }));

    // own requests still waiting
    const pend = hub.camps.filter(k => k.pending);
    $('hb-pending').hidden = pend.length === 0;
    fill($('hb-pend-list'), pend.map(k => el('div', { className: 'hb-pend' },
        el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
            el('div', { className: 'hb-pend-name', textContent: k.name }),
            el('div', { className: 'hb-pend-gm', textContent: 'En attente de ' + k.gm })),
        btn('hb-req-btn hb-req-reply', 'Écrire au MJ', () => openChat(k.gmId, k.gm, k.name)))));
}

function renderBrowse() {
    const q = hub.q.trim().toLowerCase();
    const open = hub.camps.filter(visible);
    $('hb-explore-sub').textContent = (n => n + (n > 1 ? ' tables recrutent' : ' table recrute') + ' en ce moment')(open.filter(k => k.seats > k.taken).length);
    const filters = [['all', 'Toutes'], ['beg', 'Débutants'], ['public', 'Publiques'], ['demande', 'Sur demande'], ['free', 'Places libres']];
    fill($('hb-filters'), filters.map(([id, label]) =>
        el('div', { className: 'hb-pill' + (hub.filter === id ? ' on' : ''), textContent: label, onclick: () => { hub.filter = id; renderBrowse(); } })));
    const list = open
        .filter(k => hub.filter === 'all' || (hub.filter === 'free' ? k.seats > k.taken : hub.filter === 'beg' ? k.beginner : k.vis === hub.filter))
        .filter(k => !q || (k.name + ' ' + k.gm + ' ' + k.tags.join(' ') + ' ' + k.pitch).toLowerCase().includes(q))
        .sort((a, b) => (b.seats - b.taken > 0) - (a.seats - a.taken > 0) || (a.next ?? 1e9) - (b.next ?? 1e9));
    $('hb-browse-empty').hidden = list.length > 0;
    fill($('hb-grid-browse'), list.map(k => {
        const st = campStatus(k), V = VIS[k.vis], col = pal(k.gm);
        return el('div', { className: 'hb-bcard', onclick: () => openModal(k.id) },
            el('div', { className: 'hb-row-between' }, micro(V.label, V.c), micro(st.t, st.c)),
            el('div', { className: 'hb-bcard-text' },
                el('div', { className: 'hb-bcard-name', textContent: k.name }),
                el('div', { className: 'hb-bcard-when', textContent: inLabel(k.next) + (k.next != null ? ' · ' + fmt(k) : '') }),
                el('div', { className: 'hb-pitch', textContent: k.pitch, style: { fontSize: '16px' } })),
            tagsRow(k.tags, k.beginner),
            el('div', { className: 'hb-bcard-foot' },
                el('div', { className: 'hb-bcard-gm' }, avatar(26, col, null, 4), el('div', { className: 'hb-bcard-gm-name', textContent: k.gm + ' · ' + k.rhythm })),
                el('div', { className: 'hb-dots' }, Array.from({ length: k.seats }, (_, i) => el('div', { className: 'hb-dot' + (i < k.taken ? ' taken' : '') })))));
    }));
}

function renderCreate() {
    const f = hub.f, fv = VIS[f.vis];
    const pvUrl = f.cover || coverFor(f.name.trim());
    $('hb-drop').classList.toggle('drag', hub.drag);
    $('hb-drop-img').style.backgroundImage = bgUrl(pvUrl);
    $('hb-drop-hint').textContent = f.cover ? 'Image personnalisée' : 'Couverture générée · glissez une image ici';
    $('hb-drop-pick').textContent = f.cover ? 'Changer' : 'Choisir une image';
    $('hb-drop-rm').hidden = !f.cover;
    $('hb-seats').textContent = f.seats;
    fill($('hb-vis'), Object.entries(VIS).map(([id, o]) => el('div', {
        className: 'hb-vis-opt' + (f.vis === id ? ' on' : ''), style: { borderColor: f.vis === id ? o.c : '' }, onclick: () => { f.vis = id; renderCreate(); } },
        el('div', { className: 'hb-vis-label', textContent: o.label, style: { color: f.vis === id ? o.c : '' } }),
        el('div', { className: 'hb-vis-desc', textContent: o.desc }))));
    fill($('hb-rhythm'), RHY.map(r => el('div', { className: 'hb-pill' + (f.rhythm === r ? ' on' : ''), textContent: r, onclick: () => { f.rhythm = r; renderCreate(); } })));
    $('hb-create-btn').classList.toggle('ready', !!f.name.trim());
    $('hb-create-hint').textContent = f.vis === 'prive' ? 'Un sceau sera généré pour inviter vos joueurs.'
        : f.vis === 'demande' ? 'Vous validerez chaque demande dans vos messages.' : 'La table apparaîtra aussitôt dans Explorer.';
    // preview
    const fd = f.date ? new Date(f.date) : null;
    $('hb-pv-img').style.backgroundImage = bgUrl(pvUrl);
    $('hb-pv-vis').textContent = fv.label; $('hb-pv-vis').style.color = fv.c;
    $('hb-pv-seats').textContent = f.seats + ' places libres';
    $('hb-pv-name').textContent = f.name.trim() || 'Nom de la campagne';
    $('hb-pv-pitch').textContent = f.pitch.trim() || 'Votre accroche apparaîtra ici.';
    fill($('hb-pv-tags'), tagList(f.tags).map(t => el('div', { className: 'hb-tag', textContent: t })));
    $('hb-pv-foot-text').textContent = hub.me.name + ' · ' + f.rhythm + ' · ' + (fd ? inLabel(dayDiff(fd)) : 'date à fixer');
}

function renderAside() {
    const unread = Object.values(hub.convs).reduce((a, c) => a + (c.unread || 0), 0);
    const cv = hub.chat ? hub.convs[hub.chat] : null;
    $('hb-chat').hidden = !cv;
    $('hb-lists').hidden = !!cv;
    const onlineOf = id => { const p = hub.friends.find(x => x.id === id); return p ? p.on : hubData.demo ? 'on' : 'off'; };
    if (cv) {
        const who = cv.who, col = pal(who);
        fill($('hb-chat-av'), avatar(38, col, DOT[onlineOf(hub.chat)]));
        $('hb-chat-who').textContent = who;
        $('hb-chat-sub').textContent = (hub.camps.some(k => k.gm === who && k.name === cv.camp) ? 'MJ · ' : '') + (cv.camp || 'Compagnon');
        $('hb-chat-in').placeholder = 'Écrire à ' + who + '…';
        const log = $('hb-chat-log');
        fill(log, cv.msgs.map(m => el('div', { className: 'hb-msg' + (m.me ? ' me' : '') + (m.sys ? ' sys' : '') },
            el('div', { className: 'hb-msg-text', textContent: m.text }),
            el('div', { className: 'hb-msg-t', textContent: m.t }))),
            hub.typing && el('div', { className: 'hb-typing', textContent: who + ' écrit…' }));
        log.scrollTop = log.scrollHeight;
        return;
    }
    $('hb-msg-label').textContent = 'Messages' + (unread ? ' · ' + plural(unread, ' non lu', ' non lus') : '');
    $('hb-no-convs').hidden = Object.keys(hub.convs).length > 0;
    const last = c => (c.msgs[c.msgs.length - 1] || {}).ts || 0;
    fill($('hb-conv-list'), Object.entries(hub.convs).reverse().sort((a, b) => last(b[1]) - last(a[1])).map(([key, c]) => el('div', { className: 'hb-conv', onclick: () => openChat(key) },
        avatar(38, pal(c.who), DOT[onlineOf(key)]),
        el('div', { className: 'hb-conv-body' },
            el('div', { className: 'hb-conv-top' },
                el('div', { className: 'hb-conv-who', textContent: c.who }),
                c.unread > 0 && el('div', { className: 'hb-unread', textContent: c.unread })),
            el('div', { className: 'hb-conv-last', textContent: (c.msgs[c.msgs.length - 1] || {}).text || c.camp })))));
    const online = hub.friends.filter(p => p.on !== 'off').length;
    $('hb-friends-label').textContent = 'Compagnons' + (online ? ' · ' + online + ' en ligne' : '');
    $('hb-no-friends').hidden = hub.friends.length > 0;
    fill($('hb-friend-list'), hub.friends.map(p => el('div', { className: 'hb-friend', style: { opacity: p.on === 'off' ? 0.55 : 1 }, onclick: () => openChat(p.id, p.name, p.camp) },
        avatar(32, pal(p.name), DOT[p.on], 5),
        el('div', { className: 'hb-conv-body', style: { gap: '2px' } },
            el('div', { className: 'hb-friend-name', textContent: p.name }),
            el('div', { className: 'hb-friend-act', textContent: p.activity })))));
}

// ── profile & settings (our addition: the handoff's avatar did nothing) ─────
// One panel for everything that belongs to the account rather than to a table:
// name, password, the save keys (where an old pre-account key gets claimed), and
// the per-machine preferences in aria-config.
const PROFILE = 'profile';
function readConfig() { try { return JSON.parse(localStorage.getItem('aria-config') || '{}'); } catch (_) { return {}; } }
function writeConfig(patch) { localStorage.setItem('aria-config', JSON.stringify({ ...readConfig(), ...patch })); }

async function openProfile() {
    hub.modal = PROFILE; hub.pick = null;
    hub.saves = hubData.demo ? [] : await sbOwnedSaves().catch(() => []);
    renderModal();
}

function profileSection(title, ...kids) {
    return el('div', { className: 'hb-prof-sec' }, el('div', { className: 'hb-field-label', textContent: title }), ...kids);
}
function profileRow(input, label, onclick) {
    return el('div', { className: 'hb-code-row' }, input, el('div', { className: 'hb-code-btn', textContent: label, onclick }));
}

function renderProfile() {
    const nameIn = el('input', { className: 'hb-code-in', value: hub.me.name, maxLength: 40, spellcheck: false });
    const pwIn = el('input', { className: 'hb-code-in', type: 'password', placeholder: 'Nouveau mot de passe (8 caractères min.)', autocomplete: 'new-password' });
    const keyIn = el('input', { className: 'hb-code-in', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', spellcheck: false });
    const ytIn = el('input', { className: 'hb-code-in', type: 'password', value: readConfig().youtubeApiKey || '', placeholder: 'Clé API YouTube (facultatif)' });

    const saveName = async () => {
        const name = nameIn.value.trim();
        if (!name) { flash('Le nom ne peut pas être vide.', 'err'); return; }
        const r = await sbUpdateUser({ data: { display_name: name } });
        if (r.error) { flash('Nom refusé : ' + r.error, 'err'); return; }
        hub.me.name = sbUserName(); $('hb-me-name').textContent = hub.me.name;
        flash('Nom enregistré.', 'ok');
    };
    const savePw = async () => {
        if (pwIn.value.length < 8) { flash('8 caractères minimum.', 'err'); return; }
        const r = await sbSetPassword(pwIn.value);
        pwIn.value = '';
        flash(r.error ? 'Mot de passe refusé : ' + r.error : 'Mot de passe changé.', r.error ? 'err' : 'ok');
    };
    const claim = async () => {
        const key = keyIn.value.trim();
        if (!key) return;
        if (!await sbClaimSaveKey(key)) { flash('Clé introuvable, ou déjà rattachée à un autre compte.', 'err'); return; }
        flash('Clé rattachée : vos tables et personnages arrivent.', 'ok');
        setTimeout(() => location.reload(), 900);   // hubData.load() reads everything the key just unlocked
    };
    const copy = k => navigator.clipboard.writeText(k).then(() => flash('Clé copiée.', 'ok'), () => {});
    const TYPE = { gm: 'Maître du jeu', player: 'Joueur' };

    fill($('hb-modal'),
        el('div', { className: 'hb-modal-body' },
            el('div', { className: 'hb-row-between' },
                el('div', { className: 'hb-modal-head' },
                    el('div', { className: 'hb-modal-name', textContent: 'Profil' }),
                    el('div', { className: 'hb-prof-mail', textContent: sbUserEmail() })),
                btn('hb-modal-x hb-prof-x', '✕', closeModal)),

            profileSection('Nom affiché', profileRow(nameIn, 'Enregistrer', saveName)),
            profileSection('Mot de passe', profileRow(pwIn, 'Changer', savePw)),

            profileSection('Clés de sauvegarde',
                el('div', { className: 'hb-prof-hint', textContent: 'Vos personnages et campagnes sont rangés sous une clé. Une clé créée avant les comptes se rattache ici, une seule fois.' }),
                hub.saves && hub.saves.length
                    ? el('div', { className: 'hb-prof-keys' }, hub.saves.map(s => el('div', { className: 'hb-prof-key' },
                        el('span', { className: 'hb-prof-key-t', textContent: TYPE[s.type] || 'Clé' }),
                        el('span', { className: 'hb-prof-key-v', textContent: s.save_key }),
                        el('div', { className: 'hb-code-btn', textContent: 'Copier', onclick: () => copy(s.save_key) }))))
                    : el('div', { className: 'hb-prof-hint', textContent: 'Aucune clé pour l\'instant.' }),
                profileRow(keyIn, 'Rattacher', claim)),

            profileSection('Préférences de cet appareil',
                el('div', { className: 'hb-prof-hint', textContent: 'Pour importer les titres et les playlists YouTube dans l\'onglet Musique du MJ.' }),
                profileRow(ytIn, 'Enregistrer', () => { writeConfig({ youtubeApiKey: ytIn.value.trim() }); flash('Préférence enregistrée.', 'ok'); })),

            el('div', { className: 'hb-modal-acts' },
                el('div', { className: 'hb-modal-chat', textContent: 'Se déconnecter', onclick: () => $('hb-quit').click() }))));
    [[nameIn, saveName], [pwIn, savePw], [keyIn, claim]].forEach(([i, f]) => i.addEventListener('keydown', e => { if (e.key === 'Enter') f(); }));
}

function renderModal() {
    const scrim = $('hb-modal-scrim');
    if (hub.modal === PROFILE) { scrim.hidden = false; renderProfile(); return; }
    const mk = campById(hub.modal);
    scrim.hidden = !mk;
    if (!mk) return;
    const st = campStatus(mk), V = VIS[mk.vis] || VIS.prive, full = mk.seats <= mk.taken, isGM = mk.role === 'MJ';
    let cta = 'Rejoindre la table', on = true, act = () => join(mk);
    if (mk.role) { cta = 'Entrer dans la campagne'; act = () => enterCamp(mk); }
    else if (mk.pending) { cta = 'Demande en attente'; on = false; act = null; }
    else if (full) { cta = 'Table complète'; on = false; act = null; }
    else if (mk.vis !== 'public' && !mk.accepted && !mk.code) cta = 'Demander à rejoindre';

    const choices = hub.pick && hub.pick.campId === mk.id ? hubData.freeChars(mk) : null;
    fill($('hb-modal'),
        el('div', { className: 'hb-modal-img' },
            el('div', { className: 'hb-cover', style: { backgroundImage: bgUrl(coverUrl(mk)) } }),
            btn('hb-modal-x', '✕', closeModal)),
        el('div', { className: 'hb-modal-body' },
            el('div', { className: 'hb-modal-head' },
                el('div', { className: 'hb-modal-meta' },
                    el('div', { textContent: V.label, style: { color: V.c } }),
                    el('div', { textContent: st.t, style: { color: st.c } })),
                el('div', { className: 'hb-modal-name', textContent: mk.name }),
                el('div', { className: 'hb-pitch', textContent: mk.pitch, style: { fontSize: '18px', lineHeight: '1.45' } })),
            el('div', { className: 'hb-facts' }, [
                ['Maître du jeu', isGM ? 'Vous' : mk.gm],
                ['Prochaine séance', inLabel(mk.next) + (mk.hour ? ' · ' + mk.hour.replace(':', 'h') : '')],
                ['Rythme', mk.rhythm],
                ['Joueurs', mk.taken + ' / ' + mk.seats],
            ].map(([k, v]) => el('div', { className: 'hb-fact' }, el('div', { className: 'hb-fact-k', textContent: k }), el('div', { className: 'hb-fact-v', textContent: v })))),
            el('div', { className: 'hb-tags' }, mk.tags.map(t => el('div', { className: 'hb-tag', textContent: t }))),
            choices
                // ponytail: our addition — the handoff joins without asking which character
                ? el('div', { className: 'hb-pick' },
                    el('div', { className: 'hb-field-label', textContent: 'Avec quel personnage ?' }),
                    el('div', { className: 'hb-pick-opts' },
                        choices.map(c => el('div', { className: 'hb-pill', textContent: c.name, onclick: () => sit(mk, c.id) })),
                        el('div', { className: 'hb-pill on', textContent: 'Nouveau personnage', onclick: () => sit(mk, 'new') })))
                : el('div', { className: 'hb-modal-acts' },
                    el('div', { className: 'hb-cta' + (on ? '' : ' off'), textContent: cta, onclick: act }),
                    !isGM && el('div', { className: 'hb-modal-chat', textContent: 'Écrire à ' + mk.gm, onclick: () => openChat(mk.gmId, mk.gm, mk.name) }),
                    isGM && mk.code && el('div', { className: 'hb-seal' },
                        el('div', { className: 'hb-seal-k', textContent: 'Sceau à partager' }),
                        el('div', { className: 'hb-seal-v', textContent: mk.code })))));
}

function renderToast() {
    const t = $('hb-toast');
    t.hidden = !hub.toast;
    if (!hub.toast) return;
    const c = TOAST[hub.toast.tone] || 'var(--ember)';
    t.style.borderColor = c;
    $('hb-toast-gem').style.background = c;
    $('hb-toast-text').textContent = hub.toast.text;
}

// ── actions ────────────────────────────────────────────────────────────────
function openModal(id) { hub.modal = id; hub.pick = null; renderModal(); }
function closeModal() { hub.modal = null; hub.pick = null; renderModal(); }

// Conversations are keyed by the other account's id (its name in demo); `who` is
// what the drawer shows.
function pushMsg(key, msg, unread) {
    const c = hub.convs[key];
    hub.convs[key] = { ...c, unread: (c.unread || 0) + (unread ? 1 : 0), msgs: [...c.msgs, { ...msg, t: now(), ts: Date.now() }] };
}
function conv(key, who, camp) {
    const c = hub.convs[key] || { who, camp, unread: 0, msgs: [] };
    return hub.convs[key] = { ...c, who: c.who || who, camp: camp || c.camp };
}
function openChat(key, who, camp) {
    if (!key) return;
    hub.convs[key] = { ...conv(key, who, camp), unread: 0 };
    hubData.markRead(key);
    hub.chat = key; hub.modal = null;
    $('hb-chat-in').value = '';
    render();
    $('hb-chat-in').focus();
}
// demo only: the prototype's simulated GM
function demoReply(key, text, ms, after) {
    if (!hubData.demo) return;
    setTimeout(() => { hub.typing = hub.chat === key; renderAside(); }, 500);
    setTimeout(() => { hub.typing = false; pushMsg(key, { me: false, text }, hub.chat !== key); renderAside(); after && after(); }, ms);
}
async function send() {
    const key = hub.chat, text = $('hb-chat-in').value.trim();
    if (!key || !text) return;
    $('hb-chat-in').value = '';
    pushMsg(key, { me: true, text });
    renderAside();
    if (!await hubData.send(key, hub.convs[key].camp, text)) { flash('Le message n\'a pas pu être envoyé.', 'err'); return; }
    const pool = ['Bonne question — je te fais un topo avant la séance.', 'Oui, c\'est tout à fait possible. Tu as déjà une idée de personnage ?', 'On commence toujours par vingt minutes de récap, pas d\'inquiétude.', 'Je note. On en reparle à la table.'];
    demoReply(key, pool[Math.floor(Math.random() * pool.length)], 1900);
}

// Join: public (or code / accepted) sits right away; 'demande' asks the GM.
async function join(k) {
    if (k.code && (k.vis === 'public' || k.accepted || hubData.demo && k.vis === 'public')) {
        if (hubData.freeChars(k).length) { hub.pick = { campId: k.id }; renderModal(); return; }
        return sit(k, 'new');
    }
    if (!await hubData.ask(k)) { flash('La demande n\'a pas pu être envoyée.', 'err'); return; }
    k.pending = true;
    // the request itself reaches the GM; these lines are the demo's simulated thread
    if (hubData.demo) { conv(k.gmId, k.gm, k.name); pushMsg(k.gmId, { me: true, sys: true, text: 'Demande pour rejoindre « ' + k.name + ' » envoyée.' }); }
    hub.modal = null;
    render();
    flash('Demande envoyée à ' + k.gm + '.', 'wait');
    demoReply(k.gmId, 'Merci pour ta demande ! Dis-m\'en un peu plus sur le personnage que tu voudrais jouer ?', 2600);
    if (hubData.demo) setTimeout(() => {
        pushMsg(k.gmId, { me: false, text: 'C\'est bon, je t\'accepte à la table. Bienvenue !' }, hub.chat !== k.gmId);
        Object.assign(k, { pending: false, role: 'Joueur', taken: k.taken + 1 });
        render();
        flash(k.gm + ' vous a accepté à « ' + k.name + ' ».', 'ok');
    }, 9000);
}

async function sit(k, charId) {
    const res = await hubData.seat(k, charId);
    if (res.error) { flash('Impossible de rejoindre « ' + k.name + ' ».', 'err'); return; }
    // live: reread the row, a table joined by code only knew its id, name and code
    const fresh = !hubData.demo && await hubData.camp(k.id);
    Object.assign(k, fresh || { role: 'Joueur', accepted: false, taken: k.taken + 1 });
    if (!campById(k.id)) hub.camps.push(k);
    hub.modal = null; hub.pick = null;
    render();
    flash('Vous avez rejoint « ' + k.name + ' ».', 'ok');
}

async function useCode() {
    const input = document.activeElement && document.activeElement.classList.contains('hb-code-in') ? document.activeElement : null;
    const code = ((input && input.value) || [...document.querySelectorAll('.hb-code-in')].map(i => i.value).find(Boolean) || '').trim().toUpperCase();
    if (!code) return;
    let k = hub.camps.find(c => c.code && c.code.toUpperCase() === code);
    if (!k) {
        const found = await hubData.byCode(code);
        if (!found) { flash('Ce sceau ne correspond à aucune table.', 'err'); return; }
        k = campById(found.id) || { gm: '—', vis: 'prive', seats: 4, taken: 0, next: null, hour: '', rhythm: '', session: 0, tags: [], pitch: '', ...found };
        k.code = found.code;
    }
    if (k.role) { flash('Vous êtes déjà à cette table.', 'wait'); return; }
    document.querySelectorAll('.hb-code-in').forEach(i => { i.value = ''; });
    if (!campById(k.id)) hub.camps.push(k);
    if (hubData.freeChars(k).length) { hub.modal = k.id; hub.pick = { campId: k.id }; renderModal(); return; }
    const res = await hubData.seat(k, 'new');
    if (res.error) { flash('Impossible de rejoindre « ' + k.name + ' ».', 'err'); return; }
    const fresh = !hubData.demo && await hubData.camp(k.id);
    Object.assign(k, fresh || { role: 'Joueur', taken: k.taken + 1 });
    render();
    flash('Sceau brisé : vous rejoignez « ' + k.name + ' ».', 'ok');
}

async function acceptReq(r) {
    const k = campById(r.camp);
    if (k.taken >= k.seats) { flash('Plus de place à « ' + k.name + ' ». Ajoutez un siège ou refusez.', 'err'); return; }
    if (!await hubData.decide(r, 'accepted')) { flash('La réponse n\'a pas pu être enregistrée.', 'err'); return; }
    // the seat is taken when the player links a character; the count follows then
    if (hubData.demo) k.taken++;
    hub.requests = hub.requests.filter(x => x.id !== r.id);
    if (hubData.demo) { conv(r.userId, r.who, k.name); pushMsg(r.userId, { me: true, sys: true, text: 'Vous avez accepté ' + r.who + ' à « ' + k.name + ' ».' }); }
    render();
    flash(r.who + ' rejoint « ' + k.name + ' ».', 'ok');
}
async function refuseReq(r) {
    const k = campById(r.camp);
    if (!await hubData.decide(r, 'refused')) { flash('La réponse n\'a pas pu être enregistrée.', 'err'); return; }
    hub.requests = hub.requests.filter(x => x.id !== r.id);
    if (hubData.demo) { conv(r.userId, r.who, k.name); pushMsg(r.userId, { me: true, sys: true, text: 'Demande pour « ' + k.name + ' » refusée.' }); }
    render();
    flash('Demande de ' + r.who + ' refusée.', 'wait');
}

// ── cover picking (prototype's pickCover: downscale to 1400px, JPEG) ────────
function pickCover(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { flash('Ce fichier n\'est pas une image.', 'err'); return; }
    shrinkImage(file).then(b => {
        if (hub.f.cover) URL.revokeObjectURL(hub.f.cover);
        hub.f.coverBlob = b; hub.f.cover = URL.createObjectURL(b);
        renderCreate();
    });
}

async function create() {
    const f = hub.f;
    if (!f.name.trim()) { flash('Donnez un nom à votre campagne.', 'err'); return; }
    const d = f.date ? new Date(f.date) : null;
    if (d && d < new Date()) { flash('La première séance doit être dans le futur.', 'err'); return; }
    if (create.busy) return;
    create.busy = true;
    const res = await hubData.create({ ...f, tagList: tagList(f.tags) }, f.coverBlob);
    create.busy = false;
    if (!res) { flash('La campagne n\'a pas pu être forgée.', 'err'); return; }
    const code = f.vis === 'prive' ? res.code : null;
    hub.camps.unshift({
        id: res.id, name: f.name.trim(), gm: hub.me.name, vis: f.vis, seats: f.seats, taken: 0,
        next: d ? dayDiff(d) : null, hour: d ? d.toTimeString().slice(0, 5) : '', rhythm: f.rhythm, session: 0,
        cover: f.cover || null, tags: tagList(f.tags), pitch: f.pitch.trim() || 'Une nouvelle table attend ses premiers joueurs.',
        role: 'MJ', code: res.code, beginner: hubIsBeginner(tagList(f.tags)), ariaType: 'ancient',
    });
    hub.f = { name: '', pitch: '', vis: 'public', seats: 4, rhythm: 'Hebdomadaire', date: '', tags: '', cover: '', coverBlob: null };
    ['hb-f-name', 'hb-f-pitch', 'hb-f-date', 'hb-f-tags'].forEach(id => { $(id).value = ''; });
    hub.tab = 'mine';
    render();
    flash(code ? 'Campagne forgée. Sceau à partager : ' + code
        : 'Campagne forgée' + (f.vis === 'public' ? ' et publiée dans Explorer.' : '. Les demandes arriveront dans vos messages.'), 'ok');
}

// ── wiring ─────────────────────────────────────────────────────────────────
function wire() {
    $('hb-me').onclick = openProfile;
    $('hb-quit').onclick = () => { if (!hubData.demo) sbSignOut(); location.assign('../index.html'); };
    document.querySelectorAll('.hb-code-in').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') useCode(); }));
    document.querySelectorAll('.hb-code-btn').forEach(b => b.addEventListener('click', useCode));
    $('hb-go-beg').onclick = () => { hub.tab = 'explore'; hub.filter = 'beg'; hub.q = ''; $('hb-q').value = ''; render(); };
    $('hb-go-create').onclick = () => { hub.tab = 'create'; render(); };
    $('hb-q').addEventListener('input', e => { hub.q = e.target.value; renderBrowse(); });

    const bind = (id, key) => $(id).addEventListener('input', e => { hub.f[key] = e.target.value; renderCreate(); });
    bind('hb-f-name', 'name'); bind('hb-f-pitch', 'pitch'); bind('hb-f-date', 'date'); bind('hb-f-tags', 'tags');
    $('hb-seat-down').onclick = () => { hub.f.seats = Math.max(1, hub.f.seats - 1); renderCreate(); };
    $('hb-seat-up').onclick = () => { hub.f.seats = Math.min(8, hub.f.seats + 1); renderCreate(); };
    const drop = $('hb-drop'), file = $('hb-file');
    drop.onclick = () => file.click();
    file.onchange = e => { pickCover(e.target.files && e.target.files[0]); e.target.value = ''; };
    drop.ondragover = e => { e.preventDefault(); if (!hub.drag) { hub.drag = true; renderCreate(); } };
    drop.ondragleave = () => { hub.drag = false; renderCreate(); };
    drop.ondrop = e => { e.preventDefault(); hub.drag = false; pickCover(e.dataTransfer.files && e.dataTransfer.files[0]); };
    $('hb-drop-rm').onclick = e => { e.stopPropagation(); if (hub.f.cover) URL.revokeObjectURL(hub.f.cover); hub.f.cover = ''; hub.f.coverBlob = null; renderCreate(); };
    $('hb-create-btn').onclick = create;
    fill($('hb-pv-av'), avatar(26, PAL['Aldric'], null, 4));

    $('hb-chat-back').onclick = () => { hub.chat = null; renderAside(); };
    $('hb-chat-in').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    $('hb-send').onclick = send;

    $('hb-modal-scrim').onclick = closeModal;
    $('hb-modal').onclick = e => e.stopPropagation();
    window.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (hub.modal) closeModal();
        else if (hub.chat) { hub.chat = null; renderAside(); }
    });
    // the prototype's buttons are clickable divs: give each one a role and a tab stop, here once for every render
    const pressable = () => document.querySelectorAll('.hb-root div, .hb-modal-scrim div').forEach(n => {
        if ((n.onclick || n.classList.contains('hb-code-btn')) && n.id !== 'hb-modal' && n.id !== 'hb-modal-scrim' && !n.hasAttribute('role')) { n.setAttribute('role', 'button'); n.tabIndex = 0; }
    });
    pressable();
    new MutationObserver(pressable).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('role') === 'button') { e.preventDefault(); e.target.click(); }
    });
    // signing out in another tab ends this page too
    window.addEventListener('storage', e => { if (e.key === 'aria-session' && !e.newValue && !hubData.demo) location.assign('../index.html'); });
}

async function boot() {
    if (!hubData.demo && !sbSignedIn()) { location.replace('../index.html'); return; }
    ariaBg.mount('tavern', document.querySelector('.hb-root'));
    wire();
    const params = new URLSearchParams(location.search);
    const loading = hubData.load();
    if (params.has('boot')) {
        params.delete('boot');
        history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : ''));
        await ariaLoading(loading);
    }
    const data = await loading.catch(err => { console.error('[HUB] load:', err); return null; });
    if (data) Object.assign(hub, data);
    $('hb-me-name').textContent = hub.me.name;
    // a request accepted since the last visit: say so once, the seat is one click away
    const seen = JSON.parse(localStorage.getItem('aria-hub-accepted-seen') || '[]');
    const fresh = hub.camps.filter(k => k.accepted && !seen.includes(k.id));
    if (fresh.length) {
        localStorage.setItem('aria-hub-accepted-seen', JSON.stringify([...seen, ...fresh.map(k => k.id)]));
        flash(fresh[0].gm + ' vous a accepté à « ' + fresh[0].name + ' ».', 'ok');
    }
    if (!hub.ready) console.warn('[HUB] hub_campaigns() unavailable — apply specs/hub.sql');
    render();
    // ponytail: messages are polled (15 s, and on focus) — an Ably inbox per account
    // in ably-token would make them instant.
    if (hubData.loadConvs) {
        const poll = async () => {
            if (document.hidden) return;   // a background tab catches up on focus
            const convs = await hubData.loadConvs();
            if (hub.chat && convs[hub.chat]) { convs[hub.chat].unread = 0; hubData.markRead(hub.chat); }
            if (hub.chat && !convs[hub.chat]) convs[hub.chat] = hub.convs[hub.chat];   // opened, nothing sent yet
            hub.convs = convs;
            renderAside();
        };
        setInterval(poll, 15000);
        window.addEventListener('focus', poll);
    }
}

boot();
