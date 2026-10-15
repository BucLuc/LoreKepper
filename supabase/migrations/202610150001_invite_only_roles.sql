-- Invite-only access and user roles.
-- Public sign-up is disabled in the Supabase dashboard; new accounts are created
-- by the server (service role) only after a valid collection invitation.

-- Roles: everyone is a member until an admin is set manually.
alter table public.profiles
  add column role text not null default 'member' check (role in ('admin', 'member'));

-- Users may rename themselves, but never change their own role.
revoke update on public.profiles from authenticated;
grant update (name) on public.profiles to authenticated;

create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin')
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Only admins found new collections.
alter policy collections_create on public.collections
  with check (owner_id = (select auth.uid()) and public.is_admin());

-- Shows which collection a still-valid invitation opens (server only).
create function public.invite_preview(token text) returns text language sql stable security definer set search_path=public as $$
  select c.name from invites i join collections c on c.id = i.collection_id
  where i.token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex') and i.expires_at > now()
$$;

-- Adds a freshly registered account to the invited collection (server only).
create function public.redeem_invite(token text, u uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; begin
  select collection_id into cid from invites
  where token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex') and expires_at > now() for share;
  if cid is null then raise exception 'Invitation is invalid, revoked or expired'; end if;
  insert into members values (cid, u) on conflict do nothing;
  return cid;
end $$;

revoke all on function public.invite_preview(text), public.redeem_invite(text, uuid) from public, anon, authenticated;
grant execute on function public.invite_preview(text), public.redeem_invite(text, uuid) to service_role;
