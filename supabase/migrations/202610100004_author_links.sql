-- Run after clearing your current entries, as requested. Auth accounts are preserved.
begin;
alter table public.entries add column author text not null check (length(author) between 1 and 500);
alter table public.entries add column author_user_id uuid references public.profiles(id) on delete set null;
create index entries_unlinked_authors on public.entries(collection_id,author) where author_user_id is null;
create table public.entry_authors (
  collection_id uuid not null,
  entry_id uuid not null,
  message_index integer not null check (message_index >= 0),
  author text not null check (length(author) between 1 and 500),
  user_id uuid references public.profiles(id) on delete set null,
  primary key(entry_id,message_index),
  foreign key(collection_id,entry_id) references public.entries(collection_id,id) on delete cascade
);
create index entry_authors_unlinked on public.entry_authors(collection_id,author) where user_id is null;
alter table public.entry_authors enable row level security;
create policy authors_read on public.entry_authors for select to authenticated using(public.is_member(collection_id));
grant select on public.entry_authors to authenticated;

-- Atomic save: encrypted content and attribution cannot drift apart.
create function public.save_entry(p_id uuid,p_collection uuid,p_payload text,p_authors jsonb,p_update boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare item jsonb; uid uuid; fallback text; first_author text; first_user uuid; n integer := 0;
begin
  if auth.uid() is null or not public.is_member(p_collection) then raise exception 'Collection membership required'; end if;
  if jsonb_typeof(p_authors) <> 'array' or jsonb_array_length(p_authors) = 0 then raise exception 'Each entry needs an author'; end if;
  for item in select value from jsonb_array_elements(p_authors) loop
    uid := nullif(item->>'userId','')::uuid;
    fallback := nullif(trim(item->>'author'),'');
    if uid is not null then
      select profiles.name into fallback from members join profiles on profiles.id=members.user_id
        where members.collection_id=p_collection and members.user_id=uid;
      if fallback is null then raise exception 'Author must be a collection member'; end if;
    end if;
    if fallback is null or length(fallback)>500 then raise exception 'Choose a member or enter an author'; end if;
    if n=0 then first_author := fallback; first_user := uid; end if;
    n := n+1;
  end loop;
  if p_update then
    update entries set payload=p_payload,author=first_author,author_user_id=first_user
      where id=p_id and collection_id=p_collection and creator_id=auth.uid();
    if not found then raise exception 'You can only edit entries you created'; end if;
    delete from entry_authors where entry_id=p_id;
  else
    insert into entries(id,collection_id,creator_id,payload,author,author_user_id)
      values(p_id,p_collection,auth.uid(),p_payload,first_author,first_user);
  end if;
  n := 0;
  for item in select value from jsonb_array_elements(p_authors) loop
    uid := nullif(item->>'userId','')::uuid;
    fallback := nullif(trim(item->>'author'),'');
    if uid is not null then select name into fallback from profiles where id=uid; end if;
    insert into entry_authors values(p_collection,p_id,n,fallback,uid);
    n := n+1;
  end loop;
  return p_id;
end $$;

create function public.save_entries(p_entries jsonb) returns integer
language plpgsql security definer set search_path=public as $$
declare item jsonb; n integer := 0;
begin
  if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries) not between 1 and 500 then
    raise exception 'Save 1–500 entries at a time';
  end if;
  for item in select value from jsonb_array_elements(p_entries) loop
    perform public.save_entry((item->>'id')::uuid,(item->>'collection')::uuid,item->>'payload',item->'authors',false);
    n := n+1;
  end loop;
  return n;
end $$;

-- Links all unlinked occurrences of a name, only inside this collection.
create function public.assign_collection_author(p_collection uuid,p_author text,p_user uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare count_entries integer;
begin
  if not public.is_owner(p_collection) then raise exception 'Only the collection admin can assign authors'; end if;
  if not exists(select 1 from members where collection_id=p_collection and user_id=p_user) then
    raise exception 'Author must be a collection member';
  end if;
  select count(distinct entry_id) into count_entries from entry_authors
    where collection_id=p_collection and author=p_author and user_id is null;
  update entries set author_user_id=p_user where collection_id=p_collection and author=p_author and author_user_id is null;
  update entry_authors set user_id=p_user where collection_id=p_collection and author=p_author and user_id is null;
  return count_entries;
end $$;

-- Rename without decrypting/re-saving the rest of an entry in the browser.
-- Titles remain encrypted, so the API uses save_entry with the original payload.
revoke all on function public.save_entry(uuid,uuid,text,jsonb,boolean), public.save_entries(jsonb), public.assign_collection_author(uuid,text,uuid) from public;
grant execute on function public.save_entry(uuid,uuid,text,jsonb,boolean), public.save_entries(jsonb), public.assign_collection_author(uuid,text,uuid) to authenticated;
-- Require attribution writes through the checked, atomic function.
drop policy entries_create on public.entries;
drop policy entries_update on public.entries;
revoke insert,update on public.entries from authenticated;
drop table public.author_assignments;
commit;
