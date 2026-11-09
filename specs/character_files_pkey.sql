-- ═══════════════════════════════════════════════════════════════════════════
--  character_files : une ligne par (personnage, fichier)
-- ═══════════════════════════════════════════════════════════════════════════
-- La cle primaire etait l'id du fichier seul. Un fichier donne a plusieurs
-- joueurs ne pouvait donc avoir qu'une ligne : chaque upsert la reprenait au
-- personnage precedent (avant RLS), puis, avec RLS, echouait en 403 pour tout
-- joueur autre que le premier a l'avoir recu. Le client upsert desormais sur
-- (character_id, id).

alter table public.character_files alter column character_id set not null;
alter table public.character_files drop constraint character_files_pkey;
alter table public.character_files add primary key (character_id, id);
