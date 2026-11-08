// ═══════════════════════════════════════════
//  HUB — data layer
// ═══════════════════════════════════════════
// What the Hub and the campaign pages (Accueil, Fiche, Journal — `?camp=ID`) read
// and write, behind one object (`hubData`) so no page knows where a campaign came
// from. Two adapters:
//
//   live — Supabase (specs/hub.sql, specs/campaign_pages.sql): hub_campaigns(),
//          join_requests, characters, hub_messages, journal_notes(), the sheet
//          validation functions; Ably presence for who is at the table.
//   demo — the handoff's seed data, in memory (`?demo`, `?demo=veteran`). For
//          comparing the pages with design_handoff_aria/*.dc.html.
//
// Every campaign is normalized to the prototype's shape, which the page renders:
//   { id, name, gm, gmId, vis, seats, taken, next, hour, rhythm, session, tags,
//     pitch, role ('MJ' | 'Joueur' | undefined), pending, accepted, code, cover,
//     beginner, ariaType, approval }
// `next` is a day difference from today (null = no session planned).
//
// Messages are between accounts: a conversation is keyed by the other account's id
// (a table's gmId, a request's userId, a companion's id) — in demo, by the name.

const HUB_RHYTHM = { weekly: 'Hebdomadaire', biweekly: 'Toutes les 2 semaines', monthly: 'Mensuelle', once: 'One-shot' };
const HUB_RHYTHM_KEY = Object.fromEntries(Object.entries(HUB_RHYTHM).map(([k, v]) => [v, k]));
const HUB_SESSION_MIN = 180;   // a sitting still "tonight" until it has run this long

// Next sitting of a series that started at `first` (ms) with `rhythm`, or null when
// none is left. Steps with setDate/setMonth so a weekly 20:30 stays 20:30 local
// across a DST change. (Ported from the rendez-vous board's sxNextStart.)
function hubNextStart(first, rhythm, now = Date.now()) {
    if (!first) return null;
    const d = new Date(first), dur = HUB_SESSION_MIN * 60000;
    if (rhythm === 'once') return d.getTime() + dur < now ? null : d.getTime();
    let guard = 0;
    while (d.getTime() + dur < now && guard++ < 1200) {
        if (rhythm === 'monthly') d.setMonth(d.getMonth() + 1);
        else d.setDate(d.getDate() + (rhythm === 'biweekly' ? 14 : 7));
    }
    return d.getTime();
}

function hubDayDiff(t, now = Date.now()) {
    const a = new Date(now); a.setHours(0, 0, 0, 0);
    const b = new Date(t);   b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 864e5);
}

const hubIsBeginner = tags => (tags || []).some(t => /d[ée]butant/i.test(t));

// A message's time as the Hub lists it: 20:41 today, "Hier", "Lun." this week, else "3 sept.".
function hubMsgTime(ts, now = Date.now()) {
    const d = new Date(ts), n = hubDayDiff(ts, now);
    if (n === 0) return d.toTimeString().slice(0, 5);
    if (n === -1) return 'Hier';
    if (n > -7) { const w = d.toLocaleDateString('fr-FR', { weekday: 'short' }); return w.charAt(0).toUpperCase() + w.slice(1); }
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Conversations from hub_inbox() rows (any order): { [otherId]: { who, camp, unread,
// msgs: [{ me, text, t, ts }] } }, oldest message first. A message from the other
// side counts as unread when it is newer than read[otherId].
function hubConvs(rows, read = {}, now = Date.now()) {
    const out = {};
    [...rows].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).forEach(m => {
        const ts = Date.parse(m.created_at);
        const c = out[m.other] || (out[m.other] = { who: m.other_name, camp: '', unread: 0, msgs: [] });
        if (m.camp_name) c.camp = m.camp_name;
        if (!m.mine && ts > (read[m.other] || 0)) c.unread++;
        c.msgs.push({ me: m.mine, text: m.body, t: hubMsgTime(ts, now), ts });
    });
    return out;
}

// The Journal's sessions, from notes { title, body, ts, by, shared }.
// ponytail: a session is a calendar day that has notes — notes only carry their last
// write time. A journal table with a session number, once the Table authors notes.
function hubJournal(notes) {
    const days = new Map();
    [...notes].sort((a, b) => a.ts - b.ts).forEach(n => {
        const k = new Date(n.ts).toDateString();
        if (!days.has(k)) days.set(k, { ts: n.ts, notes: [] });
        days.get(k).notes.push(n);
    });
    return [...days.values()].map((d, i) => ({
        n: i + 1, title: d.notes[0].title,
        date: new Date(d.ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        present: '', notes: d.notes,
    }));
}

// Where "Entrer à la table" goes. The Table panels re-enter what these keys name.
function hubTableUrl(camp, charId) {
    if (camp.role === 'MJ') { localStorage.setItem('aria-gm-last-campaign', camp.id); return 'aria-gm.html'; }
    if (charId) localStorage.setItem('aria-last-character', charId);
    return 'aria-player.html';
}

// ── live ───────────────────────────────────────────────────────────────────
// Downscale a picked image to at most `max` px wide, as JPEG. Covers and sheet art
// are shown at screen size; a raw phone photo is ~10 MB for every viewer.
// Resolves to the original file if it cannot be decoded.
function shrinkImage(file, max = 1400, q = 0.86) {
    return new Promise(resolve => {
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const sc = Math.min(1, max / img.width), cv = document.createElement('canvas');
            cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            cv.toBlob(b => resolve(b || file), 'image/jpeg', q);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

const hubLive = (() => {
    let saves = null, chars = [];
    const readKey = () => 'aria-hub-read-' + (sbUserId() || '');
    const readMap = () => { try { return JSON.parse(localStorage.getItem(readKey()) || '{}'); } catch (_) { return {}; } };

    function campFromRow(r) {
        const at = hubNextStart(r.first_session ? Date.parse(r.first_session) : null, r.rhythm);
        return {
            id: r.id, name: r.name || 'Sans nom', gm: r.gm_name || '—', gmId: r.gm_id || null, vis: r.visibility || 'prive',
            seats: r.seats || 4, taken: r.taken || 0,
            next: at == null ? null : hubDayDiff(at),
            hour: at == null ? '' : new Date(at).toTimeString().slice(0, 5),
            rhythm: HUB_RHYTHM[r.rhythm] || HUB_RHYTHM.weekly, session: r.sessions_played || 0,
            tags: r.tags || [], pitch: r.pitch || '', cover: r.cover_url || null,
            role: r.is_gm ? 'MJ' : r.is_member ? 'Joueur' : undefined,
            pending: r.request === 'pending', accepted: r.request === 'accepted' && !r.is_member,
            code: r.join_code || null, beginner: hubIsBeginner(r.tags), ariaType: r.aria_type || 'ancient',
            approval: !!r.sheet_approval,
        };
    }

    // The panels pick their save by type and fall back to the first one owned;
    // writing anywhere else would put the row where the panel never looks.
    async function saveFor(type) {
        saves = saves || await sbOwnedSaves();
        const s = saves.find(r => r.type === type) || saves[0];
        if (s) return s.save_key;
        const key = uid();
        if (!await sbInsert('saves', { save_key: key, type })) throw new Error('save');
        saves = [{ save_key: key, type }];
        return key;
    }

    async function load() {
        const [rows, reqs, ch, convs, mates] = await Promise.all([
            sbRpc('hub_campaigns'),
            sbSelect('join_requests', 'status=eq.pending&select=id,campaign_id,user_id,user_name,message&order=created_at.asc'),
            sbSelect('characters', 'select=id,name,campaign_key,aria_type'),
            loadConvs(),
            sbRpc('hub_companions'),
        ]);
        const camps = (rows.data || []).map(campFromRow);
        const mineGM = new Set(camps.filter(c => c.role === 'MJ').map(c => c.id));
        chars = ch;
        return {
            me: { name: sbUserName() },
            ready: rows.ok,   // false until specs/hub.sql has been applied
            camps,
            requests: reqs.filter(r => mineGM.has(r.campaign_id))
                          .map(r => ({ id: r.id, who: r.user_name || '—', userId: r.user_id, camp: r.campaign_id, text: r.message || '' })),
            convs,
            // ponytail: no presence outside a table, so nobody shows as online; their
            // tables' presence sets would tell, at one connection per campaign.
            friends: (mates.data || []).map(m => ({ id: m.user_id, name: m.name, on: 'off', camp: m.camp_name,
                                                    activity: (m.is_gm ? 'MJ · ' : '') + m.camp_name })),
        };
    }

    // ── messages ──
    async function loadConvs() {
        const r = await sbRpc('hub_inbox');
        return hubConvs(r.data || [], readMap());
    }
    const send = (to, camp, text) => sbInsert('hub_messages', { to_user: to, camp_name: camp || null, body: text });
    function markRead(key) {
        const m = readMap(); m[key] = Date.now();
        localStorage.setItem(readKey(), JSON.stringify(m));
    }

    // Characters that could sit at `camp`: unlinked, and of the campaign's variant
    // (the GM only lists players whose ariaType matches the campaign's).
    const freeChars = camp => chars.filter(c => !c.campaign_key && (c.aria_type || 'ancient') === camp.ariaType)
                                   .map(c => ({ id: c.id, name: c.name || 'Sans nom' }));

    // Link an existing character (charId) or create one ('new') with the campaign's code.
    async function seat(camp, charId) {
        if (!camp.code) return { error: 'code' };
        if (charId && charId !== 'new') {
            return (await sbPatch('characters', { campaign_key: camp.code }, 'id=eq.' + encodeURIComponent(charId)))
                ? { charId } : { error: 'link' };
        }
        const tpl = camp.ariaType === 'contemporary' ? DEFAULT_CHAR_CONTEMPORARY : DEFAULT_CHAR_ANCIENT;
        const ch = { ...JSON.parse(JSON.stringify(tpl)), id: uid(), name: sbUserName() || 'Nouveau personnage', campaignKey: camp.code };
        const ok = await sbInsert(ENT.character.table, toRow(ENT.character, ch, await saveFor('player')));
        return ok ? { charId: ch.id } : { error: 'create' };
    }

    const ask = async camp => {
        // a refused request blocks the unique (campaign, user) pair: clear it first
        await sbDelete('join_requests', 'campaign_id=eq.' + encodeURIComponent(camp.id) + '&user_id=eq.' + sbUserId());
        return sbInsert('join_requests', { campaign_id: camp.id, user_name: sbUserName() });
    };
    const decide = (req, status) => sbPatch('join_requests', { status }, 'id=eq.' + encodeURIComponent(req.id));

    async function byCode(code) {
        const r = await sbRpc('hub_campaign_by_code', { p_code: code });
        const k = r.data && r.data[0];
        return k ? { id: k.id, name: k.name, code: k.join_code, ariaType: k.aria_type || 'ancient' } : null;
    }

    // f = the page's form state; cover = a Blob or null.
    async function create(f, cover) {
        const id = uid();
        const code = await freeJoinCode();
        const coverUrl = cover ? await sbUploadPublic('campaign-files', 'covers/' + id + '-' + Date.now() + '.jpg', cover) : null;
        const row = {
            id, save_key: await saveFor('gm'), name: f.name.trim(), join_code: code, aria_type: 'ancient',
            visibility: f.vis, pitch: f.pitch.trim() || null, tags: f.tagList, seats: f.seats,
            rhythm: HUB_RHYTHM_KEY[f.rhythm] || 'weekly',
            first_session: f.date ? new Date(f.date).toISOString() : null, cover_url: coverUrl || null,
        };
        return (await sbInsert('campaigns', row)) ? { id, code } : null;
    }

    // "Entrer" opens the campaign's Accueil (le seuil).
    const entryUrl = camp => 'aria-accueil.html?camp=' + encodeURIComponent(camp.id);

    // ── one campaign (Accueil, Fiche, Journal) ──
    // `id` may also be a join code: the player panel only knows its campaign by code.
    async function camp(id) {
        const r = await sbRpc('hub_campaigns');
        const up = String(id).toUpperCase();
        const row = (r.data || []).find(x => x.id === id) || (r.data || []).find(x => (x.join_code || '').toUpperCase() === up);
        return row ? campFromRow(row) : null;
    }

    // The account's character at this table: the one last played if it sits here,
    // else the first. { ch, saveKey } or null (a GM, or not seated yet).
    async function character(k) {
        if (!k.code || k.role === 'MJ') return null;
        const rows = await sbSelect('characters', 'campaign_key=ilike.' + encodeURIComponent(k.code) + '&select=*');
        const last = localStorage.getItem('aria-last-character');
        const row = rows.find(r => r.id === last) || rows[0];
        return row ? { ch: fromRow(ENT.character, row), saveKey: row.save_key, pending: row.pending_sheet || null } : null;
    }

    // ── sheet validation (campaigns.sheet_approval) ──
    const submitSheet = ch => sbPatch('characters', { pending_sheet: ch }, 'id=eq.' + encodeURIComponent(ch.id));
    const setApproval = (k, on) => sbPatch('campaigns', { sheet_approval: on }, 'id=eq.' + encodeURIComponent(k.id));
    const pendingSheets = async k => (await sbRpc('pending_sheets', { p_camp: k.id })).data || [];
    async function sheetForGM(charId) {
        const row = (await sbRpc('sheet_for_gm', { p_char: charId })).data;
        return row ? { ch: fromRow(ENT.character, row), pending: row.pending_sheet || null } : null;
    }
    const decideSheet = async (charId, accept) => (await sbRpc('decide_sheet', { p_char: charId, p_accept: accept })).data === true;

    // Also patches this browser's copy, which the player panel otherwise pushes back
    // on its next full sync.
    async function saveCharacter(ch, saveKey) {
        let before = null;
        try {
            const list = JSON.parse(localStorage.getItem('aria-characters') || '[]');
            const i = list.findIndex(c => c.id === ch.id);
            if (i >= 0) { before = list[i].physical || {}; list[i] = { ...list[i], ...ch }; localStorage.setItem('aria-characters', JSON.stringify(list)); }
        } catch (_) {}
        const ok = await sbPut(ENT.character, ch, saveKey);
        if (ok && before) for (const kind of ['portrait', 'backdrop']) {
            const old = before[kind];
            if (old && old !== (ch.physical || {})[kind]) dropArt(old);
        }
        return ok;
    }

    // Each upload gets a new name, so a replaced picture is deleted once the sheet
    // pointing at its successor is saved. Only this account's own art/ files can go
    // (Storage policy: uploader only); anything else is left alone.
    // ponytail: art replaced through GM validation (decide_sheet) or on another
    // device is not cleaned up — a periodic sweep of unreferenced art/ would be.
    function dropArt(url) {
        const pre = SUPABASE_URL + '/storage/v1/object/public/campaign-files/art/';
        if (!url.startsWith(pre)) return;
        fetch(SUPABASE_URL + '/storage/v1/object/campaign-files/art/' + url.slice(pre.length),
              { method: 'DELETE', headers: sbAuthHeaders() }).catch(() => {});
    }

    // Portrait / background of a character sheet; '' when the upload failed.
    const uploadArt = async (ch, kind, file) =>
        sbUploadPublic('campaign-files', 'art/' + ch.id + '-' + kind + '-' + Date.now() + '.jpg',
                       await shrinkImage(file, kind === 'backdrop' ? 1920 : 1000));

    // The reader's own notes and everyone's shared ones at this table (journal_notes()).
    async function journal(k) {
        if (!k.code) return [];
        const rows = (await sbRpc('journal_notes', { p_code: k.code })).data || [];
        return hubJournal(rows.filter(r => (r.body || '').trim() || (r.title || '').trim())
            .map(r => ({ by: r.mine ? 'me' : r.author || '—', shared: r.shared, title: r.title || 'Note', body: r.body || '', ts: Date.parse(r.created_at) || Date.now() })));
    }

    // GM: what is ready for the next sitting.
    async function prep(k) {
        const q = 'campaign_id=eq.' + encodeURIComponent(k.id) + '&select=name';
        const [maps, monsters, files, music] = await Promise.all(
            ['campaign_maps', 'monsters', 'campaign_files', 'campaign_music'].map(t => sbSelect(t, q)));
        const names = rows => rows.map(r => r.name || '—');
        return { maps: names(maps), monsters: names(monsters), files: names(files), music: names(music) };
    }

    // GM: the players this campaign has seen (the Joueurs tab's snapshot).
    async function roster(k) {
        const rows = await sbSelect('campaign_known_players', 'campaign_id=eq.' + encodeURIComponent(k.id) + '&select=char_id,data');
        return rows.map(r => ({ id: r.char_id, name: (r.data && r.data.name) || '—' }));
    }

    // Who is at the table right now: calls cb(Set of clientIds) on every change of the
    // campaign's presence set. Observes only — never enters. Returns a teardown.
    function presence(k, c, cb) {
        if (typeof Ably === 'undefined' || !k.code) return () => {};
        const body = k.role === 'MJ' ? { kind: 'gm', campaignId: k.id }
                   : c ? { kind: 'player', charId: c.ch.id, code: k.code } : null;
        if (!body) return () => {};
        const ably = ablyConnect(body);
        const chan = ably.channels.get('aria-presence-' + k.code.toUpperCase().trim());
        const read = () => chan.presence.get().then(ms => cb(new Set(ms.map(m => m.clientId)))).catch(() => {});
        chan.presence.subscribe(read).then(read, () => {});
        return () => ably.close();
    }

    return { load, freeChars, seat, ask, decide, byCode, create, loadConvs, send, markRead, entryUrl,
             camp, character, saveCharacter, uploadArt, journal, prep, roster, presence,
             submitSheet, setApproval, pendingSheets, sheetForGM, decideSheet, demo: false };
})();

// ── demo (the handoff's seed) ─────────────────────────────────────────────────
const hubDemo = (veteran) => {
    const me = 'Aldric';
    const camps = [
        { id: 'valmir', name: 'Les Cendres de Valmir', gm: 'Élise', vis: 'prive', seats: 5, taken: 4, next: 3, hour: '20:30', rhythm: 'Hebdomadaire', session: 13, tags: ['Intrigue', 'Urbain'], pitch: 'La cité brûle depuis sept nuits et personne ne sait qui entretient le feu.', role: 'Joueur' },
        { id: 'sel', name: 'La Couronne de Sel', gm: 'Aldric', vis: 'demande', seats: 4, taken: 3, next: 18, hour: '15:00', rhythm: 'Mensuelle', session: 5, tags: ['Maritime', 'Politique'], pitch: 'Un royaume côtier, une reine noyée, et une couronne que la mer refuse de rendre.', role: 'MJ' },
        { id: 'orvan', name: 'Le Puits d\'Orvan', gm: 'Tomas', vis: 'prive', seats: 3, taken: 2, next: null, hour: '', rhythm: 'Toutes les 2 semaines', session: 2, tags: ['Horreur'], pitch: 'Au fond du puits, quelque chose répond quand on l\'appelle par son nom.', role: 'Joueur' },
        { id: 'pendus', name: 'La Marche des Pendus', gm: 'Brune', vis: 'public', seats: 5, taken: 2, next: 6, hour: '21:00', rhythm: 'Hebdomadaire', session: 1, beginner: true, tags: ['Exploration'], pitch: 'Une route bordée de gibets mène à une abbaye que les cartes ont oubliée.' },
        { id: 'hollow', name: 'Nuit sur Hollowmere', gm: 'Oskar', vis: 'public', seats: 4, taken: 1, next: 2, hour: '20:00', rhythm: 'One-shot', session: 1, beginner: true, tags: ['Horreur'], pitch: 'Une seule nuit, un village sous la brume, et personne n\'y est jamais resté jusqu\'à l\'aube.' },
        { id: 'vide', name: 'Les Héritiers du Vide', gm: 'Célian', vis: 'demande', seats: 5, taken: 4, next: 9, hour: '20:30', rhythm: 'Toutes les 2 semaines', session: 8, tags: ['Campagne longue', 'Mystique'], pitch: 'Les étoiles s\'éteignent une à une. Vous êtes les derniers à savoir pourquoi.' },
        { id: 'ossu', name: 'Le Chant des Ossuaires', gm: 'Maëlle', vis: 'demande', seats: 4, taken: 4, next: 4, hour: '19:00', rhythm: 'Hebdomadaire', session: 21, tags: ['Donjon', 'Tactique'], pitch: 'Sous la capitale, les morts chantent. Et le chant descend chaque nuit un peu plus bas.' },
        { id: 'forge', name: 'La Forge Silencieuse', gm: 'Jonas', vis: 'public', seats: 6, taken: 3, next: 12, hour: '14:00', rhythm: 'Mensuelle', session: 3, beginner: true, tags: ['Artisanat', 'Enquête'], pitch: 'Le maître forgeron a disparu, laissant une lame inachevée qui murmure.' },
        { id: 'nox', name: 'Le Conclave de Nox', gm: 'Nox', vis: 'prive', seats: 4, taken: 2, next: 7, hour: '21:30', rhythm: 'Hebdomadaire', session: 4, tags: ['Occulte'], pitch: 'Sept sièges, sept masques. L\'un d\'eux est vide depuis trop longtemps.', code: 'NOX-4471' },
    ].map(k => ({ ariaType: 'ancient', ...k, gmId: k.gm, code: k.code || (k.vis === 'public' ? k.id.toUpperCase() : null) }));
    const data = veteran ? {
        camps,
        requests: [
            { id: 'r1', who: 'Soren', userId: 'Soren', camp: 'sel', text: 'Voleur des docks, trois ans de jeu derrière moi. Libre le samedi après-midi.' },
            { id: 'r2', who: 'Iris', userId: 'Iris', camp: 'sel', text: 'J\'aimerais tenter une prêtresse de la marée, si ça colle à l\'univers.' },
        ],
        convs: {
            'Élise': { who: 'Élise', camp: 'Les Cendres de Valmir', unread: 1, msgs: [{ me: false, text: 'Pensez à relire vos notes sur le quartier des Tanneurs avant samedi.', t: 'Hier' }] },
            'Brune': { who: 'Brune', camp: 'La Marche des Pendus', unread: 0, msgs: [{ me: true, text: 'Il reste de la place pour un alchimiste ?', t: 'Lun.' }, { me: false, text: 'Toujours ! Viens quand tu veux.', t: 'Lun.' }] },
        },
        friends: [
            { name: 'Élise', on: 'on', activity: 'Prépare la session 13' },
            { name: 'Maëlle', on: 'play', activity: 'En jeu · Le Chant des Ossuaires' },
            { name: 'Tomas', on: 'on', activity: 'Dans le hub' },
            { name: 'Iris', on: 'off', activity: 'Vue il y a 2 h' },
            { name: 'Jonas', on: 'off', activity: 'Vu hier' },
        ].map(f => ({ id: f.name, ...f })),
    } : {
        camps: camps.filter(k => k.gm !== me).map(k => ({ ...k, role: undefined, pending: false })),
        requests: [], convs: {}, friends: [],
    };
    return {
        demo: true,
        load: async () => ({ me: { name: me }, ready: true, ...data }),
        freeChars: () => [],
        seat: async () => ({ charId: 'demo' }),
        ask: async () => true,
        decide: async () => true,
        byCode: async code => camps.find(c => c.code === code) || null,
        create: async f => ({ id: 'c' + Date.now(), code: f.vis === 'prive'
            ? f.name.trim().replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 4).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '-' + Math.floor(1000 + Math.random() * 9000)
            : null }),
        loadConvs: null,   // no polling: the demo's replies are simulated by the page
        send: async () => true,
        markRead: () => {},
        entryUrl: k => 'aria-accueil.html?demo' + (veteran ? '=veteran' : '') + '&camp=' + encodeURIComponent(k.id),
        // Accueil / Fiche / Journal: the seeds of Aria Accueil, Fiche and Journal.dc.html
        camp: async id => {
            const k = camps.find(c => c.id === id) || camps[0];
            return { ...k, role: k.gm === me ? 'MJ' : 'Joueur', gm: k.gm === me ? 'vous' : k.gm };
        },
        character: async () => ({ ch: JSON.parse(JSON.stringify(DEMO_CHAR)), saveKey: 'demo', pending: null }),
        submitSheet: async () => true,
        setApproval: async () => true,
        pendingSheets: async () => [],
        sheetForGM: async () => ({ ch: JSON.parse(JSON.stringify(DEMO_CHAR)), pending: null }),
        decideSheet: async () => true,
        saveCharacter: async () => true,
        uploadArt: async (_ch, _kind, blob) => URL.createObjectURL(blob),
        journal: async () => DEMO_JOURNAL,
        prep: async () => ({ maps: ['Quartier des Tanneurs'], monsters: ['Maître Oren', 'la veuve Hasse', 'deux gardes', 'brûleur'], files: [], music: ['Incendie lointain', 'Cloches'] }),
        roster: async () => ['Soren', 'Iris', 'Maëlle'].map(n => ({ id: n, name: n })),
        // the prototype's arrivals: two at the door, one more every 5.2 s
        presence: (k, _c, cb) => {
            let n = 2;
            const emit = () => cb(new Set(Array.from({ length: n }, (_, i) => i ? 'p' + i : 'gm-demo')));
            emit();
            const iv = setInterval(() => { if (n < k.taken + 1) { n++; emit(); } else clearInterval(iv); }, 5200);
            return () => clearInterval(iv);
        },
    };
};

// The Journal's seed (Aria Journal.dc.html, DATA).
const DEMO_JOURNAL = [
    { n: 1, title: 'Arrivée à Brumecombe', date: '14 juin 2026', present: 'Kaelen, Maelis, Brogan, Syle', notes: [
      { by: 'me', shared: false, title: 'Premières impressions', body: 'Le village est à moitié vide. Les volets sont cloués côté rue, pas côté champ — ils ont peur de quelque chose qui vient de la route.\n\nL’aubergiste, Hodric, refuse de parler de la chapelle.' },
      { by: 'Maelis', shared: true, title: 'Qui est qui', body: 'Hodric (auberge), la veuve Orla (vit près de la chapelle), le bailli Fenn (absent depuis deux semaines).' } ] },
    { n: 2, title: 'La route des corbeaux', date: '21 juin 2026', present: 'Kaelen, Maelis, Brogan', notes: [
      { by: 'me', shared: false, title: 'Traces sur la route', body: 'Empreintes de petits pieds nus, griffus. Gobelins, au moins six. Ils traînaient quelque chose de lourd vers le nord.' },
      { by: 'Brogan', shared: true, title: 'Le chariot', body: 'Chariot du bailli Fenn retrouvé renversé. Pas de corps. Le coffre a été forcé de l’intérieur.' } ] },
    { n: 3, title: 'Le camp gobelin', date: '28 juin 2026', present: 'Kaelen, Maelis, Brogan, Syle', notes: [
      { by: 'me', shared: true, title: 'Ce qu’on a trouvé', body: 'Le camp était abandonné à notre arrivée. Les gobelins fuyaient eux aussi la brume.\n\nUn symbole gravé sur un poteau : un œil fermé dans un cercle. Le même que sur la dague de Valcendre.' } ] },
    { n: 4, title: 'Veldros', date: '5 juillet 2026', present: 'Kaelen, Maelis, Syle', notes: [
      { by: 'me', shared: true, title: 'Le pacte de Veldros', body: 'Veldros a promis de lever la malédiction du village si on lui rapporte l’amulette. Maelis ne lui fait pas confiance.' },
      { by: 'me', shared: false, title: 'Ce que je n’ai pas dit', body: 'Veldros connaissait le nom de Valcendre. Personne ne lui en avait parlé. Je garde ça pour moi tant que je ne sais pas ce qu’il veut.' },
      { by: 'Syle', shared: true, title: 'Dette', body: 'On doit 40 pièces d’argent à Veldros pour les herbes de soin. Il a dit « on verra plus tard ».' } ] },
    { n: 5, title: 'La crypte sous la chapelle', date: '19 juillet 2026', present: 'Kaelen, Maelis, Brogan, Syle', notes: [
      { by: 'me', shared: true, title: 'Plan de la crypte', body: 'Trois salles. La troisième est scellée par une porte sans serrure, avec le même œil fermé.\n\nBrogan a failli tomber dans une fosse à pieux près de l’entrée — signalée à la craie.' },
      { by: 'Maelis', shared: true, title: 'Inscriptions', body: '« Ce qui dort sous la brume ne doit pas voir. » Écrit en ancien valcendrien.' } ] },
    { n: 6, title: 'Orla', date: '2 août 2026', present: 'Kaelen, Maelis, Brogan', notes: [
      { by: 'me', shared: false, title: 'L’anneau', body: 'Orla m’a confié un anneau, en secret. Froid au toucher, même près du feu. Elle dit qu’il appartenait à son fils, garde à Valcendre.\n\nElle pense qu’il est encore vivant, quelque part dans la brume.' } ] },
    { n: 7, title: 'L’incendie', date: '23 août 2026', present: 'Kaelen, Maelis, Brogan, Syle', notes: [
      { by: 'Brogan', shared: true, title: 'Ce qui a brûlé', body: 'L’auberge de Hodric. Hodric a survécu. Il accuse Veldros, sans preuve.' },
      { by: 'me', shared: true, title: 'Pistes', body: 'Odeur de résine et de soufre. Ce n’est pas un accident. Les traces partent vers le puits.' } ] },
    { n: 8, title: 'Le puits', date: '13 septembre 2026', present: 'Kaelen, Maelis, Syle', notes: [
      { by: 'me', shared: true, title: 'Au fond du puits', body: 'Un passage taillé, sec, qui mène vers la chapelle. Quelqu’un l’utilise régulièrement — les toiles d’araignée sont arrachées à hauteur d’homme.' },
      { by: 'Maelis', shared: true, title: 'L’amulette ?', body: 'Une niche vide à mi-chemin, de la forme d’un médaillon. Quelqu’un est passé avant nous.' } ] },
    { n: 9, title: 'La chapelle effondrée', date: '27 septembre 2026', present: 'Kaelen, Maelis, Brogan, Syle', notes: [
      { by: 'me', shared: true, title: 'Ce qu’il faut retenir', body: 'La porte scellée de la crypte s’est ouverte quand j’ai approché l’anneau d’Orla. Derrière : le bailli Fenn, vivant, enchaîné, les yeux bandés.\n\nIl porte l’amulette autour du cou. Il dit que si on la retire, « il nous verra ».' },
      { by: 'me', shared: false, title: 'À faire la prochaine fois', body: 'Demander à Fenn qui a ouvert les portes de Valcendre. Ne pas laisser Veldros approcher de lui avant.' },
      { by: 'Syle', shared: true, title: 'État du groupe', body: 'Brogan à 6 PV, plus de bandages. Il nous reste deux potions de soin et une torche.' } ] },
];

// Kaelen, the Fiche's seed, in the character shape of the panels.
const DEMO_CHAR = {
    id: 'demo', name: 'Kaelen Vorr', class: 'Rôdeur', ariaType: 'ancient', campaignKey: 'VALMIR',
    stats: { FOR: 12, DEX: 16, END: 13, INT: 14, CHA: 10, PV: 24 },
    physical: {
        level: '5', origine: 'Né aux Landes-Grises · éclaireur de la Garde du Nord',
        age: '31 ans', taille: '1m84', poids: '78 kg', yeux: 'Gris orage', cheveux: 'Noirs, nattés', signes: 'Cicatrice à la mâchoire',
        personnalite: 'Taciturne, observe avant de parler. Loyal jusqu’à l’excès envers ceux qui l’ont sorti des landes. Méfiant envers tout ce qui touche à la magie.',
        histoire: 'Kaelen a grandi dans un hameau de chasseurs, au bord des Landes-Grises. L’hiver de ses quatorze ans, la brume est descendue et n’est jamais repartie : le hameau s’est vidé en une nuit.\n\nRecueilli par la Garde du Nord, il a passé quinze ans à pister ce qui sort de la brume. Il a quitté la Garde après la chute du fort de Valcendre, convaincu que quelqu’un, à l’intérieur, avait ouvert les portes.\n\nIl suit aujourd’hui le groupe parce que Veldros prétend savoir d’où vient la brume.',
    },
    skills: [{ name: 'Tir à l’arc', link: 'DEX', pct: 78 }, { name: 'Discrétion', link: 'DEX', pct: 65 }, { name: 'Pister', link: 'INT', pct: 71 }, { name: 'Survie', link: 'INT', pct: 60 }, { name: 'Perception', link: 'INT', pct: 68 }, { name: 'Escalade', link: 'FOR', pct: 52 }, { name: 'Intimidation', link: 'CHA', pct: 34 }],
    specials: [{ name: 'Œil du rôdeur', pct: 70, desc: 'Détecte pièges et passages dissimulés.' }, { name: 'Tir de précision', pct: 45, desc: 'Ignore la moitié de l’armure sur un succès.' }],
    weapons: [
        { nom: 'Arc long en if', degats: '1d8', favourite: true, story: 'Taillé par son père, la poignée porte encore ses initiales.' },
        { nom: 'Dague de Valcendre', degats: '1d4', favourite: false, story: 'Ramassée dans les ruines du fort — elle n’appartient à aucun garde connu.' },
    ],
    protection: { nom: 'Cuir clouté', valeur: 2, story: 'Uniforme de la Garde, insigne arraché.' },
    inventory: [{ name: 'Anneau d’Orla', qty: 1, story: 'Confié par Orla à la chapelle. Froid au toucher, même près du feu.' },
        ...['Flèches', 'Corde', 'Torche', 'Rations', 'Silex', 'Gourde', 'Bandages', 'Cape'].map(name => ({ name, qty: 1 }))],
};


const _hubDemoParam = new URLSearchParams(location.search).get('demo');
const hubData = _hubDemoParam === null ? hubLive : hubDemo(/^v/i.test(_hubDemoParam));
