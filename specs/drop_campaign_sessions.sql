-- ═══════════════════════════════════════════════════════════════════════════
--  Retrait du tableau des rendez-vous (campaign_sessions / session_signups)
-- ═══════════════════════════════════════════════════════════════════════════
-- Le tableau d'affichage des seances a ete remplace par la taverne (specs/hub.sql) :
-- plus aucune page ne lit ni n'ecrit ces deux tables, et le type de jeton
-- 'sessions' a ete retire de supabase/functions/ably-token. Verifie sur la prod le
-- 2026-11-10 : 0 seance, 0 inscription, aucun fil de chat 'u_…'.
--
-- Une seule chose en dependait encore : chat_ids(), qui donnait l'identite 'u_<uid>'
-- a l'hote ou a l'inscrit d'une seance. Elle est recreee sans cette branche AVANT
-- de supprimer les tables.
--
-- A lancer une fois, apres avoir redeploye ably-token. Transactionnel : une erreur
-- annule tout.

begin;

create or replace function public.chat_ids(p_code text)
returns setof text
language sql stable security definer set search_path = public
as $$
    select 'gm'
     where exists (select 1 from campaigns c join saves s on s.save_key = c.save_key
                    where s.owner = auth.uid() and upper(c.join_code) = upper(p_code))
    union
    select ch.id from characters ch join saves s on s.save_key = ch.save_key
     where s.owner = auth.uid() and upper(ch.campaign_key) = upper(p_code)
$$;
revoke all on function public.chat_ids(text) from public, anon;
grant execute on function public.chat_ids(text) to authenticated;

-- Les policies partent avec leurs tables.
drop table if exists public.session_signups;
drop table if exists public.campaign_sessions;

commit;
