-- Carte tactique façon Roll20 (specs/2026-10-05-carte-tactique-design.md).
-- Toutes les colonnes de la spec d'un coup, pour ne pas migrer à chaque phase ;
-- ENT.map (js/aria-supabase.js) ne les déclare qu'au fur et à mesure de leur usage.
-- Nullable / avec défaut : les cartes existantes restent des cartes de monde, rien à
-- reprendre. Les policies de campaign_maps couvrent déjà les nouvelles colonnes.
--
-- AriaTest : supabase db query --linked --project-ref qpxaaauzzbahsdhsjaqn -f specs/campaign_maps_tactique.sql

alter table campaign_maps
  add column if not exists kind   text default 'monde',   -- 'monde' | 'tactique'
  add column if not exists size   jsonb,                  -- { w, h } : pixels de l'image
  add column if not exists grid   jsonb,                  -- { cell, ox, oy, unit, per, snap, show }
  add column if not exists tokens jsonb,                  -- phase 2
  add column if not exists fog    jsonb,                  -- phase 4
  add column if not exists moves  text default 'libre',   -- phase 2 : 'libre' | 'validation'
  add column if not exists walls  jsonb;                  -- phase 5 : { url, v }
