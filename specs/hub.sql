-- ═══════════════════════════════════════════════════════════════════════════
--  HUB — la taverne (views/aria-hub.html)
-- ═══════════════════════════════════════════════════════════════════════════
-- What a campaign shows in the Hub, who may see it, and the join requests a GM
-- validates. Idempotent: safe to run twice.
--
-- A campaign is still owned through saves.owner (owns_campaign). What changes is
-- that some of it becomes readable by accounts that own nothing of it — the
-- "Explorer" listing. That never goes through the campaigns policy: campaigns
-- carries vdo_room_password, so the table stays owner-only and strangers read a
-- chosen set of columns through hub_campaigns() (security definer).
--
-- Membership is unchanged: a player belongs to a campaign through a character whose
-- campaign_key is its join code. Joining = linking (or creating) such a character,
-- client-side, once the code is known. The code is known to the GM, to members, to
-- anyone for a 'public' table, and to a requester once accepted.

-- ── campaign presentation ──────────────────────────────────────────────────
alter table public.campaigns
    add column if not exists visibility      text    not null default 'prive',
    add column if not exists pitch           text,
    add column if not exists tags            text[]  not null default '{}',
    add column if not exists cover_url       text,
    add column if not exists seats           integer not null default 4,
    add column if not exists rhythm          text    not null default 'weekly',
    add column if not exists first_session   timestamptz,
    add column if not exists sessions_played integer not null default 0,
    -- the player's Fiche goes to the GM for validation (specs/campaign_pages.sql)
    add column if not exists sheet_approval  boolean not null default false;

alter table public.campaigns drop constraint if exists campaigns_visibility_chk;
alter table public.campaigns add  constraint campaigns_visibility_chk check (visibility in ('public', 'demande', 'prive'));
alter table public.campaigns drop constraint if exists campaigns_seats_chk;
alter table public.campaigns add  constraint campaigns_seats_chk check (seats between 1 and 8);
alter table public.campaigns drop constraint if exists campaigns_rhythm_chk;
alter table public.campaigns add  constraint campaigns_rhythm_chk check (rhythm in ('weekly', 'biweekly', 'monthly', 'once'));

-- ── join requests ("Sur demande" tables) ───────────────────────────────────
create table if not exists public.join_requests (
    id           uuid primary key default gen_random_uuid(),
    campaign_id  text not null references public.campaigns (id) on delete cascade,
    user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
    user_name    text,
    message      text,
    status       text not null default 'pending',
    created_at   timestamptz not null default now(),
    unique (campaign_id, user_id),
    constraint join_requests_status_chk check (status in ('pending', 'accepted', 'refused'))
);
alter table public.join_requests enable row level security;

-- the requester and the campaign's GM read it
drop policy if exists join_requests_read on public.join_requests;
create policy join_requests_read on public.join_requests for select to authenticated
    using (user_id = auth.uid() or public.owns_campaign(campaign_id));

-- one asks for oneself, pending, and only at a 'demande' table. campaigns is
-- owner-only and a policy subquery runs as the caller, so the visibility check is a
-- definer helper.
create or replace function public.campaign_is_on_request (p_camp text)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.campaigns where id = p_camp and visibility = 'demande');
$$;
revoke all on function public.campaign_is_on_request (text) from public, anon;
grant execute on function public.campaign_is_on_request (text) to authenticated;
drop policy if exists join_requests_ask on public.join_requests;
create policy join_requests_ask on public.join_requests for insert to authenticated
    with check (user_id = auth.uid() and status = 'pending' and public.campaign_is_on_request(campaign_id));

-- the GM accepts or refuses
drop policy if exists join_requests_decide on public.join_requests;
create policy join_requests_decide on public.join_requests for update to authenticated
    using (public.owns_campaign(campaign_id)) with check (public.owns_campaign(campaign_id));

-- the requester withdraws, the GM clears
drop policy if exists join_requests_drop on public.join_requests;
create policy join_requests_drop on public.join_requests for delete to authenticated
    using (user_id = auth.uid() or public.owns_campaign(campaign_id));

-- ── the Hub's one read ─────────────────────────────────────────────────────
-- Every campaign the caller is part of (GM, member, requester) plus every visible
-- ('public' / 'demande') one. join_code only where the caller may use it.
-- gm_name is the owner's signup name; never the e-mail. gm_id is who "Écrire au MJ"
-- writes to. The return type changed once (gm_id, sheet_approval): drop first.
drop function if exists public.hub_campaigns ();
create function public.hub_campaigns ()
returns table (
    id text, name text, gm_name text, is_gm boolean, is_member boolean, request text,
    join_code text, visibility text, seats integer, taken integer, rhythm text,
    first_session timestamptz, sessions_played integer, tags text[], pitch text,
    cover_url text, aria_type text, gm_id uuid, sheet_approval boolean
)
language sql stable security definer set search_path = public as $$
    with c as (
        select c.*, s.owner,
               s.owner = auth.uid() as is_gm,
               exists (select 1 from public.characters ch join public.saves s2 on s2.save_key = ch.save_key
                        where s2.owner = auth.uid() and upper(ch.campaign_key) = upper(c.join_code)) as is_member,
               (select r.status from public.join_requests r
                 where r.campaign_id = c.id and r.user_id = auth.uid()) as request
          from public.campaigns c join public.saves s on s.save_key = c.save_key
    )
    select c.id, c.name,
           coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), '—'),
           c.is_gm, c.is_member, c.request,
           case when c.is_gm or c.is_member or c.visibility = 'public' or c.request = 'accepted' then c.join_code end,
           c.visibility, c.seats,
           (select count(*)::int from public.characters ch
             where coalesce(ch.campaign_key, '') <> '' and upper(ch.campaign_key) = upper(c.join_code)),
           c.rhythm, c.first_session, c.sessions_played, c.tags, c.pitch, c.cover_url, c.aria_type,
           c.owner, c.sheet_approval
      from c left join auth.users u on u.id = c.owner
     where auth.uid() is not null
       and (c.is_gm or c.is_member or c.request is not null or c.visibility in ('public', 'demande'));
$$;
revoke all on function public.hub_campaigns () from public, anon;
grant execute on function public.hub_campaigns () to authenticated;

-- A code is an invitation: whoever holds it learns which campaign it opens,
-- whatever its visibility. Nothing else is revealed.
create or replace function public.hub_campaign_by_code (p_code text)
returns table (id text, name text, join_code text, aria_type text)
language sql stable security definer set search_path = public as $$
    select c.id, c.name, c.join_code, c.aria_type
      from public.campaigns c
     where auth.uid() is not null and upper(c.join_code) = upper(trim(p_code));
$$;
revoke all on function public.hub_campaign_by_code (text) from public, anon;
grant execute on function public.hub_campaign_by_code (text) to authenticated;

-- ── messages between accounts ("Écrire au MJ", replies, companions) ─────────
-- One row per message, between two accounts. Anyone signed in may write to an
-- account they know the id of — a table's GM (hub_campaigns.gm_id), a requester, a
-- companion. Names are never stored: hub_inbox() reads them from auth.users, so a
-- sender cannot sign as someone else.
create table if not exists public.hub_messages (
    id          uuid primary key default gen_random_uuid(),
    from_user   uuid not null default auth.uid() references auth.users (id) on delete cascade,
    to_user     uuid not null references auth.users (id) on delete cascade,
    camp_name   text,                         -- context shown under the name; free text
    body        text not null,
    created_at  timestamptz not null default now(),
    constraint hub_messages_body_chk check (length(body) between 1 and 2000),
    constraint hub_messages_self_chk check (from_user <> to_user)
);
create index if not exists hub_messages_to_idx   on public.hub_messages (to_user, created_at);
create index if not exists hub_messages_from_idx on public.hub_messages (from_user, created_at);
alter table public.hub_messages enable row level security;

drop policy if exists hub_messages_read on public.hub_messages;
create policy hub_messages_read on public.hub_messages for select to authenticated
    using (from_user = auth.uid() or to_user = auth.uid());
drop policy if exists hub_messages_send on public.hub_messages;
create policy hub_messages_send on public.hub_messages for insert to authenticated
    with check (from_user = auth.uid());

-- The caller's messages, newest first, with the other party's signup name.
create or replace function public.hub_inbox ()
returns table (id uuid, other uuid, other_name text, mine boolean, camp_name text, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
    select m.id, o.id, coalesce(nullif(o.raw_user_meta_data ->> 'name', ''), '—'),
           m.from_user = auth.uid(), m.camp_name, m.body, m.created_at
      from public.hub_messages m
      join auth.users o on o.id = case when m.from_user = auth.uid() then m.to_user else m.from_user end
     where auth.uid() is not null and (m.from_user = auth.uid() or m.to_user = auth.uid())
     order by m.created_at desc
     limit 1000;
$$;
revoke all on function public.hub_inbox () from public, anon;
grant execute on function public.hub_inbox () to authenticated;

-- ── companions: the accounts met at one's tables ───────────────────────────
-- Everyone sharing a campaign with the caller (its GM, the owners of the characters
-- linked to its code), once each, with one campaign to say where from.
create or replace function public.hub_companions ()
returns table (user_id uuid, name text, camp_name text, is_gm boolean)
language sql stable security definer set search_path = public as $$
    with mine as (
        select c.name, c.join_code, s.owner as gm
          from public.campaigns c join public.saves s on s.save_key = c.save_key
         where s.owner = auth.uid()
            or exists (select 1 from public.characters ch join public.saves s2 on s2.save_key = ch.save_key
                        where s2.owner = auth.uid() and upper(ch.campaign_key) = upper(c.join_code))
    ), people as (
        select m.gm as uid, m.name as camp, true as is_gm from mine m
        union
        select s.owner, m.name, false
          from mine m
          join public.characters ch on upper(ch.campaign_key) = upper(m.join_code)
          join public.saves s on s.save_key = ch.save_key
    )
    select distinct on (p.uid) p.uid, coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), '—'), p.camp, p.is_gm
      from people p join auth.users u on u.id = p.uid
     where auth.uid() is not null and p.uid <> auth.uid()
     order by p.uid, p.is_gm desc;
$$;
revoke all on function public.hub_companions () from public, anon;
grant execute on function public.hub_companions () to authenticated;
