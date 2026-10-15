-- Each player may write in their own language/style; null follows the story.
alter table public.adventure_players add column voice jsonb check(voice is null or jsonb_typeof(voice)='object');

-- Finished stories return to the lobby too, so display settings stay editable after the end.
create or replace function public.configure_adventure(a uuid,u uuid,r integer,settings jsonb,casts jsonb) returns void language plpgsql set search_path=public as $$declare s adventures;item jsonb;begin
 select * into s from adventures where id=a for update;
 if s.owner_id is distinct from u or s.status not in ('lobby','paused','completed') or s.generating_until>now() then raise exception 'Only the creator can edit an idle lobby'; end if;
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

-- ChatGPT also sees each player's own language/style.
create or replace function public.mcp_get_roleplay(u uuid,a uuid) returns jsonb language plpgsql stable set search_path=public as $$
declare s adventures;begin
 select * into s from adventures where id=a;
 if s.id is null or s.owner_id is distinct from u then raise exception 'Roleplay not found. Check the session ID and that you are signed in to the Lorekeeper account that owns it.'; end if;
 return jsonb_build_object(
  'story',to_jsonb(s)-'generation_token',
  'players',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'name',name,'identity_name',identity_name,'description',description,'character',character,'voice',voice)),'[]') from adventure_players where adventure_id=a));
end $$;
