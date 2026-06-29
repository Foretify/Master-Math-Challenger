-- App-wide leaderboard RPC
-- Returns aggregated stats for every user who has completed at least one session.
-- Uses security definer so it can read all sessions while only exposing aggregated data.
-- Requires the caller to be authenticated (auth.uid() is not null).

create function public.get_app_leaderboard()
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
    sum(s.correct_count)          as total_correct,
    count(*)                      as session_count,
    avg(s.avg_time_per_question)  as avg_time
  from public.sessions s
  join public.profiles p on p.id = s.user_id
  where auth.uid() is not null
  group by s.user_id, p.display_name;
$$;
