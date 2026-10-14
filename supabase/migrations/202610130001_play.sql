-- Independent adventures/chat. Browser writes are deliberately restricted.
create table public.characters (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles on delete cascade,
 collection_id uuid references collections on delete cascade, name text not null check(length(name) between 1 and 120),
 kind text not null, personality text not null check(length(personality)<=6000), avatar text not null, voice jsonb not null,
 created_at timestamptz not null default now()
);
create table public.adventures (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles on delete cascade,
 title text not null, status text not null default 'lobby' check(status in ('lobby','active','paused','completed')),
 mode text not null check(mode in ('solo','multiplayer')), world text not null, voice jsonb not null,
 edition text not null, design jsonb not null, segments jsonb not null default '[]', summary text not null default '',
 revision integer not null default 0, generation_token uuid, generating_until timestamptz, last_error text,
 created_at timestamptz not null default now()
);
create table public.adventure_players (
 adventure_id uuid not null references adventures on delete cascade, user_id uuid not null references profiles on delete cascade,
 name text not null, character jsonb, primary key(adventure_id,user_id)
);
create table public.chats (id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles on delete cascade, title text not null, created_at timestamptz default now());
create table public.chat_players (chat_id uuid references chats on delete cascade, user_id uuid references profiles on delete cascade, name text not null, primary key(chat_id,user_id));
create table public.chat_messages (
 id uuid primary key, chat_id uuid not null references chats on delete cascade, user_id uuid not null references profiles on delete cascade,
 name text not null, original text not null check(length(original) between 1 and 6000), content text, character jsonb, voice jsonb,
 status text not null default 'sent' check(status in ('sent','pending','failed')), created_at timestamptz not null default now()
);
create index on chat_messages(chat_id,created_at);
create index on adventure_players(user_id);
create index on chat_players(user_id);
create table public.play_invites (token_hash text primary key, adventure_id uuid references adventures on delete cascade, chat_id uuid references chats on delete cascade, expires_at timestamptz not null default now()+interval '7 days', check(num_nonnulls(adventure_id,chat_id)=1));
create table public.ai_settings (user_id uuid primary key references profiles on delete cascade, provider text not null, model text not null, encrypted_key text not null);
create table public.ai_usage (user_id uuid references profiles on delete cascade, day date not null default current_date, units integer not null default 0, shared_units integer not null default 0, calls integer not null default 0, last_call timestamptz, primary key(user_id,day));
alter table entries add column source_adventure_id uuid references adventures on delete set null;
alter table entries add column source_chat_id uuid references chats on delete set null;
create function public.in_adventure(a uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from adventure_players where adventure_id=a and user_id=auth.uid()) $$;
create function public.in_chat(c uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from chat_players where chat_id=c and user_id=auth.uid()) $$;
alter table characters enable row level security;
alter table adventures enable row level security;
alter table adventure_players enable row level security;
alter table chats enable row level security;
alter table chat_players enable row level security;
alter table chat_messages enable row level security;
alter table play_invites enable row level security;
alter table ai_settings enable row level security;
alter table ai_usage enable row level security;
create policy character_read on characters for select to authenticated using ((collection_id is null and owner_id=auth.uid()) or is_member(collection_id));
create policy character_create on characters for insert to authenticated with check(owner_id=auth.uid() and (collection_id is null or is_owner(collection_id)));
create policy character_update on characters for update to authenticated using((collection_id is null and owner_id=auth.uid()) or is_owner(collection_id)) with check(owner_id=auth.uid() and (collection_id is null or is_owner(collection_id)));
create policy character_delete on characters for delete to authenticated using((collection_id is null and owner_id=auth.uid()) or is_owner(collection_id));
create policy adventure_read on adventures for select to authenticated using(in_adventure(id));
create policy adventure_players_read on adventure_players for select to authenticated using(in_adventure(adventure_id));
create policy chat_read on chats for select to authenticated using(in_chat(id));
create policy chat_players_read on chat_players for select to authenticated using(in_chat(chat_id));
create policy chat_messages_read on chat_messages for select to authenticated using(in_chat(chat_id));
grant select,insert,update,delete on characters to authenticated;
grant select on adventures,adventure_players,chats,chat_players,chat_messages to authenticated;
-- Secrets and usage are server-only, including for the owner.
revoke all on ai_settings,ai_usage,play_invites from anon,authenticated;
grant all on characters,adventures,adventure_players,chats,chat_players,chat_messages,play_invites,ai_settings,ai_usage to service_role;
grant select,update on entries to service_role;

create function public.submit_adventure_answer(a uuid, r integer, answer text) returns void language plpgsql security definer set search_path=public as $$
declare s adventures; qs jsonb; idx integer; begin
 if auth.uid() is null or not in_adventure(a) then raise exception 'Not a participant'; end if;
 if length(trim(answer)) not between 1 and 6000 then raise exception 'Answer must be 1–6000 characters'; end if;
 select * into s from adventures where id=a for update;
 if s.status<>'active' or s.revision<>r or s.generating_until>now() then raise exception 'This question has changed. Refresh the story.'; end if;
 if jsonb_array_length(s.segments)=0 then raise exception 'No question'; end if;
 qs=s.segments->(jsonb_array_length(s.segments)-1)->'questions';
 select ordinality::integer-1 into idx from jsonb_array_elements(qs) with ordinality where value->>'player'=auth.uid()::text and not value ? 'answer';
 if idx is null then raise exception 'Not your turn or already answered'; end if;
 update adventures set segments=jsonb_set(segments,array[(jsonb_array_length(segments)-1)::text,'questions',idx::text,'answer'],to_jsonb(trim(answer))) where id=a;
end $$;
revoke all on function submit_adventure_answer(uuid,integer,text) from public;
grant execute on function submit_adventure_answer(uuid,integer,text) to authenticated;

-- Atomic leases prevent duplicate AI calls; stale workers cannot commit.
create function public.lease_adventure(a uuid, ending boolean) returns uuid language plpgsql set search_path=public as $$
declare s adventures; token uuid=gen_random_uuid(); begin
 select * into s from adventures where id=a for update;
 if s.id is null or s.status in ('paused','completed') or s.generating_until>now() then return null; end if;
 if not ending and jsonb_array_length(s.segments)>0 and exists(select 1 from jsonb_array_elements(s.segments->(jsonb_array_length(s.segments)-1)->'questions') q where not q ? 'answer') then return null; end if;
 update adventures set generation_token=token,generating_until=now()+interval '2 minutes',last_error=null where id=a;
 return token;
end $$;
create function public.commit_adventure(a uuid, token uuid, segment jsonb, memory text, ending boolean) returns boolean language plpgsql set search_path=public as $$
begin
 update adventures set segments=segments||jsonb_build_array(segment),summary=memory,status=case when ending then 'completed' else 'active' end,revision=revision+1,generation_token=null,generating_until=null,last_error=null where id=a and generation_token=token;
 return found;
end $$;
create function public.reserve_ai_usage(u uuid, cost integer, daily_limit integer, global_limit integer) returns void language plpgsql set search_path=public as $$
declare used integer; last timestamptz; begin
 perform pg_advisory_xact_lock(761310);
 insert into ai_usage(user_id,day) values(u,current_date) on conflict do nothing;
 select units,last_call into used,last from ai_usage where user_id=u and day=current_date for update;
 if last>now()-interval '3 seconds' then raise exception 'Please wait a few seconds before another AI request.'; end if;
 if used+cost>daily_limit then raise exception 'Daily AI quota reached. Your content is saved.'; end if;
 if global_limit>0 and (select coalesce(sum(shared_units),0) from ai_usage where day=current_date)+cost>global_limit then raise exception 'Shared daily AI allowance reached.'; end if;
 update ai_usage set units=units+cost,shared_units=shared_units+case when global_limit>0 then cost else 0 end,calls=calls+1,last_call=now() where user_id=u and day=current_date;
end $$;
revoke all on function lease_adventure(uuid,boolean),commit_adventure(uuid,uuid,jsonb,text,boolean),reserve_ai_usage(uuid,integer,integer,integer) from public,anon,authenticated;
grant execute on function lease_adventure(uuid,boolean),commit_adventure(uuid,uuid,jsonb,text,boolean),reserve_ai_usage(uuid,integer,integer,integer) to service_role;
revoke all on function in_adventure(uuid),in_chat(uuid) from public;
grant execute on function in_adventure(uuid),in_chat(uuid) to authenticated;
create function public.select_adventure_character(a uuid,u uuid,c jsonb) returns void language plpgsql set search_path=public as $$
declare s adventures; begin
 select * into s from adventures where id=a for update;
 if s.status<>'lobby' or s.generating_until>now() then raise exception 'Characters are locked once the story starts'; end if;
 update adventure_players set character=c where adventure_id=a and user_id=u;
 if not found then raise exception 'Not a participant'; end if;
end $$;
create function public.join_play(hash text,u uuid,player_name text) returns jsonb language plpgsql set search_path=public as $$
declare i play_invites; s adventures; begin
 select * into i from play_invites where token_hash=hash and expires_at>now();
 if i.token_hash is null then raise exception 'Invitation expired or invalid'; end if;
 if i.adventure_id is not null then
 select * into s from adventures where id=i.adventure_id for update;
 if exists(select 1 from adventure_players where adventure_id=s.id and user_id=u) then return jsonb_build_object('id',s.id,'kind','adventure'); end if;
 if s.status<>'lobby' or s.mode<>'multiplayer' or s.generating_until>now() then raise exception 'This adventure has already started'; end if;
 if (select count(*) from adventure_players where adventure_id=s.id)>=8 then raise exception 'The lobby is full (8 players)'; end if;
 insert into adventure_players(adventure_id,user_id,name) values(s.id,u,player_name) on conflict do nothing;
 return jsonb_build_object('id',s.id,'kind','adventure');
 else
 perform 1 from chats where id=i.chat_id for update;
 if (select count(*) from chat_players where chat_id=i.chat_id)>=20 and not exists(select 1 from chat_players where chat_id=i.chat_id and user_id=u) then raise exception 'Chat is full (20 participants)'; end if;
 insert into chat_players(chat_id,user_id,name) values(i.chat_id,u,player_name) on conflict do nothing;
 return jsonb_build_object('id',i.chat_id,'kind','chat');
 end if;
end $$;
revoke all on function select_adventure_character(uuid,uuid,jsonb),join_play(text,uuid,text) from public,anon,authenticated;
grant execute on function select_adventure_character(uuid,uuid,jsonb),join_play(text,uuid,text) to service_role;
-- Realtime still enforces the SELECT policies above.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 foreach t in array array['adventures','adventure_players','chats','chat_players','chat_messages'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop; end if;
end $$;
