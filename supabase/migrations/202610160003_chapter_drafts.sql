-- ChatGPT saves a chapter section by section, so players read along while it writes.
-- The draft holds the sections so far; save_chapter turns it into the chapter.
-- Pausing only stops Lorekeeper's own narrator; ChatGPT writes only when asked, so its
-- writes resume a paused story.
alter table public.adventures add column draft jsonb check(draft is null or jsonb_typeof(draft->'parts')='array');

-- Labels for players still to answer, as get_roleplay names them (never account names).
create function public.mcp_waiting_for(a uuid) returns text language sql stable set search_path=public as $$
 select string_agg(coalesce(nullif(p.identity_name,''),case when p.total=1 then 'the player' else 'Player '||p.position end),', ')
 from adventures s
 cross join lateral jsonb_array_elements(s.segments->(jsonb_array_length(s.segments)-1)->'questions') q
 join (select user_id,identity_name,row_number() over (order by user_id) position,count(*) over () total from adventure_players where adventure_id=a) p on p.user_id::text=q->>'player'
 where s.id=a and jsonb_array_length(s.segments)>0 and not q ? 'answer'
$$;

create function public.mcp_write_section(u uuid,a uuid,r integer,part text,n integer,story_title text,story_world text) returns jsonb language plpgsql set search_path=public as $$
declare s adventures;parts jsonb;k integer;waiting text;begin
 select * into s from adventures where id=a for update;
 if s.id is null or s.owner_id is distinct from u then raise exception 'Roleplay not found.'; end if;
 parts=coalesce(s.draft->'parts','[]'::jsonb);
 k=jsonb_array_length(parts);
 -- A retried section is accepted once.
 if n between 1 and k and parts->>(n-1)=part then return jsonb_build_object('section',n,'duplicate',true); end if;
 if s.status='completed' then raise exception 'This roleplay is finished. Nothing more can be added.'; end if;
 if s.generating_until>now() then raise exception 'Lorekeeper is writing a chapter for this story right now. Try again in a minute.'; end if;
 if s.revision<>r then raise exception 'The roleplay changed since you read it. Call get_roleplay again, then write the chapter from the new state.'; end if;
 waiting=mcp_waiting_for(a);
 if waiting is not null then raise exception 'Still waiting in Lorekeeper for an answer from: %.', waiting; end if;
 if length(trim(part))=0 then raise exception 'The section is empty.'; end if;
 -- Section 1 starts the chapter over; otherwise sections arrive in order.
 if n=1 then parts='[]'::jsonb;
 elsif n<>k+1 then raise exception 'Send section % next; sections must arrive in order.', k+1;
 end if;
 update adventures set draft=jsonb_build_object('parts',parts||to_jsonb(part)),status='active',ai_mode='chatgpt',last_error=null,
  title=case when length(trim(title))=0 and length(trim(coalesce(story_title,'')))>0 then trim(story_title) else title end,
  world=case when length(trim(world))=0 and length(trim(coalesce(story_world,'')))>0 then story_world else world end
 where id=a;
 return jsonb_build_object('section',n,'duplicate',false);
end $$;

-- chapter may be null: the saved sections then form the chapter.
create or replace function public.mcp_save_chapter(u uuid,a uuid,r integer,chapter text,questions jsonb,story_title text,story_world text,memory text,ending boolean) returns jsonb language plpgsql set search_path=public as $$
declare s adventures;n integer;waiting text;begin
 select * into s from adventures where id=a for update;
 if s.id is null or s.owner_id is distinct from u then raise exception 'Roleplay not found.'; end if;
 n=jsonb_array_length(s.segments);
 if length(trim(coalesce(chapter,'')))=0 then
  if jsonb_array_length(coalesce(s.draft->'parts','[]'::jsonb))>0 then
   select string_agg(value,E'\n\n' order by ord) into chapter from jsonb_array_elements_text(s.draft->'parts') with ordinality t(value,ord);
  elsif n>0 and s.revision=r+1 then
   -- A retry after the draft was already turned into this chapter.
   return jsonb_build_object('revision',s.revision,'chapter',n,'duplicate',true);
  else raise exception 'The chapter is empty. Send it as chapter, or first with write_section.';
  end if;
 end if;
 -- An exact retry of the chapter that was just saved succeeds without a second copy.
 if n>0 and s.segments->(n-1)->>'narrative'=chapter then return jsonb_build_object('revision',s.revision,'chapter',n,'duplicate',true); end if;
 if s.status='completed' then raise exception 'This roleplay is finished. Nothing more can be added.'; end if;
 if s.generating_until>now() then raise exception 'Lorekeeper is writing a chapter for this story right now. Try again in a minute.'; end if;
 if s.revision<>r then raise exception 'The roleplay changed since you read it. Call get_roleplay again, then write the chapter from the new state.'; end if;
 waiting=mcp_waiting_for(a);
 if waiting is not null then raise exception 'Still waiting in Lorekeeper for an answer from: %.', waiting; end if;
 if jsonb_typeof(questions)<>'array' or (not ending and jsonb_array_length(questions)=0) then raise exception 'Ask the player(s) a question so they can answer in Lorekeeper.'; end if;
 if exists(select 1 from jsonb_array_elements(questions) q where not exists(select 1 from adventure_players where adventure_id=a and user_id::text=q->>'player')) then raise exception 'Unknown player in questions.'; end if;
 update adventures set
  segments=segments||jsonb_build_array(jsonb_build_object('narrative',chapter,'questions',case when ending then '[]'::jsonb else questions end,'created',now())),
  draft=null,summary=coalesce(memory,summary),status=case when ending then 'completed' else 'active' end,ai_mode='chatgpt',revision=revision+1,
  generation_token=null,generating_until=null,last_error=null,
  title=case when length(trim(title))=0 then coalesce(nullif(trim(story_title),''),'An unexpected adventure') else title end,
  world=case when length(trim(world))=0 then coalesce(story_world,'') else world end
 where id=a;
 return jsonb_build_object('revision',s.revision+1,'chapter',n+1,'duplicate',false);
end $$;

-- Replacing a saved roleplay's chapters also drops any half-written chapter.
create or replace function public.mcp_save_roleplay(u uuid,a uuid,digest text,story_title text,story_world text,memory text,story_voice jsonb,identity text,about text,chapters jsonb,finished boolean,design jsonb) returns uuid language plpgsql set search_path=public as $$
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
  update adventures set title=story_title,world=story_world,summary=memory,voice=story_voice,segments=chapters,draft=null,ai_mode='chatgpt',
   status=case when finished then 'completed' else 'active' end,revision=revision+1,last_error=null where id=a;
  update adventure_players set identity_name=identity,description=about where adventure_id=a and user_id=u;
 end if;
 insert into gpt_import_receipts values(u,digest,aid,digest);
 return aid;
end $$;

revoke all on function mcp_waiting_for(uuid),mcp_write_section(uuid,uuid,integer,text,integer,text,text) from public,anon,authenticated;
grant execute on function mcp_waiting_for(uuid),mcp_write_section(uuid,uuid,integer,text,integer,text,text) to service_role;

-- ChatGPT stories stay active between chapters, so their lobby stays editable then
-- (but not while a chapter is half written).
create or replace function public.configure_adventure(a uuid,u uuid,r integer,settings jsonb,casts jsonb) returns void language plpgsql set search_path=public as $$declare s adventures;item jsonb;begin
 select * into s from adventures where id=a for update;
 if s.owner_id is distinct from u or s.generating_until>now()
  or (s.status not in ('lobby','paused','completed') and not (s.status='active' and s.ai_mode='chatgpt' and s.draft is null))
 then raise exception 'Only the creator can edit an idle lobby'; end if;
 if s.revision<>r then raise exception 'Lobby changed. Reload before saving'; end if;
 if jsonb_typeof(casts)<>'array' then raise exception 'Invalid players'; end if;
 for item in select * from jsonb_array_elements(casts) loop
  update adventure_players set identity_name=left(coalesce(trim(item->>'name'),''),100),description=left(coalesce(item->>'description',''),2000),
   voice=case when jsonb_typeof(item->'voice')='object' then item->'voice' end,character=null
  where adventure_id=a and user_id=(item->>'user')::uuid;
  if not found then raise exception 'Unknown player'; end if;
 end loop;
 update adventures set title=settings->>'title',world=settings->>'world',voice=settings->'voice',edition=settings->>'edition',design=settings->'design',ai_mode=coalesce(settings->>'ai_mode','api'),revision=revision+1 where id=a;
end $$;
