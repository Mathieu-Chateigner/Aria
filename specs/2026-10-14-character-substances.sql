-- Substances a player has identified (Alchimie tab), kept by the player on the
-- character: [{ name, note }]. Run after auth_rls.sql. Covered by the characters
-- RLS policy; no new table, no cascade.
alter table public.characters add column if not exists substances jsonb;
