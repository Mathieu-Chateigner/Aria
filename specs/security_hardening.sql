-- ═══════════════════════════════════════════════════════════════════════════
--  Security hardening — findings of the 2026-10-14 audit
-- ═══════════════════════════════════════════════════════════════════════════
-- Runs after auth_rls.sql, ably_token.sql, hub.sql, campaign_sessions.sql and
-- join_code_unique.sql. Idempotent: re-running it is a no-op.

-- ── 1. Join codes are upper case, unique whatever the case ──
-- Every reader compares upper(join_code), but the unique index was case-sensitive:
-- a campaign coded 'jcjs5' made its owner the GM of the table 'JCJS5' (chat_ids,
-- sheet_for_gm, decide_sheet, journal, and a GM Ably token on its channels).
update public.campaigns set join_code = upper(trim(join_code))
 where join_code is not null and join_code <> upper(trim(join_code));
alter table public.campaigns drop constraint if exists campaigns_join_code_upper;
alter table public.campaigns add constraint campaigns_join_code_upper
    check (join_code = upper(trim(join_code)));
create unique index if not exists campaigns_join_code_upper_key on public.campaigns (upper(join_code));

-- ── 2. Storage: no listing for strangers ──
-- Public buckets serve /object/public/ URLs without any policy; the SELECT policy
-- only governed listing, and it let anyone (anon included) enumerate every file.
-- The uploader keeps it: Storage reads the row back on upload and delete.
drop policy if exists aria_storage_read on storage.objects;
drop policy if exists aria_storage_read_own on storage.objects;
create policy aria_storage_read_own on storage.objects for select to authenticated
    using (bucket_id in ('campaign-files', 'campaign-music') and owner = auth.uid());

-- ── 3. Storage: size, type and path limits ──
update storage.buckets set file_size_limit = 20 * 1024 * 1024,
       allowed_mime_types = array['image/*', 'application/pdf', 'text/plain', 'text/markdown', 'text/csv']
 where id = 'campaign-files';
update storage.buckets set file_size_limit = 50 * 1024 * 1024,
       allowed_mime_types = array['audio/*']
 where id = 'campaign-music';

-- Uploads land under something the uploader owns. The subqueries run under the
-- uploader's RLS, so they only see their own campaigns and characters. `objects.name`
-- is qualified: campaigns and characters have a `name` column of their own.
--   campaign-files: <campaignId>/…, art/<charId>-…, covers/… (the cover is uploaded
--                   before its campaign row exists, so images only)
--   campaign-music: <campaignId>/…
drop policy if exists aria_storage_insert on storage.objects;
create policy aria_storage_insert on storage.objects for insert to authenticated
    with check (
        (bucket_id = 'campaign-files' and (
            exists (select 1 from public.campaigns c where c.id = split_part(objects.name, '/', 1))
            or (split_part(objects.name, '/', 1) = 'art'
                and exists (select 1 from public.characters ch where starts_with(objects.name, 'art/' || ch.id || '-')))
            or (split_part(objects.name, '/', 1) = 'covers'
                and lower(storage.extension(objects.name)) in ('jpg', 'jpeg', 'png', 'webp'))
        ))
        or (bucket_id = 'campaign-music'
            and exists (select 1 from public.campaigns c where c.id = split_part(objects.name, '/', 1)))
    );

-- ── 5. Rendez-vous sessions belong to the campaign's GM ──
-- A session row with someone else's join code gave its host a chat identity on
-- that table (chat_ids, ably-token kind 'sessions').
drop policy if exists campaign_sessions_host on public.campaign_sessions;
create policy campaign_sessions_host on public.campaign_sessions for all to authenticated
    using (host_id = auth.uid())
    with check (host_id = auth.uid()
                and exists (select 1 from public.campaigns c where c.join_code = upper(trim(campaign_sessions.join_code))));

-- ── 10a. Hub messages only to people there is a reason to write to ──
-- Companions, the GM of a listed table, whoever wrote first, or someone who asked
-- to join one of my tables. Anything else was open spam to any account id.
create or replace function public.hub_can_message(p_to uuid)
returns boolean language sql stable security definer set search_path = '' as $$
    select auth.uid() is not null and p_to <> auth.uid() and (
        exists (select 1 from public.hub_companions() h where h.user_id = p_to)
        or exists (select 1 from public.campaigns c join public.saves s on s.save_key = c.save_key
                    where s.owner = p_to and c.visibility in ('public', 'demande'))
        or exists (select 1 from public.hub_messages m where m.from_user = p_to and m.to_user = auth.uid())
        or exists (select 1 from public.join_requests r
                     join public.campaigns c on c.id = r.campaign_id
                     join public.saves s on s.save_key = c.save_key
                    where r.user_id = p_to and s.owner = auth.uid())
    );
$$;
revoke execute on function public.hub_can_message(uuid) from public, anon;
grant execute on function public.hub_can_message(uuid) to authenticated;

drop policy if exists hub_messages_send on public.hub_messages;
create policy hub_messages_send on public.hub_messages for insert to authenticated
    with check (from_user = auth.uid() and public.hub_can_message(to_user));

-- ── 10b. A join request carries the account's own name ──
create or replace function public.join_requests_own_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    select coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1))
      into new.user_name from auth.users u where u.id = new.user_id;
    return new;
end $$;
drop trigger if exists join_requests_own_name on public.join_requests;
create trigger join_requests_own_name before insert or update of user_name, user_id on public.join_requests
    for each row execute function public.join_requests_own_name();

-- ── 12. pg_net out of the exposed schema ──
-- Its functions live in schema net either way; only the extension's home moves.
-- The weekly purge job calls net.http_post by name, so it survives the re-create.
do $$ begin
    if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
                where e.extname = 'pg_net' and n.nspname = 'public') then
        drop extension pg_net;
        create extension pg_net schema extensions;
    end if;
end $$;
