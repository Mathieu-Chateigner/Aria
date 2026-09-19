-- Fix: NONE of the GM's campaign data has ever reached Supabase.
--
-- These seven tables have row level security enabled with no policy the anon key
-- satisfies, so every write is rejected with
--   42501: new row violates row-level security policy for table "monsters"
-- and sbUpsert() only console.warn()s it. The GM panel has been running entirely on
-- localStorage: monsters, potions, campaign files, maps, GM notes, the roll log and
-- the card history are all 0 rows in the database, on every campaign.
--
-- campaign_music and campaign_known_players are NOT in this list — they already have
-- working policies, which is exactly why they are the only GM tables with rows.
--
-- Run once in the Supabase SQL editor, then reload the GM panel: tryRestoreSupabase()
-- runs a full push on load, so the existing local campaigns sync up by themselves.
--
-- `for all` covers select/insert/update/delete. Policies are OR'd, so adding a
-- permissive one cannot take away access an existing policy already grants.
do $$
declare t text;
begin
    foreach t in array array[
        'monsters', 'campaign_potions', 'campaign_files', 'campaign_maps',
        'campaign_notes', 'campaign_rolls', 'campaign_card_history'
    ] loop
        execute format('drop policy if exists aria_anon_all on public.%I', t);
        execute format('create policy aria_anon_all on public.%I for all using (true) with check (true)', t);
    end loop;
end $$;
