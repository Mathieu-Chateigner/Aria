// ═══════════════════════════════════════════════════════════════════════════
//  ably-token — the only holder of the Ably root key
// ═══════════════════════════════════════════════════════════════════════════
// Every client used to connect with the root key itself. Whoever held it (it sat in
// OBS URLs, in saves.ably_key, in app_config) could take any clientId, enter the
// presence set as the GM, point every player's webcam at a room of their choosing,
// and publish damage, grants and chat under anyone's name.
//
// Now the key lives here, as the ABLY_KEY secret, and clients get a signed Ably
// TokenRequest instead. What that token can do is decided here, from the database,
// not from what the page claims:
//
//   • clientId is BOUND — a player is their charId only if their account owns it,
//     the GM is 'gm-<campaignId>' only if their account owns that campaign. Every
//     consumer can therefore trust msg.clientId / member.clientId.
//   • capabilities are per channel — a player cannot publish music, cannot read the
//     hidden rolls, cannot read another participant's private inbox.
//
// Kinds (POST JSON):
//   { kind:'player',   charId, code }        session required
//   { kind:'gm',       campaignId }          session required — code comes from the DB
//   { kind:'editor',   overlay }             session required — overlay layout channel
//   { kind:'overlay',  saveKey, code?, overlay? }   no session (OBS) — mostly read-only
//
// Reply: { tokenRequest, clientId, self }. `self` is the chat identity ('gm' or a charId).
//
// Deployed with verify_jwt = false (supabase/config.toml): the overlay has no session,
// and the project's publishable key is not a JWT. The user token is checked here.

const ABLY_KEY = Deno.env.get('ABLY_KEY') ?? '';
const [KEY_NAME, KEY_SECRET] = ABLY_KEY.split(':');
const SB = Deno.env.get('SUPABASE_URL')!;
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TTL = 60 * 60 * 1000;   // Ably calls the authCallback again before this runs out

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ── database (service role — RLS is bypassed, so every check below is explicit) ──
const srHeaders: Record<string, string> = SR.startsWith('sb_')
    ? { apikey: SR }
    : { apikey: SR, Authorization: `Bearer ${SR}` };
async function db(path: string): Promise<any[]> {
    const r = await fetch(`${SB}/rest/v1/${path}`, { headers: srHeaders });
    if (!r.ok) throw new Error(`db ${r.status}`);
    return await r.json();
}
const q = (v: string) => encodeURIComponent(v);

async function userId(req: Request): Promise<string | null> {
    const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!tok || tok.startsWith('sb_')) return null;           // the publishable key, not a session
    const r = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: SR, Authorization: `Bearer ${tok}` } });
    if (!r.ok) return null;
    return (await r.json())?.id ?? null;
}
async function saveOwner(saveKey: string): Promise<string | null | undefined> {
    const rows = await db(`saves?save_key=eq.${q(saveKey)}&select=owner`);
    return rows.length ? rows[0].owner : undefined;           // undefined = no such save
}
async function character(id: string) {
    return (await db(`characters?id=eq.${q(id)}&select=id,save_key,campaign_key`))[0] ?? null;
}
async function campaign(id: string) {
    return (await db(`campaigns?id=eq.${q(id)}&select=id,save_key,join_code`))[0] ?? null;
}

// ── capabilities ──
type Caps = Record<string, string[]>;
const PS = ['publish', 'subscribe'];
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const CODE = /^[A-Z0-9]{0,12}$/;
const normCode = (c: unknown) => String(c ?? '').trim().toUpperCase();
// Same rule as campaignChannel(): an empty code is the bare global channel.
const chan = (base: string, code: string) => code ? `${base}-${code}` : base;
// Private inboxes are `aria-chat-CODE:ID` — Ably only wildcards whole ':' segments,
// so "publish to anyone's inbox, read only mine" needs the colon.
function chatCaps(code: string, self: string): Caps {
    const ns = chan('aria-chat', code);
    return { [ns]: PS, [`${ns}:*`]: ['publish'], [`${ns}:${self}`]: PS };
}
function tableCaps(code: string, role: 'player' | 'gm', self: string): Caps {
    const c = (b: string) => chan(b, code);
    const gm = role === 'gm';
    return {
        [c('aria-rolls')]: PS,
        [c('aria-rolls-hidden')]: gm ? ['subscribe'] : ['publish'],
        [c('aria-cards')]: PS,
        [c('aria-damage')]: PS,             // players publish Soigner heal/damage; consumers check the sender
        [c('aria-music')]: gm ? PS : ['subscribe'],
        [c('aria-map')]: PS,
        [c('aria-presence')]: ['presence', 'subscribe'],
        ...chatCaps(code, self),
    };
}

// ── Ably TokenRequest, signed here so the secret never leaves ──
async function tokenRequest(capability: Caps, clientId?: string) {
    const cap = JSON.stringify(capability);
    const timestamp = Date.now();
    const nonce = crypto.randomUUID().replace(/-/g, '');
    const text = [KEY_NAME, TTL, cap, clientId ?? '', timestamp, nonce, ''].join('\n');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(KEY_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
    const mac = btoa(String.fromCharCode(...sig));
    return { keyName: KEY_NAME, ttl: TTL, capability: cap, ...(clientId ? { clientId } : {}), timestamp, nonce, mac };
}

// ── kinds ──
async function handle(req: Request, b: any) {
    const kind = b?.kind;

    if (kind === 'overlay') {
        // No session: OBS cannot sign in. The save key is the secret (it is in the
        // browser-source URL), and it only opens what that save actually holds.
        const saveKey = String(b.saveKey || '');
        if (!/^[0-9a-f-]{36}$/i.test(saveKey) || (await saveOwner(saveKey)) === undefined) return reply(403, { error: 'save' });
        const caps: Caps = { [`aria-route-${saveKey}`]: PS };
        const overlay = String(b.overlay || '');
        if (overlay) {
            const m = /^(player|gm)_([A-Za-z0-9_-]{1,64})$/.exec(overlay);
            const row = m && (m[1] === 'player' ? await character(m[2]) : await campaign(m[2]));
            if (!row || row.save_key !== saveKey) return reply(403, { error: 'overlay' });
            caps[`aria-overlay-config:${overlay}`] = ['subscribe'];
        }
        const code = normCode(b.code);
        if (code) {
            if (!CODE.test(code)) return reply(400, { error: 'code' });
            const [cs, ch] = await Promise.all([
                db(`campaigns?save_key=eq.${q(saveKey)}&join_code=eq.${q(code)}&select=id&limit=1`),
                db(`characters?save_key=eq.${q(saveKey)}&campaign_key=eq.${q(code)}&select=id&limit=1`),
            ]);
            if (!cs.length && !ch.length) return reply(403, { error: 'code' });
            for (const base of ['aria-rolls', 'aria-cards', 'aria-presence']) caps[chan(base, code)] = ['subscribe'];
            // The overlay asks for state it missed: monster-request, map request.
            caps[chan('aria-damage', code)] = PS;
            caps[chan('aria-map', code)] = PS;
        }
        return reply(200, { tokenRequest: await tokenRequest(caps), clientId: null, self: null });
    }

    const uid = await userId(req);
    if (!uid) return reply(401, { error: 'session' });

    if (kind === 'player') {
        const charId = String(b.charId || '');
        const code = normCode(b.code);
        if (!ID.test(charId) || !CODE.test(code)) return reply(400, { error: 'input' });
        const ch = await character(charId);
        if (!ch || (await saveOwner(ch.save_key)) !== uid) return reply(403, { error: 'character' });
        // The character must sit at that table: the code alone no longer opens it, so a
        // table "sur demande" stays closed until the character is linked to it.
        if (code !== normCode(ch.campaign_key)) return reply(403, { error: 'code' });
        const caps = { ...tableCaps(code, 'player', charId), [`aria-route-${ch.save_key}`]: PS };
        return reply(200, { tokenRequest: await tokenRequest(caps, charId), clientId: charId, self: charId });
    }

    if (kind === 'gm') {
        const cid = String(b.campaignId || '');
        if (!ID.test(cid)) return reply(400, { error: 'input' });
        const c = await campaign(cid);
        if (!c || (await saveOwner(c.save_key)) !== uid) return reply(403, { error: 'campaign' });
        const code = normCode(c.join_code);
        const caps = { ...tableCaps(code, 'gm', 'gm'), [`aria-route-${c.save_key}`]: PS };
        const clientId = 'gm-' + cid;
        return reply(200, { tokenRequest: await tokenRequest(caps, clientId), clientId, self: 'gm' });
    }

    if (kind === 'editor') {
        const m = /^(player|gm)_([A-Za-z0-9_-]{1,64})$/.exec(String(b.overlay || ''));
        const row = m && (m[1] === 'player' ? await character(m[2]) : await campaign(m[2]));
        if (!row || (await saveOwner(row.save_key)) !== uid) return reply(403, { error: 'overlay' });
        const caps = { [`aria-overlay-config:${m![0]}`]: PS };
        return reply(200, { tokenRequest: await tokenRequest(caps), clientId: null, self: null });
    }

    return reply(400, { error: 'kind' });
}

Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return reply(405, { error: 'method' });
    if (!KEY_NAME || !KEY_SECRET) return reply(500, { error: 'ABLY_KEY secret not set' });
    try {
        return await handle(req, await req.json().catch(() => ({})));
    } catch (e) {
        console.error(e);
        return reply(500, { error: 'internal' });
    }
});
