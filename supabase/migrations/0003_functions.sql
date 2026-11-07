-- Trusted server-side helpers (called with the service role only).

create or replace function public.award_xp(p_user uuid, p_amount int, p_coins int, p_reason text, p_session uuid)
returns table (xp int, coins int, level int)
language plpgsql security definer as $$
begin
  if p_amount <> 0 or p_coins <> 0 then
    insert into xp_events(user_id, amount, coins, reason, session_id) values (p_user, p_amount, p_coins, p_reason, p_session);
    update profiles set xp = greatest(profiles.xp + p_amount, 0), coins = greatest(profiles.coins + p_coins, 0), last_active_at = now()
      where id = p_user;
  else
    update profiles set last_active_at = now() where id = p_user;
  end if;
  return query select p.xp, p.coins, level_for_xp(p.xp) from profiles p where p.id = p_user;
end $$;

create or replace function public.record_attempt(p_user uuid, p_question uuid, p_subject text, p_difficulty difficulty, p_qtype question_type, p_correct boolean)
returns int -- previous correct_count for this question (used for repeat multipliers)
language plpgsql security definer as $$
declare prev int := 0;
begin
  if p_question is not null then
    select correct_count into prev from question_attempts where user_id = p_user and question_id = p_question;
    prev := coalesce(prev, 0);
    insert into question_attempts(user_id, question_id, attempts, correct_count, last_correct_at)
      values (p_user, p_question, 1, case when p_correct then 1 else 0 end, case when p_correct then now() else null end)
    on conflict (user_id, question_id) do update
      set attempts = question_attempts.attempts + 1,
          correct_count = question_attempts.correct_count + case when p_correct then 1 else 0 end,
          last_correct_at = case when p_correct then now() else question_attempts.last_correct_at end;
  end if;
  insert into knowledge_state(user_id, subject_id, difficulty, correct, total, streak)
    values (p_user, p_subject, p_difficulty, case when p_correct then 1 else 0 end, 1, case when p_correct then 1 else 0 end)
  on conflict (user_id, subject_id, difficulty) do update
    set correct = knowledge_state.correct + case when p_correct then 1 else 0 end,
        total = knowledge_state.total + 1,
        streak = case when p_correct then knowledge_state.streak + 1 else 0 end,
        updated_at = now();
  insert into format_state(user_id, qtype, correct, total)
    values (p_user, p_qtype, case when p_correct then 1 else 0 end, 1)
  on conflict (user_id, qtype) do update
    set correct = format_state.correct + case when p_correct then 1 else 0 end,
        total = format_state.total + 1,
        updated_at = now();
  return prev;
end $$;

create or replace function public.spend_coins(p_user uuid, p_amount int)
returns boolean language plpgsql security definer as $$
declare ok boolean;
begin
  update profiles set coins = coins - p_amount where id = p_user and coins >= p_amount;
  get diagnostics ok = row_count;
  return ok;
end $$;

-- Streak in days (no penalties: it simply counts consecutive active days ending today or yesterday)
create or replace function public.activity_streak(p_user uuid, p_tz text default 'Europe/Stockholm')
returns int language sql stable as $$
  with days as (
    select distinct (created_at at time zone p_tz)::date as d from xp_events where user_id = p_user
  ), today as (select (now() at time zone p_tz)::date as t),
  numbered as (
    select d, row_number() over (order by d desc) as rn from days
  )
  select coalesce((
    select count(*)::int from numbered, today
    where d = today.t - ((rn - 1)::int) - (case when exists (select 1 from days, today where d = today.t) then 0 else 1 end)
  ), 0)
$$;

-- Weekly leaderboard for one class (aliases only; anonymous when profile is private)
create or replace function public.class_member_week(p_class uuid, p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, alias text, avatar text, xp bigint, is_public boolean)
language sql stable as $$
  select p.id, p.alias, p.avatar, coalesce(sum(e.amount),0) as xp, coalesce((p.settings->>'public_profile')::boolean, true)
  from profiles p left join xp_events e on e.user_id = p.id and e.created_at >= p_from and e.created_at < p_to
  where p.class_id = p_class
  group by p.id order by xp desc
$$;

create or replace function public.national_students(p_from timestamptz, p_to timestamptz, p_limit int)
returns table (user_id uuid, alias text, avatar text, xp bigint, school_name text, class_label text)
language sql stable as $$
  select p.id, p.alias, p.avatar, sum(e.amount) as xp,
         case when coalesce((p.settings->>'show_school')::boolean, true) then s.name else null end,
         case when coalesce((p.settings->>'show_school')::boolean, true) then c.label else null end
  from xp_events e join profiles p on p.id = e.user_id
  left join schools s on s.id = p.school_id left join classes c on c.id = p.class_id
  where e.created_at >= p_from and e.created_at < p_to and coalesce((p.settings->>'public_profile')::boolean, true)
  group by p.id, s.name, c.label order by xp desc limit p_limit
$$;

-- Link AI-generated questions to the material they came from
alter table questions add column if not exists material_id uuid references materials(id) on delete cascade;
create index if not exists questions_material_idx on questions(material_id);

-- Security log → profile link (for admin views) and hot-path indexes
alter table security_events add constraint security_events_user_fk foreign key (user_id) references profiles(id) on delete set null;
create index if not exists security_events_user_kind_idx on security_events(user_id, kind, created_at desc);
create index if not exists xp_events_user_created_idx on xp_events(user_id, created_at desc);
create index if not exists game_sessions_user_mode_idx on game_sessions(user_id, mode, status);
