-- Account names never reach ChatGPT: unnamed characters stay unnamed in the story.
-- Players come back in a stable order so neutral labels ("Player 2") stay consistent.
create or replace function public.mcp_get_roleplay(u uuid,a uuid) returns jsonb language plpgsql stable set search_path=public as $$
declare s adventures;begin
 select * into s from adventures where id=a;
 if s.id is null or s.owner_id is distinct from u then raise exception 'Roleplay not found. Check the session ID and that you are signed in to the Lorekeeper account that owns it.'; end if;
 return jsonb_build_object(
  'story',to_jsonb(s)-'generation_token',
  'players',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'identity_name',identity_name,'description',description,'character',character,'voice',voice) order by user_id),'[]') from adventure_players where adventure_id=a));
end $$;

create or replace function public.mcp_save_chapter(u uuid,a uuid,r integer,chapter text,questions jsonb,story_title text,story_world text,memory text,ending boolean) returns jsonb language plpgsql set search_path=public as $$
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
  -- Same labels as get_roleplay: the character name, else "the player" / "Player N".
  select string_agg(coalesce(nullif(p.identity_name,''),case when p.total=1 then 'the player' else 'Player '||p.position end),', ') into waiting
   from jsonb_array_elements(s.segments->(n-1)->'questions') q
   join (select user_id,identity_name,row_number() over (order by user_id) position,count(*) over () total from adventure_players where adventure_id=a) p on p.user_id::text=q->>'player'
   where not q ? 'answer';
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
