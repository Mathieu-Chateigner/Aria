-- ═══════════════════════════════════════════════════════════════════════════
--  Account erasure — on request, and automatically after 3 years of inactivity
-- ═══════════════════════════════════════════════════════════════════════════
-- What views/aria-confidentialite.html promises: an account unused for 3 years is
-- deleted with everything it holds, and so is an account whose owner asks.
--
-- Deleting the auth.users row does most of it by cascade. It did not before this
-- file: saves.owner was ON DELETE SET NULL, so a deleted user left their saves
-- behind as *unclaimed* keys — readable by nobody, but claimable by anyone who
-- knew one (claim_save_key). It is now ON DELETE CASCADE, which takes the saves,
-- then characters/campaigns, then every child table; hub_messages, join_requests
-- and campaign_sessions already cascaded from auth.users. That also makes a
-- deletion from the dashboard (Authentication › Users) correct.
--
-- What no FK reaches is deleted by purge_accounts() by hand: the chat (keyed by
-- join code), character_rolls (no FK yet, see child_table_fks.sql), other GMs'
-- known-player snapshots of the deleted characters, and overlay layouts.
--
-- Storage files cannot be deleted from SQL (Supabase forbids writes to
-- storage.objects; it has to go through the Storage API), so the purge-inactive
-- Edge Function runs the whole thing: account_files() → Storage API → purge_accounts().
--
-- Run after auth_rls.sql, hub.sql, ably_token.sql. Idempotent. Then:
--   1. supabase functions deploy purge-inactive --no-verify-jwt --project-ref …
--   2. supabase secrets set PURGE_SECRET=<long random string> --project-ref …
--   3. the vault + cron block at the bottom, with the same secret.
-- Erase one account on request:
--   curl -X POST https://<ref>.supabase.co/functions/v1/purge-inactive \
--        -H "x-purge-secret: <secret>" -d '{"user":"<auth user uuid>"}'

-- drop whatever FK sits on saves.owner, whatever it was named, before adding ours
do $$ declare c text; begin
    for c in select conname from pg_constraint
              where conrelid = 'public.saves'::regclass and contype = 'f'
                and conkey = array[(select attnum from pg_attribute
                                     where attrelid = 'public.saves'::regclass and attname = 'owner')]
    loop execute format('alter table public.saves drop constraint %I', c); end loop;
end $$;
alter table public.saves
    add constraint saves_owner_fkey
    foreign key (owner) references auth.users (id) on delete cascade;

-- Last activity = the latest of sign-up, sign-in and session refresh. A "remember
-- me" user may never sign in again for years while refreshing every hour, so
-- last_sign_in_at alone would delete active accounts.
create or replace function public.inactive_users (p_age interval default interval '3 years')
returns uuid[]
language sql stable security definer set search_path = '' as $$
    select coalesce(array_agg(u.id), '{}')
      from auth.users u
     where greatest(u.created_at, u.last_sign_in_at,
                    (select max(s.updated_at) from auth.sessions s where s.user_id = u.id))
           < now() - p_age;
$$;

create or replace function public.account_files (p_users uuid[])
returns table (bucket_id text, name text)
language sql stable security definer set search_path = '' as $$
    select o.bucket_id, o.name from storage.objects o where o.owner = any (p_users);
$$;

create or replace function public.purge_accounts (p_users uuid[])
returns integer
language plpgsql security definer set search_path = '' as $$
declare
    v_chars text[];
    v_camps text[];
    v_codes text[];
    v_n     integer;
begin
    select array_agg(c.id) into v_chars
      from public.characters c join public.saves s on s.save_key = c.save_key
     where s.owner = any (p_users);
    select array_agg(c.id), array_agg(c.join_code) into v_camps, v_codes
      from public.campaigns c join public.saves s on s.save_key = c.save_key
     where s.owner = any (p_users);

    delete from public.campaign_chat          where join_code = any (v_codes) or author_id = any (v_chars);
    delete from public.character_rolls        where character_id = any (v_chars);
    delete from public.campaign_known_players where char_id = any (v_chars);
    delete from public.overlay_configs        where owner_id = any (v_chars) or owner_id = any (v_camps);

    delete from auth.users where id = any (p_users);   -- cascades everything else
    get diagnostics v_n = row_count;
    return v_n;
end $$;

revoke all on function public.inactive_users (interval) from public, anon, authenticated;
revoke all on function public.account_files (uuid[])    from public, anon, authenticated;
revoke all on function public.purge_accounts (uuid[])   from public, anon, authenticated;
grant execute on function public.inactive_users (interval) to service_role;
grant execute on function public.account_files (uuid[])    to service_role;
grant execute on function public.purge_accounts (uuid[])   to service_role;

-- ── weekly run (once per project; replace <ref> and <secret>) ────────────────
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select vault.create_secret('<secret>', 'purge_secret');
-- select cron.schedule('aria-purge-inactive', '17 4 * * 1', $cron$
--     select net.http_post(
--         url     := 'https://<ref>.supabase.co/functions/v1/purge-inactive',
--         headers := jsonb_build_object('Content-Type', 'application/json',
--                    'x-purge-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'purge_secret')),
--         body    := '{}'::jsonb)
-- $cron$);
