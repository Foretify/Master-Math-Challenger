-- Allow any signed-in user to see other users' basic profile info (display name, email).
-- Needed because the app shows group member names, competition participant pickers,
-- and group ownership — all require reading OTHER users' profiles, not just your own.
-- Fine for a small family/group app; tighten later if privacy needs grow.
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
