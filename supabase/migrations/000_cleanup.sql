-- Run this FIRST if you need to reset a partially-applied migration attempt.
drop function if exists public.get_leaderboard(uuid);
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.is_admin() cascade;

drop table if exists public.questions_log cascade;
drop table if exists public.sessions cascade;
drop table if exists public.competition_participants cascade;
drop table if exists public.competitions cascade;
drop table if exists public.group_invites cascade;
drop table if exists public.group_members cascade;
drop table if exists public.groups cascade;
drop table if exists public.activity_log cascade;
drop table if exists public.profiles cascade;
