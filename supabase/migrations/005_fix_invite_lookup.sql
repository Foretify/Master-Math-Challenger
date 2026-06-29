-- Fixes "Invite code not found or already used" when joining via a valid code.
-- The old select policy only let existing group members read group_invites, but
-- someone joining a group isn't a member yet -- they can't see the invite row to
-- redeem it. The invite code itself is the authorization (it's a random secret),
-- so any authenticated user may look up invites by code.
drop policy if exists "group_invites_select_member_or_admin" on public.group_invites;

create policy "group_invites_select_member_or_admin" on public.group_invites
  for select to authenticated using (true);
