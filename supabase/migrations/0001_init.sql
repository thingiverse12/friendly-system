-- KNOWPLAY – initial schema
-- All writes go through trusted server code (service role). Clients only get
-- narrow SELECT access via RLS. XP, coins and scores are never client-writable.

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type difficulty as enum ('easy','medium','hard','expert');
create type question_type as enum ('mcq','tf','fill','numeric','short','match');
create type game_mode as enum ('quick','blackjack','wheel','slots','highstakes','brainrush','daily','lesson','duel');
create type session_status as enum ('active','finished','abandoned','bust');

-- ---------- schools & classes ----------
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  verified boolean not null default false,
  merged_into uuid references schools(id),
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index schools_name_city_idx on schools (lower(name), lower(city)) where merged_into is null;

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  year int not null check (year between 1 and 12), -- 1-9 grundskola, 10-12 gymnasiet
  label text not null,                               -- e.g. "8B"
  join_code text not null unique,
  verified boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index classes_unique_idx on classes (school_id, year, lower(label));

-- ---------- profiles ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  alias text not null unique check (char_length(alias) between 3 and 20),
  avatar text not null default '🦊',
  theme text not null default 'noir',
  xp int not null default 0 check (xp >= 0),
  coins int not null default 0 check (coins >= 0),
  role text not null default 'student' check (role in ('student','teacher','admin')),
  school_id uuid references schools(id) on delete set null,
  class_id uuid references classes(id) on delete set null,
  settings jsonb not null default '{"sound":true,"haptics":true,"animations":true,"preferred_format":"auto","public_profile":true,"show_school":true,"reminders":false}'::jsonb,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);
create index profiles_class_idx on profiles(class_id);
create index profiles_school_idx on profiles(school_id);

-- ---------- curriculum ----------
create table subjects (
  id text primary key,            -- slug
  name text not null,
  icon text not null,
  color text not null,
  sort int not null default 0,
  active boolean not null default true
);

create table chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references subjects(id) on delete cascade,
  year int not null,
  title text not null,
  sort int not null default 0
);
create index chapters_subject_idx on chapters(subject_id);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  title text not null,
  body text not null,
  xp_reward int not null default 15,
  sort int not null default 0
);
create index lessons_chapter_idx on lessons(chapter_id);

create table questions (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references subjects(id) on delete cascade,
  chapter_id uuid references chapters(id) on delete set null,
  difficulty difficulty not null,
  qtype question_type not null,
  prompt text not null,
  options jsonb,                 -- mcq: ["a","b",...]; match: {"left":[],"right":[]}
  answer jsonb not null,         -- SERVER ONLY. mcq: index; tf: bool; fill/short: [accepted strings]; numeric: {"value":n,"tol":x}; match: [idx,...]
  explanation text,
  source text not null default 'verified' check (source in ('verified','ai','generated')),
  owner_id uuid references profiles(id) on delete cascade, -- private AI-generated questions
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index questions_pick_idx on questions(subject_id, difficulty, qtype) where active;
create index questions_owner_idx on questions(owner_id);

-- ---------- game sessions ----------
create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  mode game_mode not null,
  subject_id text references subjects(id),
  difficulty difficulty,
  status session_status not null default 'active',
  competitive boolean not null default false,
  score int not null default 0,
  correct int not null default 0,
  total int not null default 0,
  xp_awarded int not null default 0,
  coins_awarded int not null default 0,
  meta jsonb not null default '{}'::jsonb,  -- server-only state (e.g. blackjack hand, reel results)
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index sessions_user_idx on game_sessions(user_id, created_at desc);
create index sessions_week_idx on game_sessions(created_at) where status = 'finished';

create table session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  idx int not null,
  question_id uuid references questions(id),
  generated jsonb,              -- server-only generated question (brain rush etc.)
  option_order int[],           -- randomized option order served to the client
  served_at timestamptz,
  answered_at timestamptz,
  correct boolean,
  xp int not null default 0,
  response jsonb,
  unique (session_id, idx)
);

-- ---------- progression ----------
create table xp_events (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  amount int not null,
  coins int not null default 0,
  reason text not null,
  session_id uuid references game_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index xp_events_user_idx on xp_events(user_id, created_at desc);
create index xp_events_time_idx on xp_events(created_at);

create table knowledge_state (
  user_id uuid not null references profiles(id) on delete cascade,
  subject_id text not null references subjects(id) on delete cascade,
  difficulty difficulty not null,
  correct int not null default 0,
  total int not null default 0,
  streak int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, subject_id, difficulty)
);

create table format_state (
  user_id uuid not null references profiles(id) on delete cascade,
  qtype question_type not null,
  correct int not null default 0,
  total int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, qtype)
);

create table question_attempts (
  user_id uuid not null references profiles(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  attempts int not null default 0,
  correct_count int not null default 0,
  last_correct_at timestamptz,
  primary key (user_id, question_id)
);

create table lesson_progress (
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table achievements (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null,
  sort int not null default 0
);

create table user_achievements (
  user_id uuid not null references profiles(id) on delete cascade,
  achievement_id text not null references achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table cosmetics (
  id text primary key,
  kind text not null check (kind in ('avatar','theme','frame')),
  name text not null,
  value text not null,
  price int not null default 0,
  min_level int not null default 1,
  sort int not null default 0
);

create table user_cosmetics (
  user_id uuid not null references profiles(id) on delete cascade,
  cosmetic_id text not null references cosmetics(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, cosmetic_id)
);

-- ---------- materials (document import) ----------
create table materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject_id text references subjects(id),
  title text not null,
  raw_text text not null,
  summary text,
  concepts jsonb,
  flashcards jsonb,
  status text not null default 'pending' check (status in ('pending','ready','failed','offline')),
  created_at timestamptz not null default now()
);
create index materials_user_idx on materials(user_id, created_at desc);

-- ---------- duels (async 1v1) ----------
create table duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references profiles(id) on delete cascade,
  opponent_id uuid not null references profiles(id) on delete cascade,
  subject_id text references subjects(id),
  difficulty difficulty not null default 'medium',
  question_ids uuid[] not null,
  challenger_session uuid references game_sessions(id),
  opponent_session uuid references game_sessions(id),
  status text not null default 'pending' check (status in ('pending','active','finished','declined','expired')),
  winner_id uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index duels_users_idx on duels(challenger_id, opponent_id);

-- ---------- security & moderation ----------
create table security_events (
  id bigserial primary key,
  user_id uuid,
  kind text not null,
  severity text not null default 'info' check (severity in ('info','warning','review')),
  details jsonb,
  created_at timestamptz not null default now()
);
create index security_events_time_idx on security_events(created_at desc);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete set null,
  target_type text not null check (target_type in ('school','class','user','question','material','result')),
  target_id text not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolution text,
  created_at timestamptz not null default now()
);

create table app_config (
  key text primary key,
  value jsonb not null
);
insert into app_config(key, value) values
  ('xp_by_difficulty', '{"easy":10,"medium":25,"hard":50,"expert":100}'),
  ('coins_per_xp', '0.2'),
  ('repeat_multipliers', '[1,0.5,0.25,0]'),
  ('class_member_weekly_cap', '1500');

-- ---------- helpers ----------
create or replace function public.level_for_xp(p_xp int) returns int
language sql immutable as $$ select floor(sqrt(greatest(p_xp,0)::numeric / 50))::int + 1 $$;

create or replace function public.rank_for_level(p_level int) returns text
language sql immutable as $$
  select case
    when p_level >= 30 then 'Grandmaster'
    when p_level >= 20 then 'Master'
    when p_level >= 15 then 'Expert'
    when p_level >= 10 then 'Scholar'
    when p_level >= 5 then 'Apprentice'
    else 'Rookie' end
$$;

-- Weekly class score. Normalized so big classes don't win automatically and
-- one student can't carry a class: each member's XP is capped, we take the
-- average over ACTIVE members, then multiply by a participation factor.
create or replace function public.class_week_scores(p_from timestamptz, p_to timestamptz)
returns table (class_id uuid, score numeric, active_members int, total_members int, raw_xp bigint)
language sql stable as $$
  with cap as (select (value::text)::int as v from app_config where key = 'class_member_weekly_cap'),
  member_xp as (
    select p.class_id, p.id as user_id,
           least(coalesce(sum(e.amount),0), (select v from cap)) as capped_xp,
           coalesce(sum(e.amount),0) as xp
    from profiles p
    left join xp_events e on e.user_id = p.id and e.created_at >= p_from and e.created_at < p_to
    where p.class_id is not null
    group by p.class_id, p.id
  )
  select class_id,
         round(coalesce(avg(capped_xp) filter (where capped_xp > 0), 0)
               * (0.5 + 0.5 * (count(*) filter (where capped_xp > 0))::numeric / greatest(count(*),1)), 1) as score,
         (count(*) filter (where capped_xp > 0))::int as active_members,
         count(*)::int as total_members,
         sum(xp)::bigint as raw_xp
  from member_xp
  group by class_id
$$;

create or replace function public.school_week_scores(p_from timestamptz, p_to timestamptz)
returns table (school_id uuid, score numeric, active_classes int)
language sql stable as $$
  select c.school_id,
         round(avg(s.score) * (0.6 + 0.4 * least(count(*),5)::numeric / 5), 1) as score,
         count(*)::int as active_classes
  from class_week_scores(p_from, p_to) s
  join classes c on c.id = s.class_id
  where s.score > 0
  group by c.school_id
$$;

create or replace function public.subject_school_scores(p_subject text, p_from timestamptz, p_to timestamptz)
returns table (school_id uuid, score numeric, players int)
language sql stable as $$
  with per_user as (
    select p.school_id, p.id, least(sum(g.xp_awarded), 1500) as xp
    from game_sessions g join profiles p on p.id = g.user_id
    where g.subject_id = p_subject and g.status = 'finished' and g.created_at >= p_from and g.created_at < p_to
      and p.school_id is not null
    group by p.school_id, p.id
  )
  select school_id, round(avg(xp) * (0.5 + 0.5 * least(count(*),10)::numeric / 10), 1), count(*)::int
  from per_user group by school_id
$$;

-- ---------- RLS ----------
alter table schools enable row level security;
alter table classes enable row level security;
alter table profiles enable row level security;
alter table subjects enable row level security;
alter table chapters enable row level security;
alter table lessons enable row level security;
alter table questions enable row level security;
alter table game_sessions enable row level security;
alter table session_items enable row level security;
alter table xp_events enable row level security;
alter table knowledge_state enable row level security;
alter table format_state enable row level security;
alter table question_attempts enable row level security;
alter table lesson_progress enable row level security;
alter table achievements enable row level security;
alter table user_achievements enable row level security;
alter table cosmetics enable row level security;
alter table user_cosmetics enable row level security;
alter table materials enable row level security;
alter table duels enable row level security;
alter table security_events enable row level security;
alter table reports enable row level security;
alter table app_config enable row level security;

-- Public reference data
create policy "public read subjects" on subjects for select using (true);
create policy "public read chapters" on chapters for select using (true);
create policy "public read lessons" on lessons for select using (true);
create policy "public read achievements" on achievements for select using (true);
create policy "public read cosmetics" on cosmetics for select using (true);
create policy "public read schools" on schools for select using (true);
-- Own data (read only; writes happen server-side with the service role)
create policy "own profile" on profiles for select using (auth.uid() = id);
create policy "own sessions" on game_sessions for select using (auth.uid() = user_id);
create policy "own xp" on xp_events for select using (auth.uid() = user_id);
create policy "own knowledge" on knowledge_state for select using (auth.uid() = user_id);
create policy "own formats" on format_state for select using (auth.uid() = user_id);
create policy "own lesson progress" on lesson_progress for select using (auth.uid() = user_id);
create policy "own achievements" on user_achievements for select using (auth.uid() = user_id);
create policy "own cosmetics" on user_cosmetics for select using (auth.uid() = user_id);
create policy "own materials" on materials for select using (auth.uid() = user_id);
create policy "own duels" on duels for select using (auth.uid() in (challenger_id, opponent_id));
-- questions: never expose the answer column to clients. No client policy at all.
-- session_items, security_events, reports, app_config, question_attempts: server only.
