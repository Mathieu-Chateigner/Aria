// ═══════════════════════════════════════════════════════════════════════════
//  purge-inactive — erase accounts: inactive for 3 years, or one on request
// ═══════════════════════════════════════════════════════════════════════════
// specs/account_purge.sql holds the database side. This function exists only
// because Storage files cannot be deleted from SQL: it removes each account's
// files through the Storage API first, then calls purge_accounts().
//
// POST {}                 → every account inactive for 3 years (pg_cron, weekly)
// POST { user: '<uuid>' } → that account (erasure request, by hand with curl)
//
// Guarded by the PURGE_SECRET secret in the x-purge-secret header. Deployed with
// --no-verify-jwt: pg_cron has no user session to send.

const SB = Deno.env.get('SUPABASE_URL')!;
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('PURGE_SECRET') ?? '';

const srHeaders: Record<string, string> = SR.startsWith('sb_')
    ? { apikey: SR, 'Content-Type': 'application/json' }
    : { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };

async function rpc(fn: string, args: unknown): Promise<any> {
    const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: 'POST', headers: srHeaders, body: JSON.stringify(args) });
    if (!r.ok) throw new Error(`${fn} ${r.status}: ${await r.text()}`);
    return await r.json();
}

Deno.serve(async (req) => {
    if (!SECRET || req.headers.get('x-purge-secret') !== SECRET) return new Response('forbidden', { status: 403 });
    try {
        const body = await req.json().catch(() => ({}));
        const users: string[] = body.user ? [String(body.user)] : await rpc('inactive_users', {});
        if (!users.length) return Response.json({ users: 0, files: 0 });

        // files first: if this fails the accounts stay, and the next run retries both
        const files: { bucket_id: string; name: string }[] = await rpc('account_files', { p_users: users });
        const byBucket = new Map<string, string[]>();
        for (const f of files) byBucket.set(f.bucket_id, [...(byBucket.get(f.bucket_id) ?? []), f.name]);
        for (const [bucket, prefixes] of byBucket) {
            const r = await fetch(`${SB}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: srHeaders, body: JSON.stringify({ prefixes }) });
            if (!r.ok) throw new Error(`storage ${bucket} ${r.status}: ${await r.text()}`);
        }

        const n = await rpc('purge_accounts', { p_users: users });
        return Response.json({ users: n, files: files.length });
    } catch (e) {
        console.error('[purge-inactive]', e);
        return new Response(String(e), { status: 500 });
    }
});
