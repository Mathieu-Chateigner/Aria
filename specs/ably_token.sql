-- ═══════════════════════════════════════════════════════════════════════════
--  La cle Ably quitte la base ; le chat et le stockage cessent d'etre ouverts
-- ═══════════════════════════════════════════════════════════════════════════
-- Accompagne supabase/functions/ably-token. La cle racine Ably n'existe plus que
-- comme secret de cette fonction (supabase secrets set ABLY_KEY=...). Les clients
-- recoivent des jetons a clientId lie et a droits par canal.
--
-- Ce que ferme ce fichier :
--   1. saves lisible par anon (save_key, ably_key, type) : n'importe quel visiteur
--      listait TOUTES les cles de sauvegarde et la cle Ably. L'overlay passe
--      desormais par la fonction, qui ne demande que SA cle de sauvegarde.
--   2. app_config : la cle Ably lisible par tout compte connecte (l'inscription est
--      ouverte, donc par n'importe qui).
--   3. campaign_chat : `using (true)` pour tout compte connecte. Un fil n'est plus
--      lisible que par un participant, et on ne peut plus ecrire sous le nom d'un autre.
--   4. storage : tout compte connecte pouvait ecraser ou supprimer le fichier de
--      n'importe quelle campagne. Seul celui qui l'a depose le peut encore.
--
-- Rejouable : tout est `if exists` / `or replace`.

-- ── 1. saves : plus aucune lecture anonyme ────────────────────────────────
drop policy if exists saves_read_anon on public.saves;
revoke all on public.saves from anon;
alter table public.saves drop column if exists ably_key;

-- ── 2. app_config : la table n'a plus de raison d'etre ────────────────────
drop table if exists public.app_config;

-- ── 3. campaign_chat : participants seulement ─────────────────────────────
-- Les identites de chat du compte courant pour un code de campagne — les memes que
-- celles que la fonction ably-token donne aux clients :
--   'gm'        s'il possede la campagne qui porte ce code ;
--   un charId   pour chacun de ses personnages lies a ce code ;
--   'u_<uid16>' s'il organise ou a rejoint une seance du tableau pour ce code.
-- security definer : RLS cacherait sinon les tables qu'on interroge.
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
    union
    select 'u_' || substr(replace(auth.uid()::text, '-', ''), 1, 16)
     where exists (select 1 from campaign_sessions cs
                    where upper(cs.join_code) = upper(p_code)
                      and (cs.host_id = auth.uid()
                           or exists (select 1 from session_signups g
                                       where g.session_id = cs.id and g.user_id = auth.uid())))
$$;
revoke all on function public.chat_ids(text) from public, anon;
grant execute on function public.chat_ids(text) to authenticated;

-- Un fil est 'global' ou deux identites triees jointes par '|' : on y participe si
-- l'une des deux est a nous. Le fil global est celui de tous les participants.
create or replace function public.chat_thread_mine(p_code text, p_thread text)
returns boolean
language sql stable security definer set search_path = public
as $$
    select exists (
        select 1 from public.chat_ids(p_code) i
         where p_thread = 'global'
            or p_thread = i
            or p_thread like i || '|%'
            or p_thread like '%|' || i
    )
$$;
revoke all on function public.chat_thread_mine(text, text) from public, anon;
grant execute on function public.chat_thread_mine(text, text) to authenticated;

drop policy if exists campaign_chat_authed on public.campaign_chat;
drop policy if exists campaign_chat_read   on public.campaign_chat;
drop policy if exists campaign_chat_write  on public.campaign_chat;
drop policy if exists campaign_chat_delete on public.campaign_chat;

create policy campaign_chat_read on public.campaign_chat for select to authenticated
    using (public.chat_thread_mine(join_code, thread));

-- On n'ecrit que sous une identite a soi, et dans un fil dont on fait partie.
create policy campaign_chat_write on public.campaign_chat for insert to authenticated
    with check (
        author_id in (select public.chat_ids(join_code))
        and (thread = 'global' or thread like author_id || '|%' or thread like '%|' || author_id)
    );

-- deleteCampaign() efface le chat de la campagne : le MJ seulement.
create policy campaign_chat_delete on public.campaign_chat for delete to authenticated
    using ('gm' in (select public.chat_ids(join_code)));

-- ── 4. storage : ecrire oui, ecraser / supprimer celui d'un autre non ──────
-- storage.objects.owner est rempli par Supabase a l'envoi (auth.uid() du deposant).
-- Les URL restent publiques en lecture : joueurs et overlay n'ont pas de session.
drop policy if exists aria_storage_write  on storage.objects;
drop policy if exists aria_storage_insert on storage.objects;
drop policy if exists aria_storage_modify on storage.objects;
drop policy if exists aria_storage_delete on storage.objects;

create policy aria_storage_insert on storage.objects for insert to authenticated
    with check (bucket_id in ('campaign-files', 'campaign-music'));
create policy aria_storage_modify on storage.objects for update to authenticated
    using (bucket_id in ('campaign-files', 'campaign-music') and owner = auth.uid())
    with check (bucket_id in ('campaign-files', 'campaign-music') and owner = auth.uid());
create policy aria_storage_delete on storage.objects for delete to authenticated
    using (bucket_id in ('campaign-files', 'campaign-music') and owner = auth.uid());
