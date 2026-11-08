-- ═══════════════════════════════════════════════════════════════════════════
--  CAMPAIGN PAGES — Journal (shared notes) and Fiche (GM validation)
-- ═══════════════════════════════════════════════════════════════════════════
-- views/aria-journal.html and views/aria-fiche.html. Run after specs/hub.sql
-- (campaigns.sheet_approval lives there, since hub_campaigns() returns it).
-- Idempotent: safe to run twice.
--
-- Both read across accounts — a companion's shared note, the GM reading a player's
-- sheet — which the owner-only policies forbid. That goes through security definer
-- functions that check participation themselves; the table policies are unchanged.

-- ── Journal ────────────────────────────────────────────────────────────────
-- A note can be shared with the table, and keeps the time it was written: the
-- Journal files it under that day. Existing notes take their last write time.
alter table public.character_notes add column if not exists shared boolean not null default false;
alter table public.character_notes add column if not exists created_at timestamptz;
update public.character_notes set created_at = coalesce(updated_at, now()) where created_at is null;
alter table public.character_notes alter column created_at set default now();

alter table public.campaign_notes add column if not exists shared boolean not null default false;
alter table public.campaign_notes add column if not exists created_at timestamptz;
update public.campaign_notes set created_at = coalesce(updated_at, now()) where created_at is null;
alter table public.campaign_notes alter column created_at set default now();

-- The Journal of a table: the caller's own notes (private or not) and everyone
-- else's shared ones — characters linked to the code, and the GM's ('MJ'). Nothing
-- unless the caller sits at that table, as GM or through a linked character.
create or replace function public.journal_notes (p_code text)
returns table (author text, mine boolean, shared boolean, title text, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
    with camp as (
        select c.id, s.owner from public.campaigns c join public.saves s on s.save_key = c.save_key
         where upper(c.join_code) = upper(trim(p_code)) limit 1
    ), inside as (
        select exists (select 1 from camp where owner = auth.uid())
            or exists (select 1 from public.characters ch join public.saves s on s.save_key = ch.save_key
                        where s.owner = auth.uid() and upper(ch.campaign_key) = upper(trim(p_code))) as ok
    )
    select ch.name, s.owner = auth.uid(), n.shared, n.name, n.content, n.created_at
      from public.character_notes n
      join public.characters ch on ch.id = n.character_id
      join public.saves s on s.save_key = ch.save_key
     where upper(ch.campaign_key) = upper(trim(p_code))
       and (s.owner = auth.uid() or n.shared) and (select ok from inside)
    union all
    select 'MJ', camp.owner = auth.uid(), n.shared, n.name, n.content, n.created_at
      from public.campaign_notes n join camp on camp.id = n.campaign_id
     where (camp.owner = auth.uid() or n.shared) and (select ok from inside);
$$;
revoke all on function public.journal_notes (text) from public, anon;
grant execute on function public.journal_notes (text) to authenticated;

-- ── Fiche: GM validation ───────────────────────────────────────────────────
-- With campaigns.sheet_approval on, the player's Fiche writes its edit here instead
-- of the character (their own row — the owner policy allows it) and the GM accepts
-- or refuses it. Not an ENT field: the player panel's full upsert never touches it.
alter table public.characters add column if not exists pending_sheet jsonb;

-- Is the caller the GM of the campaign this character sits at?
create or replace function public.gm_of_character (p_char text)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.characters ch
          join public.campaigns c on upper(c.join_code) = upper(ch.campaign_key)
          join public.saves s on s.save_key = c.save_key
         where ch.id = p_char and coalesce(ch.campaign_key, '') <> '' and s.owner = auth.uid()
    );
$$;
revoke all on function public.gm_of_character (text) from public, anon;
grant execute on function public.gm_of_character (text) to authenticated;

-- The sheets waiting at one of the caller's campaigns.
create or replace function public.pending_sheets (p_camp text)
returns table (id text, name text)
language sql stable security definer set search_path = public as $$
    select ch.id, ch.name
      from public.characters ch join public.campaigns c on upper(c.join_code) = upper(ch.campaign_key)
     where c.id = p_camp and public.owns_campaign(p_camp) and ch.pending_sheet is not null;
$$;
revoke all on function public.pending_sheets (text) from public, anon;
grant execute on function public.pending_sheets (text) to authenticated;

-- One character, for its GM to review: the row (save_key aside) with pending_sheet.
create or replace function public.sheet_for_gm (p_char text)
returns jsonb
language sql stable security definer set search_path = public as $$
    select to_jsonb(ch) - 'save_key' from public.characters ch
     where ch.id = p_char and public.gm_of_character(p_char);
$$;
revoke all on function public.sheet_for_gm (text) from public, anon;
grant execute on function public.sheet_for_gm (text) to authenticated;

-- Accept (copy the fields the Fiche edits) or refuse; either way the edit is cleared.
create or replace function public.decide_sheet (p_char text, p_accept boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
    if not public.gm_of_character(p_char) then return false; end if;
    if p_accept then
        update public.characters ch set
            name       = coalesce(ch.pending_sheet ->> 'name',  ch.name),
            class      = coalesce(ch.pending_sheet ->> 'class', ch.class),
            stats      = coalesce(ch.pending_sheet -> 'stats',      ch.stats),
            physical   = coalesce(ch.pending_sheet -> 'physical',   ch.physical),
            skills     = coalesce(ch.pending_sheet -> 'skills',     ch.skills),
            specials   = coalesce(ch.pending_sheet -> 'specials',   ch.specials),
            weapons    = coalesce(ch.pending_sheet -> 'weapons',    ch.weapons),
            protection = coalesce(ch.pending_sheet -> 'protection', ch.protection),
            inventory  = coalesce(ch.pending_sheet -> 'inventory',  ch.inventory)
         where ch.id = p_char and ch.pending_sheet is not null;
    end if;
    update public.characters set pending_sheet = null, updated_at = now() where id = p_char;
    return true;
end $$;
revoke all on function public.decide_sheet (text, boolean) from public, anon;
grant execute on function public.decide_sheet (text, boolean) to authenticated;
