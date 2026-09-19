-- Chat persistence. Run once in the Supabase SQL editor.
--
-- Keyed by join_code, not campaign_id: both ends of a conversation know the join
-- code, only the GM knows the campaign UUID. `thread` is 'global' or the two
-- participant ids sorted and joined with '|' ('gm' for the GM, charId for a player).
create table if not exists campaign_chat (
    id          text primary key,
    join_code   text not null,
    thread      text not null,
    author_id   text,
    author_name text,
    body        text,
    created_at  timestamptz not null default now()
);

create index if not exists campaign_chat_lookup
    on campaign_chat (join_code, thread, created_at);
