-- Fixes "new row violates row-level security policy for table groups" on group creation.
-- Postgres requires an INSERT ... RETURNING row to also pass a SELECT policy. The old
-- select policy only allowed rows visible via group_members, but that membership row
-- is inserted AFTER the group row, so the very first read-back failed RLS.
drop policy if exists "groups_select_member_or_admin" on public.groups;

create policy "groups_select_member_or_admin" on public.groups
  for select using (
    public.is_admin()
    or owner_user_id = auth.uid()
    or public.is_group_member(id)
  );

-- Same insert-then-select-back timing issue applies to competitions: the
-- competition_participants row for the creator is inserted AFTER the
-- competition row, so the first read-back would fail without this.
drop policy if exists "competitions_select_participant_or_group_or_admin" on public.competitions;

create policy "competitions_select_participant_or_group_or_admin" on public.competitions
  for select using (
    public.is_admin()
    or creator_user_id = auth.uid()
    or public.is_competition_participant(id)
    or (group_id is not null and public.is_group_member(group_id))
  );
