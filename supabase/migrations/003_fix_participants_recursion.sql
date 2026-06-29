-- Fixes "infinite recursion detected in policy for relation competition_participants".
-- The old SELECT policy queried competition_participants from inside its own policy,
-- which re-triggers RLS evaluation on the same table recursively. A security definer
-- function bypasses RLS for that internal check, breaking the loop.

create function public.is_competition_participant(p_competition_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from public.competition_participants cp
    where cp.competition_id = p_competition_id and cp.user_id = auth.uid()
  );
$$;

drop policy if exists "competition_participants_select_self_or_competition_member_or_admin" on public.competition_participants;

create policy "competition_participants_select_self_or_competition_member_or_admin" on public.competition_participants
  for select using (
    public.is_admin()
    or user_id = auth.uid()
    or public.is_competition_participant(competition_id)
  );

-- group_members_select had the same self-referential subquery bug.
create function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
  );
$$;

drop policy if exists "group_members_select_same_group_or_admin" on public.group_members;

create policy "group_members_select_same_group_or_admin" on public.group_members
  for select using (
    public.is_admin()
    or user_id = auth.uid()
    or public.is_group_member(group_id)
  );
