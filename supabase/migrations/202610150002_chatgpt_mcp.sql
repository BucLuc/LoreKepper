-- ChatGPT connects through the lorekeeper-mcp Edge Function. Supabase Auth's OAuth 2.1
-- server issues the tokens, so the hand-rolled Actions OAuth tables are no longer needed.
drop function if exists public.exchange_gpt_code(text,text);
drop function if exists public.rotate_gpt_refresh(text,text,text);
drop function if exists public.authenticate_gpt(text);
drop function if exists public.commit_gpt_turn(uuid,uuid,integer,text,text,jsonb,text,boolean,text,text);
drop table if exists public.gpt_oauth_codes;
drop table if exists public.gpt_connections;
drop table if exists public.gpt_turn_receipts;

-- Stories the connected user owns, newest first.
create function public.mcp_list_roleplays(u uuid) returns jsonb language sql stable set search_path=public as $$
 select coalesce(jsonb_agg(x order by x->>'created_at' desc),'[]') from (
  select jsonb_build_object('id',id,'title',title,'status',status,'chapters',jsonb_array_length(segments),'created_at',created_at) x
  from adventures where owner_id=u order by created_at desc limit 25
 ) t
$$;

-- Settings, players and the complete history of one owned story.
create function public.mcp_get_roleplay(u uuid,a uuid) returns jsonb language plpgsql stable set search_path=public as $$
declare s adventures;begin
 select * into s from adventures where id=a;
 if s.id is null or s.owner_id is distinct from u then raise exception 'Roleplay not found. Check the session ID and that you are signed in to the Lorekeeper account that owns it.'; end if;
 return jsonb_build_object(
  'story',to_jsonb(s)-'generation_token',
  'players',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'name',name,'identity_name',identity_name,'description',description,'character',character)),'[]') from adventure_players where adventure_id=a));
end $$;

-- Appends the next chapter. A lobby session starts here, so "Begin" in Lorekeeper is optional.
create function public.mcp_save_chapter(u uuid,a uuid,r integer,chapter text,questions jsonb,story_title text,story_world text,memory text,ending boolean) returns jsonb language plpgsql set search_path=public as $$
declare s adventures;n integer;waiting text;begin
 select * into s from adventures where id=a for update;
 if s.id is null or s.owner_id is distinct from u then raise exception 'Roleplay not found.'; end if;
 n=jsonb_array_length(s.segments);
 -- An exact retry of the chapter that was just saved succeeds without a second copy.
 if n>0 and s.segments->(n-1)->>'narrative'=chapter then return jsonb_build_object('revision',s.revision,'chapter',n,'duplicate',true); end if;
 if s.status='completed' then raise exception 'This roleplay is finished. Nothing more can be added.'; end if;
 if s.status='paused' then raise exception 'This roleplay is paused in Lorekeeper. Ask the user to resume it there first.'; end if;
 if s.generating_until>now() then raise exception 'Lorekeeper is writing a chapter for this story right now. Try again in a minute.'; end if;
 if s.revision<>r then raise exception 'The roleplay changed since you read it. Call get_roleplay again, then write the chapter from the new state.'; end if;
 if n>0 then
  select string_agg(coalesce(nullif(p.identity_name,''),p.name),', ') into waiting from jsonb_array_elements(s.segments->(n-1)->'questions') q
   left join adventure_players p on p.adventure_id=a and p.user_id::text=q->>'player' where not q ? 'answer';
  if waiting is not null then raise exception 'Still waiting in Lorekeeper for an answer from: %.', waiting; end if;
 end if;
 if length(trim(chapter))=0 then raise exception 'The chapter is empty.'; end if;
 if jsonb_typeof(questions)<>'array' or (not ending and jsonb_array_length(questions)=0) then raise exception 'Ask the player(s) a question so they can answer in Lorekeeper.'; end if;
 if exists(select 1 from jsonb_array_elements(questions) q where not exists(select 1 from adventure_players where adventure_id=a and user_id::text=q->>'player')) then raise exception 'Unknown player in questions.'; end if;
 update adventures set
  segments=segments||jsonb_build_array(jsonb_build_object('narrative',chapter,'questions',case when ending then '[]'::jsonb else questions end,'created',now())),
  summary=coalesce(memory,summary),status=case when ending then 'completed' else 'active' end,ai_mode='chatgpt',revision=revision+1,
  generation_token=null,generating_until=null,last_error=null,
  title=case when length(trim(title))=0 then coalesce(nullif(trim(story_title),''),'An unexpected adventure') else title end,
  world=case when length(trim(world))=0 then coalesce(story_world,'') else world end
 where id=a;
 return jsonb_build_object('revision',s.revision+1,'chapter',n+1,'duplicate',false);
end $$;

-- Saves a roleplay played in ChatGPT as a continuable Lorekeeper story, or replaces the
-- chapters of one saved earlier from the same conversation. digest makes retries idempotent.
create function public.mcp_save_roleplay(u uuid,a uuid,digest text,story_title text,story_world text,memory text,story_voice jsonb,identity text,about text,chapters jsonb,finished boolean,design jsonb) returns uuid language plpgsql set search_path=public as $$
declare receipt gpt_import_receipts;s adventures;aid uuid=coalesce(a,gen_random_uuid());begin
 perform pg_advisory_xact_lock(hashtextextended(u::text||':'||digest,0));
 select * into receipt from gpt_import_receipts where user_id=u and request_id=digest;
 if receipt.adventure_id is not null then return receipt.adventure_id; end if;
 if jsonb_typeof(chapters)<>'array' or jsonb_array_length(chapters)=0 then raise exception 'Include at least one chapter.'; end if;
 if a is null then
  insert into adventures(id,owner_id,title,world,summary,status,mode,ai_mode,voice,edition,design,segments,revision)
   values(aid,u,story_title,story_world,memory,case when finished then 'completed' else 'active' end,'solo','chatgpt',story_voice,'glorious',design,chapters,1);
  insert into adventure_players(adventure_id,user_id,name,identity_name,description) select aid,id,name,identity,about from profiles where id=u;
 else
  select * into s from adventures where id=a for update;
  if s.id is null or s.owner_id is distinct from u then raise exception 'Roleplay not found.'; end if;
  if s.generating_until>now() then raise exception 'Lorekeeper is writing a chapter for this story right now. Try again in a minute.'; end if;
  update adventures set title=story_title,world=story_world,summary=memory,voice=story_voice,segments=chapters,ai_mode='chatgpt',
   status=case when finished then 'completed' else 'active' end,revision=revision+1,last_error=null where id=a;
  update adventure_players set identity_name=identity,description=about where adventure_id=a and user_id=u;
 end if;
 insert into gpt_import_receipts values(u,digest,aid,digest);
 return aid;
end $$;

-- Adds the next part of a long imported Markdown story.
create function public.mcp_append_story(u uuid,a uuid,markdown text) returns jsonb language plpgsql set search_path=public as $$
declare s adventures;n integer;begin
 select * into s from adventures where id=a for update;
 if s.id is null or s.owner_id is distinct from u then raise exception 'Story not found.'; end if;
 n=jsonb_array_length(s.segments);
 if n>0 and s.segments->(n-1)->>'narrative'=markdown then return jsonb_build_object('parts',n,'duplicate',true); end if;
 if s.status<>'completed' then raise exception 'Only imported stories can be appended to.'; end if;
 update adventures set segments=segments||jsonb_build_array(jsonb_build_object('narrative',markdown,'questions','[]'::jsonb,'created',now())),revision=revision+1 where id=a;
 return jsonb_build_object('parts',n+1,'duplicate',false);
end $$;

revoke all on function mcp_list_roleplays(uuid),mcp_get_roleplay(uuid,uuid),mcp_save_chapter(uuid,uuid,integer,text,jsonb,text,text,text,boolean),mcp_save_roleplay(uuid,uuid,text,text,text,text,jsonb,text,text,jsonb,boolean,jsonb),mcp_append_story(uuid,uuid,text) from public,anon,authenticated;
grant execute on function mcp_list_roleplays(uuid),mcp_get_roleplay(uuid,uuid),mcp_save_chapter(uuid,uuid,integer,text,jsonb,text,text,text,boolean),mcp_save_roleplay(uuid,uuid,text,text,text,text,jsonb,text,text,jsonb,boolean,jsonb),mcp_append_story(uuid,uuid,text) to service_role;
