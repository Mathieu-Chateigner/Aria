// ═══════════════════════════════════════════
//  SUPABASE SHARED PRIMITIVES
//  Loaded before aria-player.js and aria-gm.js
// ═══════════════════════════════════════════
const SUPABASE_URL      = 'https://npybuksklkvdmbhyzdjs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hUkdwmlgNNhLXn6t38GHHg_N7XXVOn4';

// ═══════════════════════════════════════════
//  SESSION
// ═══════════════════════════════════════════
// Every table but two is now behind RLS keyed on saves.owner, so a request without
// a session reads nothing and writes nothing. The two exceptions are what the OBS
// overlay needs with no session at all: overlay_configs, and its Ably token, which
// the ably-token function issues against the save key alone. See specs/auth_rls.sql
// and specs/ably_token.sql.
//
// The session is the anon key's replacement as the Authorization bearer — the anon
// key stays in `apikey`, which is what routes the request to the project. A page
// with no session (the overlay) sends the anon key as both, exactly as before.
//
// ARIA_ANON_ONLY is set by the overlay page. It shares an origin — and therefore
// localStorage — with the panels, but has no business holding a session: reading one
// would make a failed refresh there sign the panel out in the next tab. Anonymous is
// also exactly what the RLS design grants it (see specs/auth_rls.sql).
let _session = null;
if (!window.ARIA_ANON_ONLY) {
    try { _session = JSON.parse(localStorage.getItem('aria-session') || 'null'); } catch(e) {}
    // "Se souvenir de moi" unticked: the session lives only as long as the browser.
    // A session cookie (no expiry) is shared by every tab and dies with the browser,
    // which sessionStorage is not and does not. Off file:// cookies are not kept, so
    // there an unremembered session lasts a single page.
    if (_session && localStorage.getItem('aria-forget') === '1' && !/(^|; )aria-alive=1/.test(document.cookie)) {
        _session = null;
        localStorage.removeItem('aria-session');
        localStorage.removeItem('aria-forget');
    }
}

// Keep the session after the browser closes, or only until then.
function sbRemember(keep) {
    if (keep) localStorage.removeItem('aria-forget');
    else { localStorage.setItem('aria-forget', '1'); document.cookie = 'aria-alive=1; path=/; SameSite=Lax'; }
}

function sbAccessToken() { return _session && _session.access_token || null; }
function sbUserId()      { return _session && _session.user && _session.user.id || null; }
function sbUserEmail()   { return _session && _session.user && _session.user.email || ''; }
// Display name given at signup (user_metadata.name; Google and Discord fill it too,
// Discord's display name sits in custom_claims.global_name), else the mail's local part.
function sbUserName() {
    const m = _session && _session.user && _session.user.user_metadata;
    return (m && ((m.custom_claims && m.custom_claims.global_name) || m.name || m.full_name)) || sbUserEmail().split('@')[0];
}
function sbSignedIn()    { return !!sbAccessToken(); }

// The one description of how a request authenticates. The GM's four Storage calls
// build their own fetch and used to inline the anon key twice each; they call this
// instead, so a page that is signed in cannot end up uploading as anon.
function sbAuthHeaders() {
    return {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + (sbAccessToken() || SUPABASE_ANON_KEY),
    };
}

function _storeSession(s) {
    // GoTrue returns expires_in (seconds from now); expires_at is what we can
    // actually compare against later, so derive it once here rather than at
    // every check.
    if (s && s.access_token) {
        _session = { ...s, expires_at: s.expires_at || (Date.now() / 1000 + (s.expires_in || 3600)) };
        localStorage.setItem('aria-session', JSON.stringify(_session));
    } else {
        _session = null;
        if (!window.ARIA_ANON_ONLY) localStorage.removeItem('aria-session');
    }
    return _session;
}

function _authFetch(path, body) {
    return fetch(SUPABASE_URL + '/auth/v1/' + path, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

// Create an account. Email confirmation is on (an unconfirmed address would let a
// stranger pre-register someone's mail, then inherit their Google/Discord sign-in by
// automatic identity linking), so GoTrue answers with a user and no token: the
// caller says "check your mail". The link lands on redirectTo with #access_token,
// which sbAdoptOAuth() adopts like an OAuth return.
// GoTrue errors come back as { error_code } (newer) and an English message; the
// code is returned so pages can word their own French message.
async function sbSignUp(email, password, name, redirectTo) {
    const res  = await _authFetch('signup' + (redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : ''),
                                  { email, password, data: name ? { name } : undefined });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.msg || body.error_description || 'Inscription refusée.', code: body.error_code || '' };
    if (!body.access_token) return { ok: true, pending: true };
    _storeSession(body);
    return { ok: true };
}

async function sbSignIn(email, password) {
    const res  = await _authFetch('token?grant_type=password', { email, password });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) {
        return { error: body.error_description || body.msg || 'Identifiants refusés.', code: body.error_code || '' };
    }
    _storeSession(body);
    return { ok: true };
}

// Send the reset link. GoTrue answers 200 whether or not the address has an account.
async function sbRecover(email, redirectTo) {
    const res = await _authFetch('recover' + (redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : ''), { email });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { error: body.msg || 'Envoi refusé.', code: body.error_code || '' };
}

// The reset link lands with #access_token=…&type=recovery: adopt that session so the
// new password can be written. Returns true when the URL carried one.
function sbAdoptRecovery() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('type') !== 'recovery' || !h.get('access_token')) return false;
    _storeSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'),
                    expires_in: +h.get('expires_in') || 3600, user: null });
    history.replaceState(null, '', location.pathname + location.search);
    return true;
}

// Google / Discord: GoTrue's own consent round trip (implicit flow), back to redirectTo.
function sbOAuthUrl(provider, redirectTo) {
    return SUPABASE_URL + '/auth/v1/authorize?provider=' + provider + '&redirect_to=' + encodeURIComponent(redirectTo);
}

// The return from sbOAuthUrl: #access_token=… (no type), or ?error= / #error= when the
// visitor refused. Fetches the user so sbUserId() works before leaving the page.
// Returns null when the URL carried neither. The provider's own tokens are dropped.
async function sbAdoptOAuth() {
    const h = new URLSearchParams(location.hash.slice(1)), q = new URLSearchParams(location.search);
    const error = h.get('error') || q.get('error');
    const token = h.get('access_token');
    if (!error && !token) return null;
    history.replaceState(null, '', location.pathname);
    if (error) return { error: h.get('error_description') || q.get('error_description') || error };
    const res = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token } });
    const user = await res.json().catch(() => null);
    if (!res.ok || !user || !user.id) return { error: 'Session refusée.' };
    _storeSession({ access_token: token, refresh_token: h.get('refresh_token'),
                    expires_at: +h.get('expires_at') || 0, expires_in: +h.get('expires_in') || 3600, user });
    return { ok: true };
}

async function sbSetPassword(password) {
    const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
        method: 'PUT', headers: { ...sbAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.msg || 'Refusé.', code: body.error_code || '' };
    _storeSession({ ..._session, user: body });
    return { ok: true };
}

function sbSignOut() {
    const tok = sbAccessToken();
    if (tok) {
        fetch(SUPABASE_URL + '/auth/v1/logout', {
            method: 'POST',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + tok },
        }).catch(() => {});
    }
    _storeSession(null);
}

// Exchange the refresh token for a new access token. Returns false when the refresh
// token itself is dead (password changed, session revoked, weeks offline), and drops
// the session in that case so the caller falls back to the sign-in panel rather than
// retrying forever.
let _refreshing = null;
function sbRefreshSession() {
    if (_refreshing) return _refreshing;          // concurrent syncs must not each refresh
    const rt = _session && _session.refresh_token;
    if (!rt) return Promise.resolve(false);
    _refreshing = (async () => {
        const res  = await _authFetch('token?grant_type=refresh_token', { refresh_token: rt });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.access_token) { _storeSession(null); return false; }
        _storeSession(body);
        return true;
    })().catch(() => false).finally(() => { _refreshing = null; });
    return _refreshing;
}

// Refresh a minute before expiry rather than waiting for the 401: a sync fires a
// dozen requests at once, and letting them all fail first would retry the lot.
function _sbFreshSession() {
    if (!_session || !_session.expires_at) return Promise.resolve();
    if (_session.expires_at - 60 > Date.now() / 1000) return Promise.resolve();
    return sbRefreshSession();
}

// Attach an existing save key to the signed-in account. Keys created before accounts
// existed have owner null, so RLS hides them from everyone until their holder claims
// one here. Returns false for an unknown key, or one already held by someone else.
async function sbClaimSaveKey(key) {
    const res = await _sbFetch('/rest/v1/rpc/claim_save_key', {
        method: 'POST',
        body: JSON.stringify({ p_key: key }),
    });
    if (!res.ok) { console.warn('[ARIA] claim_save_key failed:', await res.text()); return false; }
    return await res.json().catch(() => false) === true;
}

// ═══════════════════════════════════════════
//  ABLY — per-client tokens
// ═══════════════════════════════════════════
// No page holds the Ably key any more. It is a secret of the `ably-token` Edge
// Function (supabase/functions/ably-token), which checks the session against the
// database and signs a TokenRequest whose clientId is bound (a player IS their
// charId, the GM IS 'gm-<campaignId>') and whose capabilities are per channel.
// So every consumer can trust msg.clientId and member.clientId — that is what the
// "GM only" checks in the panels and the overlay rest on.
//
// `body` is the token request ({ kind:'player', charId, code }, …) or a function
// returning it, evaluated at each renewal so a later token follows the current
// character / join code. The overlay has no session: sbAuthHeaders() then sends the
// publishable key and the function treats it as anonymous (kind 'overlay' only).
const ABLY_TOKEN_URL = SUPABASE_URL + '/functions/v1/ably-token';

// Browsers from before this still hold the root key in aria-config. Nothing reads it
// any more; leaving it there would keep a secret on every machine that ever played.
try {
    const _cfg = JSON.parse(localStorage.getItem('aria-config') || '{}');
    if ('ablyKey' in _cfg) { delete _cfg.ablyKey; localStorage.setItem('aria-config', JSON.stringify(_cfg)); }
} catch (_) {}

async function ablyToken(body) {
    await _sbFreshSession();
    const res = await fetch(ABLY_TOKEN_URL, {
        method: 'POST',
        headers: { ...sbAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.tokenRequest) throw new Error('ably-token ' + res.status + ' ' + (out.error || ''));
    return out;   // { tokenRequest, clientId, self }
}

// `first` is an already-fetched ablyToken() reply, for callers that needed its
// `self` before connecting — the first handshake reuses it instead of asking twice.
function ablyConnect(body, first) {
    let pending = first || null;
    return new Ably.Realtime({
        authCallback: (_params, cb) => {
            const p = pending ? Promise.resolve(pending) : ablyToken(typeof body === 'function' ? body() : body);
            pending = null;
            p.then(o => cb(null, o.tokenRequest), e => { console.error('[ARIA] Ably token:', e.message); cb(e.message, null); });
        },
        transports: ['web_socket'],
    });
}

// Who published this: 'gm' for any GM connection, else the bound clientId (a charId,
// or 'u_…' from the rendez-vous board). Chat authorship is checked against it.
function ablySender(clientId) {
    const c = String(clientId || '');
    return c.startsWith('gm-') ? 'gm' : c;
}
const ablyFromGM = msg => String(msg && msg.clientId || '').startsWith('gm-');

// Is this join code already in use — by anyone, not just by us?
//
// It has to be asked of the database rather than of our own campaign list: a code
// names the Ably channels, so a duplicate held by another account is exactly the
// collision worth avoiding, and RLS hides that account's campaigns from us. The
// function behind it is `security definer` for that reason (specs/join_code_unique.sql).
//
// A network failure answers "taken", which costs a retry and never a collision —
// the opposite default would hand out a duplicate the moment Supabase blinked.
async function sbJoinCodeTaken(code) {
    const res = await _sbFetch('/rest/v1/rpc/join_code_taken', {
        method: 'POST',
        body: JSON.stringify({ p_code: code }),
    });
    if (!res.ok) { console.warn('[ARIA] join_code_taken failed:', await res.text()); return true; }
    return await res.json().catch(() => true) !== false;
}

// The save keys this account owns. RLS does the filtering, so there is no `owner`
// filter to write here — and no way for it to return someone else's.
async function sbOwnedSaves() {
    return await sbSelect('saves', 'select=save_key,type,updated_at&order=updated_at.desc');
}

// Internal Supabase REST fetch, authenticated as the signed-in user when there is one.
async function _sbFetch(path, options = {}, _retry = true) {
    await _sbFreshSession();
    const res = await fetch(SUPABASE_URL + path, {
        ...options,
        headers: {
            ...sbAuthHeaders(),
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    // A 401 that survives a refresh means the session is gone, not stale — falling
    // through returns it to the caller, which reports the failure as any other.
    if (res.status === 401 && _retry && _session && await sbRefreshSession()) {
        return _sbFetch(path, options, false);
    }
    return res;
}

// Upsert a row into a Supabase table, merging on conflict.
async function sbUpsert(table, row, onConflict) {
    const qs = onConflict ? '?on_conflict=' + onConflict : '';
    try {
        const res = await _sbFetch('/rest/v1/' + table + qs, {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify(row),
        });
        if (!res.ok) console.warn('[ARIA] sbUpsert failed:', table, await res.text());
        return res.ok;
    } catch(e) { console.warn('[ARIA] sbUpsert error:', table, e); return false; }
}

// Delete rows from a Supabase table matching a filter string.
async function sbDelete(table, filterStr) {
    try {
        const res = await _sbFetch('/rest/v1/' + table + '?' + filterStr, { method: 'DELETE' });
        if (!res.ok) console.warn('[ARIA] sbDelete failed:', table, await res.text());
    } catch(e) { console.warn('[ARIA] sbDelete error:', table, e); }
}

// Fetch rows from a Supabase table matching a filter string.
async function sbSelect(table, filterStr) {
    try {
        const res = await _sbFetch('/rest/v1/' + table + '?' + filterStr);
        if (!res.ok) { console.warn('[ARIA] sbSelect failed:', table, await res.text()); return []; }
        return await res.json();
    } catch(e) { console.warn('[ARIA] sbSelect error:', table, e); return []; }
}

// Insert a new row into a Supabase table. Returns whether it landed — a unique
// constraint or an RLS refusal comes back false, and a caller that cannot simply
// log and move on (the rendez-vous sign-up) says so to the user instead.
async function sbInsert(table, row) {
    try {
        const res = await _sbFetch('/rest/v1/' + table, {
            method: 'POST',
            body: JSON.stringify(row),
        });
        if (!res.ok) console.warn('[ARIA] sbInsert failed:', table, await res.text());
        return res.ok;
    } catch(e) { console.warn('[ARIA] sbInsert error:', table, e); return false; }
}

// Partially update rows in a Supabase table matching a filter.
async function sbPatch(table, row, filterStr) {
    try {
        const res = await _sbFetch('/rest/v1/' + table + '?' + filterStr, {
            method: 'PATCH',
            body: JSON.stringify(row),
        });
        if (!res.ok) console.warn('[ARIA] sbPatch failed:', table, await res.text());
        return res.ok;
    } catch(e) { console.warn('[ARIA] sbPatch error:', table, e); return false; }
}

// Call a Postgres function. { ok, data } — data is the parsed JSON body (rows for a
// set-returning function), null on failure.
async function sbRpc(name, args = {}) {
    try {
        const res = await _sbFetch('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(args) });
        if (!res.ok) { console.warn('[ARIA] sbRpc failed:', name, await res.text()); return { ok: false, data: null }; }
        return { ok: true, data: await res.json().catch(() => null) };
    } catch(e) { console.warn('[ARIA] sbRpc error:', name, e); return { ok: false, data: null }; }
}

// Upload a file to a public bucket under `path`; returns its public URL, or '' on
// failure. Overwrites are refused (x-upsert false): pick a fresh path per upload.
async function sbUploadPublic(bucket, path, blob) {
    try {
        await _sbFreshSession();
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
            method: 'POST',
            headers: { ...sbAuthHeaders(), 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'false' },
            body: blob,
        });
        if (!res.ok) { console.warn('[ARIA] upload failed:', bucket, await res.text()); return ''; }
        return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
    } catch(e) { console.warn('[ARIA] upload error:', bucket, e); return ''; }
}

// ═══════════════════════════════════════════
//  ENTITY MAPPING
// ═══════════════════════════════════════════
// The camelCase-object ↔ snake_case-row mapping for each table, written once.
//
// It used to be written four times per entity — in runMigration, in the panel's
// sync{X}, again in the panel's _syncAll{X}Data, and once more reversed inside
// loadFromSupabase — about thirty hand-maintained copies in all. They drifted, and
// every compensating mechanism downstream (the "restore child tables
// unconditionally" rule, the resurrection bug behind it) was paying for that drift.
// Adding a column now means adding one line here.
//
// A field is `jsKey: 'column'`, or `jsKey: { col, to, from, def }` when it needs a
// coercion on write (`to`), on read (`from`), or a fallback for a null column
// (`def`, called if it is a function so each object gets its own array/object).
const _ENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

function _fieldSpec(spec) { return typeof spec === 'string' ? { col: spec } : spec; }

// Current UTC time as an ISO 8601 string.
function _nowISO() { return new Date().toISOString(); }

// Build a Supabase row from a JS object. `parentId` fills the entity's FK column;
// `extra` adds computed columns the object does not carry (notes/music `position`)
// and wins over the timestamp, so a replayed row can keep its original one.
// `entity.stamp` names the timestamp column, or is null for tables without one.
function toRow(entity, obj, parentId, extra = {}) {
    const row = {};
    for (const [key, raw] of Object.entries(entity.fields)) {
        const f = _fieldSpec(raw);
        const v = f.to ? f.to(obj[key], obj) : obj[key];
        row[f.col] = v === undefined ? null : v;
    }
    if (entity.parent) row[entity.parent] = parentId;
    const stamp = entity.stamp === undefined ? 'updated_at' : entity.stamp;
    return { ...row, ...(stamp ? { [stamp]: _nowISO() } : {}), ...extra };
}

// Build the JS object back from a Supabase row.
function fromRow(entity, row) {
    const obj = {};
    for (const [key, raw] of Object.entries(entity.fields)) {
        const f = _fieldSpec(raw);
        const v = row[f.col];
        if (f.from) { obj[key] = f.from(v, row); continue; }
        obj[key] = (v === null || v === undefined)
            ? (typeof f.def === 'function' ? f.def() : f.def)
            : v;
    }
    return obj;
}

// Upsert one object, and one array of objects (position = array index).
function sbPut(entity, obj, parentId, extra) {
    return sbUpsert(entity.table, toRow(entity, obj, parentId, extra), entity.onConflict);
}
// One request for the whole list: PostgREST upserts an array body in one statement.
// Safe because toRow() always emits every column (undefined → null), so all rows
// share one key set. One bad row now fails the batch rather than only itself.
function sbPutAll(entity, list, parentId, positioned = false) {
    const rows = (list || []).map((o, i) => toRow(entity, o, parentId, positioned ? { position: i } : undefined));
    return rows.length ? sbUpsert(entity.table, rows, entity.onConflict) : Promise.resolve(true);
}

const _str = v => v ?? '';
const _orNull = v => v || null;
const _arr = () => [];
const _obj = () => ({});

const ENT = {
    character: {
        table: 'characters', parent: 'save_key',
        fields: {
            id: 'id', name: 'name', class: 'class',
            campaignKey:   { col: 'campaign_key',   to: _orNull, def: '' },
            ariaType:      { col: 'aria_type',      to: v => v || 'ancient', def: 'ancient' },
            stats:         { col: 'stats',          to: _orNull, def: _obj },
            physical:      { col: 'physical',       to: _orNull, def: _obj },
            skills:        { col: 'skills',         to: _orNull, def: _arr },
            specials:      { col: 'specials',       to: _orNull, def: _arr },
            weapons:       { col: 'weapons',        to: _orNull, def: _arr },
            protection:    { col: 'protection',     to: _orNull, def: _obj },
            inventory:     { col: 'inventory',      to: _orNull, def: _arr },
            potionRecipes: { col: 'potion_recipes', to: _orNull, def: _arr },
            potions:       { col: 'potions',        to: _orNull, def: _arr },
            substances:    { col: 'substances',     to: _orNull, def: _arr },
            money:         { col: 'money',          to: _orNull, def: null },
            vials:         { col: 'vials',          to: v => v || 0, def: 0 },
            karma:         { col: 'karma',          to: v => v ?? 0, def: 0 },
        },
    },
    characterNote: {
        table: 'character_notes', parent: 'character_id',
        fields: { id: 'id', name: { col: 'name', to: _str, def: '' }, content: { col: 'content', to: _str, def: '' },
                  shared: { col: 'shared', to: v => !!v, def: false } },
    },
    // Written through _charStateRow() in aria-player.js rather than toRow(), because
    // its source is three separate localStorage keys rather than one object. Listed
    // here so the character delete cascade covers it.
    characterState: {
        table: 'character_state', parent: 'character_id', fields: {},
    },
    characterRoll: {
        table: 'character_rolls', parent: 'character_id', stamp: null,
        fields: {
            skillName:  { col: 'skill_name',  to: _str },
            threshold:  { col: 'threshold',   to: v => v ?? null },
            roll: 'roll',
            success:    { col: 'success',     to: v => v ?? null },
            bonusMalus: { col: 'bonus_malus', to: v => v || 0, def: 0 },
            ts: 'ts',
        },
    },
    characterFile: {
        table: 'character_files', parent: 'character_id',
        // `id` and `file_id` both carry the file's id; reads take file_id.
        fields: {
            id:   { col: 'file_id', to: v => v },
            name: { col: 'name', to: _str, def: '' }, type: { col: 'type', to: _str, def: '' }, url: { col: 'url', to: _str, def: '' },
        },
    },
    campaign: {
        table: 'campaigns', parent: 'save_key',
        fields: {
            id: 'id', name: 'name',
            joinCode:         { col: 'join_code',         to: _orNull, def: '' },
            vdoRoom:          { col: 'vdo_room',          to: _orNull, def: '' },
            vdoRoomPassword:  { col: 'vdo_room_password', to: _orNull, def: '' },
            ariaType:         { col: 'aria_type',         to: v => v || 'ancient', def: 'ancient' },
        },
    },
    monster: {
        table: 'monsters', parent: 'campaign_id',
        fields: {
            id:      { col: 'id', to: v => String(v) },
            name: 'name', pv: 'pv',
            maxPV:   { col: 'max_pv' },
            armor:   { col: 'armor',   to: v => v || 0, def: 0 },
            stats:   { col: 'stats',   to: _orNull, def: _obj },
            attacks: { col: 'attacks', to: _orNull, def: _arr },
        },
    },
    potion: {
        table: 'campaign_potions', parent: 'campaign_id',
        fields: {
            id: 'id', name: 'name',
            desc:          { col: 'description',    to: _str, def: '' },
            ingredients:   { col: 'ingredients',    to: _orNull, def: '' },
            successChance: { col: 'success_chance', to: v => v || 0, def: 0 },
        },
    },
    campaignFile: {
        table: 'campaign_files', parent: 'campaign_id',
        fields: {
            id: 'id', name: 'name',
            type:      { col: 'type', to: _str, def: '' }, url: { col: 'url', to: _str, def: '' }, path: { col: 'path', to: _str, def: '' },
            grantedTo: { col: 'granted_to', to: v => v || [], def: _arr },
        },
    },
    // pois/positions are jsonb: a map carries its own tokens and its own fog, so
    // switching the active map moves nothing. The parent being campaign_id, the
    // delete cascade picks the table up from childTables() with nothing to wire.
    map: {
        table: 'campaign_maps', parent: 'campaign_id',
        fields: {
            id: 'id', name: 'name',
            imageUrl:  { col: 'image_url',  to: _str, def: '' },
            imagePath: { col: 'image_path', to: _str, def: '' },
            sourceUrl: { col: 'source_url', to: _str, def: '' },
            pois:      { col: 'pois',       to: _orNull, def: _arr },
            positions: { col: 'positions',  to: _orNull, def: _obj },
            // Tactical map (specs/campaign_maps_tactique.sql): coordinates in image pixels
            // instead of percentages, so a square cell stays square.
            kind:      { col: 'kind',       to: v => v === 'tactique' ? 'tactique' : 'monde', def: 'monde' },
            size:      { col: 'size',       to: _orNull, def: null },
            grid:      { col: 'grid',       to: _orNull, def: null },
            tokens:    { col: 'tokens',     to: _orNull, def: _arr },   // [{ id, ref, x, y, size, hidden, markers }]
            moves:     { col: 'moves',      to: v => v === 'validation' ? 'validation' : 'libre', def: 'libre' },
        },
    },
    music: {
        table: 'campaign_music', parent: 'campaign_id',
        fields: {
            id: 'id', name: 'name', type: 'type',
            url:       { col: 'url',        to: _orNull, def: null },
            youtubeId: { col: 'youtube_id', to: _orNull, def: null },
            path:      { col: 'path',       to: _orNull, def: null },
        },
    },
    campaignNote: {
        table: 'campaign_notes', parent: 'campaign_id',
        fields: {
            id: 'id',
            name:    { col: 'name',    to: v => v || 'Note', def: 'Note' },
            content: { col: 'content', to: _str, def: '' },
            shared:  { col: 'shared',  to: v => !!v, def: false },
        },
    },
    knownPlayer: {
        table: 'campaign_known_players', parent: 'campaign_id',
        onConflict: 'campaign_id,char_id',
        fields: {
            charId: { col: 'char_id' },
            data:   { col: 'data' },
        },
    },
    // Append-only log tables: no primary key of ours, stamped created_at.
    roll: {
        table: 'campaign_rolls', parent: 'campaign_id', stamp: 'created_at',
        fields: {
            skillName:  { col: 'skill_name', to: _str },
            threshold:  { col: 'threshold',  to: v => v ?? null },
            roll: 'roll',
            success:    { col: 'success',    to: v => !!v },
            char:       { col: 'char_name',  to: (v, o) => v || o.playerId || '' },
            bonusMalus: { col: 'bonus_malus', to: v => v || 0 },
        },
    },
    cardDraw: {
        table: 'campaign_card_history', parent: 'campaign_id', stamp: 'drawn_at',
        fields: { cardId: { col: 'card_id', to: _str } },
    },
};

// Every table whose rows hang off `parentCol`. Delete cascades are built from this
// rather than by listing the tables again — a new child entity is covered the
// moment it is added to ENT, instead of silently leaking rows until someone
// notices the delete path never learned about it.
function childTables(parentCol) {
    return Object.values(ENT).filter(e => e.parent === parentCol).map(e => e.table);
}

// Delete a parent row and every child row that references it.
function sbDeleteCascade(entity, parentCol, id) {
    const f = 'eq.' + encodeURIComponent(id);
    return Promise.all([
        sbDelete(entity.table, 'id=' + f),
        ...childTables(parentCol).map(t => sbDelete(t, parentCol + '=' + f)),
    ]);
}

// character_files needs its own primary key alongside file_id, and known_players a
// composite one. Both are computed from the object rather than stored on it.
function sbPutFile(file, charId) {
    return sbUpsert(ENT.characterFile.table,
        { ...toRow(ENT.characterFile, file, charId), id: file.id },
        ENT.characterFile.onConflict);
}
// Two presence updates in a row upsert the same row at once; with two unique keys
// (the pkey and (campaign_id, char_id)) the loser of that race gets a 409. One at a time.
const _knownPlayerPuts = {};
function sbPutKnownPlayer(charId, data, campaignId) {
    if (!_ENT_ID.test(String(charId))) return Promise.resolve(false);
    const id = charId + ':' + campaignId;
    return _knownPlayerPuts[id] = (_knownPlayerPuts[id] || Promise.resolve()).then(() => sbUpsert(ENT.knownPlayer.table,
        { ...toRow(ENT.knownPlayer, { charId, data }, campaignId), id }, ENT.knownPlayer.onConflict));
}

// ═══════════════════════════════════════════
//  MIGRATION — one-time blob → relational
// ═══════════════════════════════════════════
// One-time migration: moves old JSON blob data into the relational schema. Every
// mapping here now comes from ENT, so this cannot drift from the live sync path —
// which is what made the previous hand-written copy dangerous rather than merely
// verbose (it wrote `character_notes.name` defaulted to 'Note' where the live path
// defaulted to '', and it never learned about aria_type, potions, money or karma).
async function runMigration(saveKey, type) {
    const keyFilter = 'save_key=eq.' + encodeURIComponent(saveKey);

    // Read the blob once, and only if this save key has not been migrated yet.
    async function pendingBlob(flagCol) {
        const flagRows = await sbSelect('saves', keyFilter + '&select=' + flagCol);
        if (flagRows.length && flagRows[0][flagCol]) return null;
        const blobRows = await sbSelect('saves', keyFilter + '&select=data');
        return blobRows.length ? (blobRows[0].data || null) : null;
    }

    try {
        if (type === 'player') {
            const blob = await pendingBlob('player_migrated_at');
            if (!blob) return;
            const pd = blob.player || (Array.isArray(blob.characters) ? blob : null);
            if (!pd) return;
            const chars = pd.characters || [];
            const perChar = pd.perChar || {};

            await sbPutAll(ENT.character, chars, saveKey);
            await Promise.all(chars.map(c => {
                const s = perChar[c.id] || {};
                return sbUpsert('character_state', {
                    character_id: c.id,
                    hp: s.hp !== undefined ? s.hp : null,
                    cards: s.cards || null,
                    tabs: s.tabs || null,
                    updated_at: _nowISO(),
                });
            }));
            for (const c of chars) {
                const s = perChar[c.id] || {};
                await sbPutAll(ENT.characterNote, Array.isArray(s.notes) ? s.notes : [], c.id, true);
                await Promise.all((Array.isArray(s.files) ? s.files : []).map(f => sbPutFile(f, c.id)));
            }
            await sbPatch('saves', { player_migrated_at: _nowISO() }, keyFilter);

        } else if (type === 'gm') {
            const blob = await pendingBlob('gm_migrated_at');
            if (!blob?.gm) return;
            const campaigns = blob.gm.campaigns || [];
            const perCampaign = blob.gm.perCampaign || {};

            await sbPutAll(ENT.campaign, campaigns, saveKey);
            for (const c of campaigns) {
                const s = perCampaign[c.id] || {};
                await sbPutAll(ENT.monster, s.monsters, c.id);
                await sbPutAll(ENT.potion, s.potions, c.id);
                await sbPutAll(ENT.campaignFile, s.files, c.id);
                await sbPutAll(ENT.campaignNote, s.notes, c.id, true);
                await Promise.all(Object.values(s.knownPlayers || {})
                    .filter(p => p?.charId)
                    .map(p => sbPutKnownPlayer(p.charId, p, c.id)));
                // Append-only: replayed with their original timestamps.
                for (const r of (s.rolls || [])) {
                    await sbInsert(ENT.roll.table, toRow(ENT.roll, r, c.id,
                        r.receivedAt ? { created_at: new Date(r.receivedAt).toISOString() } : {}));
                }
                for (const entry of (s.cardHistory || [])) {
                    await sbInsert(ENT.cardDraw.table, toRow(ENT.cardDraw, entry, c.id,
                        entry.ts ? { drawn_at: new Date(entry.ts).toISOString() } : {}));
                }
            }
            await sbPatch('saves', { gm_migrated_at: _nowISO() }, keyFilter);
        }
    } catch(e) {
        console.warn('[ARIA] Migration failed:', e);
    }
}

// ═══════════════════════════════════════════
//  MAP VISIBILITY
//  One broadcast reaches every client, so these two decide what each one draws. They
//  live here because aria-supabase.js is the only file the four pages all load —
//  aria-shared.js is panels-only. Given how many divergent twins this project has
//  already paid for, there must be exactly one copy of each rule.
// ═══════════════════════════════════════════

// The coordinate space of a map (or of a map `state`): a world map works in percentages
// (100×100); a tactical map in the pixels of its image, so that a grid cell, a distance or
// a vision radius is not stretched by the picture's aspect ratio. Both come off Ably on the
// player's side and the overlay: anything malformed falls back to percentages.
function mapVB(m) {
    const w = Number(m?.size?.w), h = Number(m?.size?.h);
    return m?.kind === 'tactique' && w > 0 && h > 0 ? { w, h } : { w: 100, h: 100 };
}

// The grid of a tactical map, with every field defaulted and coerced. null for a world map
// or a missing grid. cell is clamped so a bad value cannot draw ten thousand lines.
function mapGrid(m) {
    if (m?.kind !== 'tactique' || !m.grid) return null;
    const g = m.grid, num = (v, d) => Number.isFinite(+v) ? +v : d;
    return { cell: Math.min(2000, Math.max(8, num(g.cell, 70))), ox: num(g.ox, 0), oy: num(g.oy, 0),
             unit: String(g.unit ?? 'm').slice(0, 8), per: num(g.per, 1.5),
             snap: g.snap !== false, show: g.show !== false };
}

// Where a pin or a token lands when the grid is magnetic. A token is `size` cells wide:
// odd sizes centre on a cell, even sizes on a grid intersection, so a 2×2 creature
// covers exactly four cells.
function gridSnap(x, y, g, size = 1) {
    const f = size % 2 ? n => Math.floor(n) + .5 : n => Math.round(n);
    return { x: g.ox + f((x - g.ox) / g.cell) * g.cell, y: g.oy + f((y - g.oy) / g.cell) * g.cell };
}

// Distance between two points of a tactical map, in cells and in the grid's unit, with
// the label shown while dragging ("3,2 cases · 4,8 m"). Straight line, like Roll20's
// default ruler.
function gridDistance(a, b, g) {
    const cells = Math.hypot(b.x - a.x, b.y - a.y) / g.cell;
    const fr = n => String(Math.round(n * 10) / 10).replace('.', ',');
    return { cells, text: `${fr(cells)} case${cells >= 1.95 ? 's' : ''} · ${fr(cells * g.per)} ${g.unit}` };
}

// Status markers of a token. Stored by id; drawn as a text glyph (the charter has no icon
// font). Anything not in this list — a forged id — is not drawn.
const MAP_MARKERS = [
    { id: 'terre',  g: '⤓', label: 'À terre' },
    { id: 'poison', g: '☠', label: 'Empoisonné' },
    { id: 'etourdi', g: '✷', label: 'Étourdi' },
    { id: 'entrave', g: '⛓', label: 'Entravé' },
    { id: 'peur',   g: '!', label: 'Effrayé' },
    { id: 'concentre', g: '◎', label: 'Concentré' },
];
function markerGlyphs(ids) {
    return (Array.isArray(ids) ? ids : []).map(id => MAP_MARKERS.find(m => m.id === id)?.g).filter(Boolean);
}

// The tokens a spectator sees. The GM never publishes a hidden token, but `state` comes
// off Ably and anyone with the key can publish one: the rule is applied again here, at
// the one place all four pages draw from. Malformed input renders as nothing.
function visibleTokens(state, charId) {
    const list = Array.isArray(state?.tokens) ? state.tokens : [];
    return list.filter(t => t && !t.hidden && Number.isFinite(+t.x) && Number.isFinite(+t.y));
}

// Calibrate a grid from two opposite corners of one cell drawn in the image: the cell is
// the mean of the two sides (a hand-placed box is never exactly square), the offset is
// where that cell's lines fall, brought back within one cell.
function gridCalib(a, b) {
    const cell = (Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / 2;
    if (!(cell >= 8)) return null;
    const mod = v => ((v % cell) + cell) % cell;
    return { cell: Math.round(cell * 10) / 10, ox: Math.round(mod(Math.min(a.x, b.x)) * 10) / 10,
             oy: Math.round(mod(Math.min(a.y, b.y)) * 10) / 10 };
}

// What gets drawn in the clear: pin, name, description. A charId is a player's view;
// null is the table view (GM tab, GM overlay).
function visiblePois(state, charId) {
    // `state` arrives straight off Ably ('aria-map' / 'state') with no validation, and
    // anyone holding the key can publish one — the key is pasted into OBS overlay URLs.
    // A `pois` that is a string or a number would throw out of .filter, and this is the
    // chokepoint all four pages route through: on the overlay that throw escapes
    // renderWidgetLayer() and kills the live output mid-stream. Same rule as the one
    // _mapZoneLayer/_owZones already apply to a malformed zone — a bad payload renders
    // as nothing, never as an exception.
    const pois = Array.isArray(state?.pois) ? state.pois : [];
    return pois.filter(p => charId ? (p.discoveredBy || []).includes(charId)
                                   : (p.discoveredBy || []).length > 0);
}

// What gets drawn in black: geometry, no text. state.fog holds the POIs nobody has
// discovered (id + zone, nothing else); the rest are POIs someone else found and this
// spectator has not. Both end up as { id, zone } — mapping is what strips the name.
function fogZones(state, charId) {
    const mine = new Set(visiblePois(state, charId).map(p => p.id));
    // Same guard as visiblePois() above, and for the same reason — a non-array `fog` or
    // `pois` must render as nothing, not throw.
    const fog  = Array.isArray(state?.fog)  ? state.fog  : [];
    const pois = Array.isArray(state?.pois) ? state.pois : [];
    return [...fog, ...pois.filter(p => p.zone?.length && !mine.has(p.id))]
           .map(p => ({ id: p.id, zone: p.zone }));
}

// Load the 100 most recent rolls for a character from Supabase.
async function loadCharacterRolls(charId) {
    return await sbSelect('character_rolls',
        'character_id=eq.' + encodeURIComponent(charId) + '&order=ts.desc&limit=100'
    );
}
