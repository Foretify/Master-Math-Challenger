-- Master Math Challenger: initial schema, RLS, triggers
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  age_or_grade text,
  avatar text default '',
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, age_or_grade)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'age_or_grade'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ groups ============
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  code text not null unique,
  created_by_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  accepted_by_user_id uuid references public.profiles(id)
);

-- ============ competitions ============
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete set null,
  creator_user_id uuid not null references public.profiles(id),
  name text not null,
  start_date timestamptz not null,
  end_date timestamptz,
  scoring_rule text not null default 'total_correct_time_tiebreak',
  visibility text not null check (visibility in ('group-public','invite-only')),
  created_at timestamptz not null default now()
);

create table public.competition_participants (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (competition_id, user_id)
);

-- ============ sessions / questions_log ============
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  competition_id uuid references public.competitions(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  total_questions integer not null,
  correct_count integer not null,
  accuracy_percent numeric not null,
  avg_time_per_question numeric not null,
  difficulty_level_reached integer not null,
  total_session_duration_ms bigint not null
);

create table public.questions_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  factor_a integer not null,
  factor_b integer not null,
  correct_answer integer not null,
  user_answer integer,
  is_correct boolean not null,
  time_taken_ms bigint not null,
  difficulty_level_at_time integer not null,
  answered_at timestamptz not null
);

-- ============ activity_log (admin visibility) ============
create table public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_log_user_id_idx on public.activity_log(user_id);
create index activity_log_created_at_idx on public.activity_log(created_at desc);

-- ============ is_admin helper ============
create function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ============ enable RLS ============
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_participants enable row level security;
alter table public.sessions enable row level security;
alter table public.questions_log enable row level security;
alter table public.activity_log enable row level security;

-- ============ profiles policies ============
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- ============ groups policies ============
create policy "groups_select_member_or_admin" on public.groups
  for select using (
    public.is_admin()
    or exists (select 1 from public.group_members gm where gm.group_id = id and gm.user_id = auth.uid())
  );

create policy "groups_insert_owner" on public.groups
  for insert with check (owner_user_id = auth.uid());

create policy "groups_update_owner_or_admin" on public.groups
  for update using (owner_user_id = auth.uid() or public.is_admin());

create policy "groups_delete_owner_or_admin" on public.groups
  for delete using (owner_user_id = auth.uid() or public.is_admin());

-- ============ group_members policies ============
create policy "group_members_select_same_group_or_admin" on public.group_members
  for select using (
    public.is_admin()
    or exists (select 1 from public.group_members gm2 where gm2.group_id = group_id and gm2.user_id = auth.uid())
  );

create policy "group_members_insert_self_or_owner_or_admin" on public.group_members
  for insert with check (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_user_id = auth.uid())
  );

create policy "group_members_delete_self_or_owner_or_admin" on public.group_members
  for delete using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_user_id = auth.uid())
  );

-- ============ group_invites policies ============
create policy "group_invites_select_member_or_admin" on public.group_invites
  for select using (
    public.is_admin()
    or exists (select 1 from public.group_members gm where gm.group_id = group_id and gm.user_id = auth.uid())
  );

create policy "group_invites_insert_member_or_admin" on public.group_invites
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.group_members gm where gm.group_id = group_id and gm.user_id = auth.uid())
  );

create policy "group_invites_update_accept_or_admin" on public.group_invites
  for update using (true);

-- ============ competitions policies ============
create policy "competitions_select_participant_or_group_or_admin" on public.competitions
  for select using (
    public.is_admin()
    or exists (select 1 from public.competition_participants cp where cp.competition_id = id and cp.user_id = auth.uid())
    or (group_id is not null and exists (select 1 from public.group_members gm where gm.group_id = competitions.group_id and gm.user_id = auth.uid()))
  );

create policy "competitions_insert_creator" on public.competitions
  for insert with check (creator_user_id = auth.uid());

create policy "competitions_update_creator_or_admin" on public.competitions
  for update using (creator_user_id = auth.uid() or public.is_admin());

create policy "competitions_delete_creator_or_admin" on public.competitions
  for delete using (creator_user_id = auth.uid() or public.is_admin());

-- ============ competition_participants policies ============
create policy "competition_participants_select_self_or_competition_member_or_admin" on public.competition_participants
  for select using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (select 1 from public.competition_participants cp2 where cp2.competition_id = competition_id and cp2.user_id = auth.uid())
  );

create policy "competition_participants_insert_self_or_creator_or_admin" on public.competition_participants
  for insert with check (
    public.is_admin()
    or user_id = auth.uid()
    or exists (select 1 from public.competitions c where c.id = competition_id and c.creator_user_id = auth.uid())
  );

-- ============ sessions policies ============
create policy "sessions_select_own_or_admin" on public.sessions
  for select using (user_id = auth.uid() or public.is_admin());

create policy "sessions_insert_own" on public.sessions
  for insert with check (user_id = auth.uid());

-- ============ questions_log policies ============
create policy "questions_log_select_via_session_or_admin" on public.questions_log
  for select using (
    public.is_admin()
    or exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create policy "questions_log_insert_via_session" on public.questions_log
  for insert with check (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- ============ activity_log policies ============
create policy "activity_log_insert_self_or_system" on public.activity_log
  for insert with check (user_id = auth.uid() or user_id is null);

create policy "activity_log_select_admin_only" on public.activity_log
  for select using (public.is_admin());

-- ============ leaderboard RPC (bypasses sessions RLS safely, aggregated only) ============
create function public.get_leaderboard(p_competition_id uuid)
returns table (
  user_id uuid,
  display_name text,
  total_correct bigint,
  session_count bigint,
  avg_time numeric
)
language sql
security definer
stable
as $$
  select
    s.user_id,
    p.display_name,
    sum(s.correct_count) as total_correct,
    count(*) as session_count,
    avg(s.avg_time_per_question) as avg_time
  from public.sessions s
  join public.profiles p on p.id = s.user_id
  where s.competition_id = p_competition_id
    and exists (
      select 1 from public.competition_participants cp
      where cp.competition_id = p_competition_id and cp.user_id = auth.uid()
    )
  group by s.user_id, p.display_name;
$$;
