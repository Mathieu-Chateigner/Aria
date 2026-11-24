-- ═══════════════════════════════════════════════════════════════════════════
--  La salle VDO d'une campagne, lisible par ses joueurs
-- ═══════════════════════════════════════════════════════════════════════════
-- A lancer apres ably_token.sql. Rejouable : `create or replace`.
--
-- Les cameras des joueurs ne connaissaient la salle VDO que par la presence du MJ :
-- MJ absent, pas de salle, pas de camera. La salle est un reglage de la campagne
-- (campaigns.vdo_room / vdo_room_password) ; le panneau joueur la lit ici a l'entree,
-- et la presence du MJ ne fait plus que la mettre a jour en direct.
--
-- campaigns reste lisible par son seul proprietaire (elle porte le mot de passe).
-- Meme frontiere que chat_ids() et que le jeton Ably joueur : le MJ de la campagne,
-- ou un compte qui a un personnage lie a ce code. Connaitre le code ne suffit pas.
create or replace function public.campaign_vdo(p_code text)
returns table (room text, password text)
language sql stable security definer set search_path = ''
as $$
    select c.vdo_room, c.vdo_room_password
      from public.campaigns c
     where upper(c.join_code) = upper(trim(p_code))
       and (exists (select 1 from public.saves s
                     where s.save_key = c.save_key and s.owner = auth.uid())
            or exists (select 1 from public.characters ch
                         join public.saves s on s.save_key = ch.save_key
                        where s.owner = auth.uid()
                          and upper(ch.campaign_key) = upper(trim(p_code))))
$$;
revoke all on function public.campaign_vdo(text) from public, anon;
grant execute on function public.campaign_vdo(text) to authenticated;
