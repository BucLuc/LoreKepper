-- Chat is one conversation per pair of users (direct chats; old groups stay readable).
-- Messages can reply to another message, carry an adventure invitation, or be written
-- by the AI (rewritten in a voice, or written from the sender's instruction).
alter table public.chat_messages add column kind text not null default 'text' check(kind in ('text','invite'));
-- invite: {adventure, title, theme}; AI: {mode: 'rewrite'|'instruct', voice: name}.
alter table public.chat_messages add column meta jsonb check(meta is null or jsonb_typeof(meta)='object');
alter table public.chat_messages add column reply_to uuid references public.chat_messages(id) on delete set null;
-- When each member last opened the chat, for unread counts.
alter table public.chat_players add column read_at timestamptz not null default now();

-- The chat overview: your conversations (newest first, with the other person, the
-- last message and how many you haven't read) and everyone else you could write to.
create function public.chat_hall(u uuid) returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object(
  'chats',coalesce((select jsonb_agg(x order by coalesce(x->>'last_at',x->>'created_at') desc) from (
   select jsonb_build_object(
    'id',c.id,'kind',c.kind,'title',c.title,'created_at',c.created_at,
    'partner',(select jsonb_build_object('id',p.user_id,'name',p.name) from chat_players p where p.chat_id=c.id and p.user_id<>u order by p.name limit 1),
    'last',(select jsonb_build_object('text',coalesce(m.content,m.original),'kind',m.kind,'from',m.user_id,'at',m.created_at)
      from chat_messages m where m.chat_id=c.id order by m.created_at desc limit 1),
    'last_at',(select max(m.created_at) from chat_messages m where m.chat_id=c.id),
    'unread',(select count(*) from chat_messages m where m.chat_id=c.id and m.user_id<>u and m.created_at>me.read_at)) x
   from chats c join chat_players me on me.chat_id=c.id and me.user_id=u) t),'[]'::jsonb),
  'people',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by lower(name)) from profiles where id<>u),'[]'::jsonb))
$$;
revoke all on function chat_hall(uuid) from public,anon,authenticated;
grant execute on function chat_hall(uuid) to service_role;
