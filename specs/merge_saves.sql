-- ═══════════════════════════════════════════════════════════════════════════
--  Une seule cle de sauvegarde par compte
-- ═══════════════════════════════════════════════════════════════════════════
-- Un compte qui se connecte avant de rattacher son ancienne cle en recoit une
-- neuve (la taverne en cree une pour y ranger ses personnages). Une fois l'ancienne
-- rattachee, il en possede deux, et chaque panneau n'en lit qu'une : les
-- personnages de l'autre disparaissent.
--
-- Au rattachement, tout ce que le compte possede passe donc sous la cle rattachee
-- (c'est l'ancienne, celle qui est collee dans les URL OBS), et les autres cles,
-- vides, sont supprimees. Seuls characters et campaigns pointent vers saves ; tout
-- le reste (PV, notes, monstres, fichiers...) pend a un personnage ou a une
-- campagne et suit sans rien toucher.
--
-- Une cle dont le blob JSON d'avant le schema relationnel n'a jamais ete migre
-- n'est pas supprimee : ce blob est la seule copie de ses donnees, et seul le
-- panneau sait le migrer (runMigration). Elle reste, vide de lignes, jusqu'a ce
-- qu'on la traite a la main.

create or replace function public.merge_owned_saves (p_owner uuid, p_into uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
    update public.characters set save_key = p_into
     where save_key in (select save_key from public.saves where owner = p_owner and save_key <> p_into);
    update public.campaigns set save_key = p_into
     where save_key in (select save_key from public.saves where owner = p_owner and save_key <> p_into);
    delete from public.saves
     where owner = p_owner and save_key <> p_into
       and (data is null or data = '{}'::jsonb
            or ((not data ? 'player' or player_migrated_at is not null)
            and (not data ? 'gm'     or gm_migrated_at     is not null)));
end;
$$;

-- Interne : appelee par claim_save_key, jamais par un client.
revoke all on function public.merge_owned_saves (uuid, uuid) from public, anon, authenticated;

create or replace function public.claim_save_key (p_key uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    select owner into v_owner from public.saves where save_key = p_key;
    if not found then
        return false;                       -- cle inconnue
    end if;
    if v_owner is not null and v_owner <> auth.uid() then
        return false;                       -- cle d'un autre compte
    end if;

    -- Deja a lui : idempotent, et la fusion rattrape les comptes qui ont
    -- reclame leur cle avant qu'elle existe.
    update public.saves set owner = auth.uid() where save_key = p_key;
    perform public.merge_owned_saves (auth.uid(), p_key);
    return true;
end;
$$;

revoke all on function public.claim_save_key (uuid) from public, anon;
grant execute on function public.claim_save_key (uuid) to authenticated;
