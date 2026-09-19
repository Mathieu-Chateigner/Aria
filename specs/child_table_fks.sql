-- Foreign keys that three child tables were missing: a row could reference a
-- campaign/character that does not exist, and nothing in the database said so.
-- Verified against the live project — campaign_maps accepted a row pointing at a
-- nonexistent campaign while every sibling table rejected it with 23503.
--
-- sbDeleteCascade() already deletes these children itself, so nothing depends on
-- the FK today; it is there so a bug cannot leave rows hanging off a deleted
-- parent, and ON DELETE CASCADE makes the database agree with what the app does.
--
-- Idempotent: safe to re-run. Applied 2026-09-19 for campaign_maps and
-- campaign_music; the character_rolls block is held back until the 57 orphan rows
-- it would delete are confirmed as disposable.

-- campaign_maps → campaigns  (applied)
delete from public.campaign_maps m
 where not exists (select 1 from public.campaigns c where c.id = m.campaign_id);
alter table public.campaign_maps drop constraint if exists campaign_maps_campaign_id_fkey;
alter table public.campaign_maps
    add constraint campaign_maps_campaign_id_fkey
    foreign key (campaign_id) references public.campaigns (id) on delete cascade;

-- campaign_music → campaigns  (applied)
delete from public.campaign_music m
 where not exists (select 1 from public.campaigns c where c.id = m.campaign_id);
alter table public.campaign_music drop constraint if exists campaign_music_campaign_id_fkey;
alter table public.campaign_music
    add constraint campaign_music_campaign_id_fkey
    foreign key (campaign_id) references public.campaigns (id) on delete cascade;

-- character_rolls → characters  (NOT applied — would delete 57 rows of roll history
-- belonging to characters that no longer exist)
-- delete from public.character_rolls r
--  where not exists (select 1 from public.characters c where c.id = r.character_id);
-- alter table public.character_rolls drop constraint if exists character_rolls_character_id_fkey;
-- alter table public.character_rolls
--     add constraint character_rolls_character_id_fkey
--     foreign key (character_id) references public.characters (id) on delete cascade;
