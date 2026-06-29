alter table public.competitions
  add column question_count integer not null default 30
  check (question_count between 5 and 100);
