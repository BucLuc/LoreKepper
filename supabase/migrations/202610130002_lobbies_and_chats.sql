grant select on public.profiles to service_role;
-- Live editable lobbies, resumed parties, and atomic direct/group chat creation.
alter table public.chats add column kind text not null default 'group' check(kind in ('direct','group'));
alter table public.chats add column direct_key text unique;
create function public.create_user_chat(u uuid, people uuid[], chat_kind text, chat_title text) returns uuid language plpgsql set search_path=public as $$
declare cid uuid; pair text; n integer; begin
 if chat_kind not in ('direct','group') then raise exception 'Invalid chat kind'; end if;
 select count(distinct x) into n from unnest(people) x where x<>u;
 if n<>cardinality(people) or n<1 or n>31 or (chat_kind='direct' and n<>1) then raise exception 'Choose one user for a direct chat or up to 31 for a group'; end if;
 if (select count(*) from profiles where id=any(people))<>n then raise exception 'User unavailable'; end if;
 if chat_kind='direct' then
  pair=least(u::text,people[1]::text)||':'||greatest(u::text,people[1]::text);
  perform pg_advisory_xact_lock(hashtextextended(pair,0));
  select id into cid from chats where direct_key=pair;
  if cid is not null then return cid; end if;
 end if;
 insert into chats(owner_id,title,kind,direct_key) values(u,coalesce(nullif(trim(chat_title),''),(select string_agg(name,' & ' order by name) from profiles where id=any(people||array[u]))),chat_kind,pair) returning id into cid;
 insert into chat_players(chat_id,user_id,name) select cid,id,name from profiles where id=any(people||array[u]);
 return cid;
end $$;
create function public.configure_adventure(a uuid,u uuid,r integer,settings jsonb,casts jsonb) returns void language plpgsql set search_path=public as $$
declare s adventures; item jsonb; begin
 select * into s from adventures where id=a for update;
 if s.owner_id is distinct from u or s.status not in ('lobby','paused') or s.generating_until>now() then raise exception 'Only the creator can edit an idle lobby'; end if;
 if s.revision<>r then raise exception 'Lobby changed. Reload before saving'; end if;
 if jsonb_typeof(casts)<>'array' then raise exception 'Invalid cast'; end if;
 for item in select * from jsonb_array_elements(casts) loop
  update adventure_players set character=nullif(item->'character','null'::jsonb) where adventure_id=a and user_id=(item->>'user')::uuid;
  if not found then raise exception 'Unknown player'; end if;
 end loop;
 update adventures set title=settings->>'title',world=settings->>'world',voice=settings->'voice',edition=settings->>'edition',design=settings->'design',revision=revision+1 where id=a;
end $$;
create function public.invite_adventure_user(a uuid,u uuid,person uuid) returns void language plpgsql set search_path=public as $$
declare s adventures; begin
 select * into s from adventures where id=a for update;
 if s.owner_id is distinct from u or s.status not in ('lobby','paused') or s.generating_until>now() then raise exception 'Only the creator can invite from an idle lobby'; end if;
 if exists(select 1 from adventure_players where adventure_id=a and user_id=person) then return; end if;
 if (select count(*) from adventure_players where adventure_id=a)>=8 then raise exception 'The party is full (8 players)'; end if;
 insert into adventure_players(adventure_id,user_id,name) select a,id,name from profiles where id=person;
 if not found then raise exception 'User unavailable'; end if;
 update adventures set mode='multiplayer' where id=a;
end $$;
create function public.commit_adventure_scene(a uuid,token uuid,segment jsonb,memory text,ending boolean,story_title text,story_world text) returns boolean language plpgsql set search_path=public as $$
begin
 update adventures set segments=segments||jsonb_build_array(segment),summary=memory,status=case when ending then 'completed' else 'active' end,revision=revision+1,generation_token=null,generating_until=null,last_error=null,
 title=case when length(trim(title))=0 then coalesce(nullif(trim(story_title),''),'An unexpected adventure') else title end,
 world=case when length(trim(world))=0 then coalesce(story_world,'') else world end
 where id=a and generation_token=token;
 return found;
end $$;
create or replace function public.join_play(hash text,u uuid,player_name text) returns jsonb language plpgsql set search_path=public as $$
declare i play_invites; s adventures; begin
 select * into i from play_invites where token_hash=hash and expires_at>now();
 if i.token_hash is null then raise exception 'Invitation expired or invalid'; end if;
 if i.adventure_id is not null then
  select * into s from adventures where id=i.adventure_id for update;
  if exists(select 1 from adventure_players where adventure_id=s.id and user_id=u) then return jsonb_build_object('id',s.id,'kind','adventure'); end if;
  if s.status not in ('lobby','paused') or s.generating_until>now() then raise exception 'Wait until the creator returns to the lobby'; end if;
  if (select count(*) from adventure_players where adventure_id=s.id)>=8 then raise exception 'The party is full (8 players)'; end if;
  insert into adventure_players(adventure_id,user_id,name) values(s.id,u,player_name);
  update adventures set mode='multiplayer' where id=s.id;
  return jsonb_build_object('id',s.id,'kind','adventure');
 else
  perform 1 from chats where id=i.chat_id and kind='group' for update;
  if not found then raise exception 'Direct chats cannot accept extra players'; end if;
  if (select count(*) from chat_players where chat_id=i.chat_id)>=32 then raise exception 'The group is full'; end if;
  insert into chat_players(chat_id,user_id,name) values(i.chat_id,u,player_name) on conflict do nothing;
  return jsonb_build_object('id',i.chat_id,'kind','chat');
 end if;
end $$;
revoke all on function create_user_chat(uuid,uuid[],text,text),configure_adventure(uuid,uuid,integer,jsonb,jsonb),invite_adventure_user(uuid,uuid,uuid),commit_adventure_scene(uuid,uuid,jsonb,text,boolean,text,text) from public,anon,authenticated;
grant execute on function create_user_chat(uuid,uuid[],text,text),configure_adventure(uuid,uuid,integer,jsonb,jsonb),invite_adventure_user(uuid,uuid,uuid),commit_adventure_scene(uuid,uuid,jsonb,text,boolean,text,text) to service_role;

create function public.set_adventure_status(a uuid,u uuid,next_status text) returns void language plpgsql set search_path=public as $$
declare s adventures;begin
 select * into s from adventures where id=a for update;
 if s.owner_id is distinct from u or s.status not in ('lobby','active','paused') or next_status not in ('active','paused') then raise exception 'Only the creator can pause or continue'; end if;
 if s.generating_until>now() then raise exception 'Wait until the narrator finishes'; end if;
 if next_status='active' and jsonb_array_length(s.segments)=0 then raise exception 'Begin the adventure to create the first scene'; end if;
 update adventures set status=next_status,generation_token=null,generating_until=null where id=a;
end $$;
revoke all on function set_adventure_status(uuid,uuid,text) from public,anon,authenticated;
grant execute on function set_adventure_status(uuid,uuid,text) to service_role;
