-- ChatGPT Actions use account-bound OAuth; Supabase credentials never leave the server.
alter table public.adventures add column ai_mode text not null default 'api' check(ai_mode in ('api','chatgpt'));
alter table public.adventure_players add column identity_name text not null default '' check(length(identity_name)<=100);
alter table public.adventure_players add column description text not null default '' check(length(description)<=2000);
create table public.gpt_oauth_codes(code_hash text primary key,user_id uuid not null references profiles on delete cascade,redirect_uri text not null,expires_at timestamptz not null default now()+interval '5 minutes',used boolean not null default false);
create table public.gpt_connections(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,access_hash text unique not null,refresh_hash text unique not null,access_expires timestamptz not null,refresh_expires timestamptz not null,minute timestamptz not null default now(),hits integer not null default 0,created_at timestamptz not null default now());
create table public.gpt_turn_receipts(adventure_id uuid references adventures on delete cascade,request_id text check(length(request_id) between 1 and 100),payload_hash text not null,revision integer not null,primary key(adventure_id,request_id));
create table public.gpt_import_receipts(user_id uuid references profiles on delete cascade,request_id text check(length(request_id) between 1 and 100),adventure_id uuid references adventures on delete cascade,payload_hash text not null,primary key(user_id,request_id));
alter table public.gpt_oauth_codes enable row level security;
alter table public.gpt_connections enable row level security;
alter table public.gpt_turn_receipts enable row level security;
alter table public.gpt_import_receipts enable row level security;
revoke all on gpt_oauth_codes,gpt_connections,gpt_turn_receipts,gpt_import_receipts from public,anon,authenticated;
grant all on gpt_oauth_codes,gpt_connections,gpt_turn_receipts,gpt_import_receipts to service_role;
create function public.exchange_gpt_code(hash text,redirect text) returns uuid language plpgsql set search_path=public as $$declare u uuid;begin
 update gpt_oauth_codes set used=true where code_hash=hash and redirect_uri=redirect and expires_at>now() and not used returning user_id into u;
 return u;
end $$;
create function public.rotate_gpt_refresh(hash text,access text,refresh text) returns uuid language plpgsql set search_path=public as $$declare u uuid;begin
 update gpt_connections set access_hash=access,refresh_hash=refresh,access_expires=now()+interval '1 hour',refresh_expires=now()+interval '30 days' where refresh_hash=hash and refresh_expires>now() returning user_id into u;
 return u;
end $$;
create function public.authenticate_gpt(hash text) returns uuid language plpgsql set search_path=public as $$declare c gpt_connections;begin
 select * into c from gpt_connections where access_hash=hash and access_expires>now() for update;
 if c.id is null then return null; end if;
 if c.minute>now()-interval '1 minute' and c.hits>=90 then raise exception 'Rate limit reached'; end if;
 update gpt_connections set hits=case when minute<=now()-interval '1 minute' then 1 else hits+1 end,minute=case when minute<=now()-interval '1 minute' then now() else minute end where id=c.id;
 return c.user_id;
end $$;
create or replace function public.configure_adventure(a uuid,u uuid,r integer,settings jsonb,casts jsonb) returns void language plpgsql set search_path=public as $$declare s adventures;item jsonb;begin
 select * into s from adventures where id=a for update;
 if s.owner_id is distinct from u or s.status not in ('lobby','paused') or s.generating_until>now() then raise exception 'Only the creator can edit an idle lobby'; end if;
 if s.revision<>r then raise exception 'Lobby changed. Reload before saving'; end if;
 if jsonb_typeof(casts)<>'array' then raise exception 'Invalid players'; end if;
 for item in select * from jsonb_array_elements(casts) loop
  update adventure_players set identity_name=left(coalesce(trim(item->>'name'),''),100),description=left(coalesce(item->>'description',''),2000),character=null where adventure_id=a and user_id=(item->>'user')::uuid;
  if not found then raise exception 'Unknown player'; end if;
 end loop;
 update adventures set title=settings->>'title',world=settings->>'world',voice=settings->'voice',edition=settings->>'edition',design=settings->'design',ai_mode=coalesce(settings->>'ai_mode','api'),revision=revision+1 where id=a;
end $$;
create function public.arm_chatgpt_story(a uuid,u uuid) returns void language plpgsql set search_path=public as $$declare s adventures;begin
 select * into s from adventures where id=a for update;
 if s.owner_id is distinct from u or s.ai_mode<>'chatgpt' or s.status='completed' or s.generating_until>now() then raise exception 'Only the creator can start a ChatGPT session'; end if;
 update adventures set status='active',generation_token=null,generating_until=null,last_error=null where id=a;
end $$;
create function public.commit_gpt_turn(a uuid,u uuid,r integer,request_id text,digest text,segment jsonb,memory text,ending boolean,story_title text,story_world text) returns jsonb language plpgsql set search_path=public as $$declare s adventures;receipt gpt_turn_receipts;begin
 select * into s from adventures where id=a for update;
 if s.owner_id is distinct from u or s.ai_mode<>'chatgpt' then raise exception 'Session unavailable'; end if;
 select * into receipt from gpt_turn_receipts where adventure_id=a and gpt_turn_receipts.request_id=commit_gpt_turn.request_id;
 if receipt.request_id is not null then
  if receipt.payload_hash<>digest then raise exception 'Request ID was reused for a different scene'; end if;
  return jsonb_build_object('revision',receipt.revision,'duplicate',true);
 end if;
 if s.status<>'active' or s.revision<>r or s.generating_until>now() then raise exception 'Session changed. Fetch the turn again'; end if;
 if jsonb_array_length(s.segments)>0 and exists(select 1 from jsonb_array_elements(s.segments->(jsonb_array_length(s.segments)-1)->'questions') q where not q ? 'answer') then raise exception 'Wait for all players to answer'; end if;
 update adventures set segments=segments||jsonb_build_array(segment),summary=memory,status=case when ending then 'completed' else 'active' end,revision=revision+1,title=case when trim(title)='' then story_title else title end,world=case when trim(world)='' then story_world else world end,last_error=null where id=a;
 insert into gpt_turn_receipts values(a,request_id,digest,r+1);
 return jsonb_build_object('revision',r+1,'duplicate',false);
end $$;
create function public.import_gpt_story(u uuid,request_id text,digest text,story_title text,story_world text,memory text,markdown text,edition text,design jsonb) returns uuid language plpgsql set search_path=public as $$declare receipt gpt_import_receipts;aid uuid=gen_random_uuid();begin
 perform pg_advisory_xact_lock(hashtextextended(u::text||':'||request_id,0));
 select * into receipt from gpt_import_receipts where user_id=u and gpt_import_receipts.request_id=import_gpt_story.request_id;
 if receipt.adventure_id is not null then
  if receipt.payload_hash<>digest then raise exception 'Request ID was reused for a different story'; end if;
  return receipt.adventure_id;
 end if;
 insert into adventures(id,owner_id,title,world,summary,status,mode,ai_mode,voice,edition,design,segments,revision) values(aid,u,story_title,story_world,memory,'completed','solo','chatgpt','{"language":"English","style":"Modern","tone":"Default","scope":"entire"}',edition,design,jsonb_build_array(jsonb_build_object('narrative',markdown,'questions','[]'::jsonb,'created',now())),1);
 insert into adventure_players(adventure_id,user_id,name) select aid,id,name from profiles where id=u;
 insert into gpt_import_receipts values(u,request_id,aid,digest);
 return aid;
end $$;
revoke all on function exchange_gpt_code(text,text),rotate_gpt_refresh(text,text,text),authenticate_gpt(text),arm_chatgpt_story(uuid,uuid),commit_gpt_turn(uuid,uuid,integer,text,text,jsonb,text,boolean,text,text),import_gpt_story(uuid,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function exchange_gpt_code(text,text),rotate_gpt_refresh(text,text,text),authenticate_gpt(text),arm_chatgpt_story(uuid,uuid),commit_gpt_turn(uuid,uuid,integer,text,text,jsonb,text,boolean,text,text),import_gpt_story(uuid,text,text,text,text,text,text,text,jsonb) to service_role;
