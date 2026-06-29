-- Admin-only RPC to delete a user from auth.users.
-- Deleting the auth user cascades to public.profiles and all child tables
-- (sessions, group_members, questions_log, etc.) via ON DELETE CASCADE.
create function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Permission denied: admins only';
  end if;
  delete from auth.users where id = target_user_id;
end;
$$;
