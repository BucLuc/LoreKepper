create policy entries_update on public.entries for update to authenticated
  using (creator_id = (select auth.uid()) and public.is_member(collection_id))
  with check (creator_id = (select auth.uid()) and public.is_member(collection_id));
create policy entries_delete on public.entries for delete to authenticated
  using (creator_id = (select auth.uid()) and public.is_member(collection_id));
create function public.entry_identity_immutable() returns trigger
language plpgsql set search_path = public as $$ begin
  if new.id is distinct from old.id or new.collection_id is distinct from old.collection_id
     or new.creator_id is distinct from old.creator_id then
    -- Account deletion may clear attribution via ON DELETE SET NULL.
    if not (new.id = old.id and new.collection_id = old.collection_id and new.creator_id is null) then
      raise exception 'Entry identity and collection cannot be changed';
    end if;
  end if;
  return new;
end $$;
create trigger preserve_entry_identity before update on public.entries
  for each row execute function public.entry_identity_immutable();
