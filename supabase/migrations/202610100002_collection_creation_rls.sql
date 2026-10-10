-- INSERT ... RETURNING checks SELECT policies before the AFTER INSERT
-- owner-membership trigger can make the new collection visible.
-- The creator must therefore be readable directly from the inserted row.
alter policy collections_read on public.collections
  using (owner_id = (select auth.uid()) or public.is_member(id));
