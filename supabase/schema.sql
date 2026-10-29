-- =====================================================================
-- İnformatika LMS — Supabase sxemi
-- Supabase Dashboard → SQL Editor → bu faylın hamısını yapışdırıb "Run" edin.
-- Fayl təkrar işlədilə bilər (idempotent).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- CƏDVƏLLƏR
-- ---------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  login text unique not null,
  role text not null default 'student' check (role in ('admin', 'student')),
  group_id uuid references public.groups(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  topic text,
  file_path text not null unique,
  page_count int,
  created_at timestamptz not null default now()
);

create table if not exists public.material_groups (
  material_id uuid not null references public.materials(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (material_id, group_id)
);

create table if not exists public.material_views (
  user_id uuid not null references public.profiles(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  seconds int not null default 0,
  pages int[] not null default '{}',
  last_page int,
  page_count int,
  first_opened timestamptz not null default now(),
  last_opened timestamptz not null default now(),
  primary key (user_id, material_id)
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  topic text,
  time_limit_min int check (time_limit_min is null or time_limit_min > 0),
  max_attempts int default 1 check (max_attempts is null or max_attempts > 0),
  questions_per_attempt int check (questions_per_attempt is null or questions_per_attempt > 0),
  shuffle_questions boolean not null default true,
  shuffle_options boolean not null default true,
  show_answers boolean not null default true,
  opens_at timestamptz,
  closes_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.test_groups (
  test_id uuid not null references public.tests(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (test_id, group_id)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  position int not null default 0,
  text text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  correct int not null check (correct >= 0),
  explanation text,
  topic text,
  created_at timestamptz not null default now()
);
create index if not exists questions_test_idx on public.questions(test_id, position);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  question_ids uuid[] not null,
  answers jsonb not null default '{}',
  score int,
  total int,
  tab_switches int not null default 0
);
create index if not exists attempts_test_idx on public.attempts(test_id);
create index if not exists attempts_user_idx on public.attempts(user_id);

-- ---------------------------------------------------------------------
-- KÖMƏKÇİ FUNKSİYALAR
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_group() returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.material_groups enable row level security;
alter table public.material_views enable row level security;
alter table public.tests enable row level security;
alter table public.test_groups enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;

do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- groups
create policy groups_read on public.groups for select to authenticated using (true);
create policy groups_admin on public.groups for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles: tələbə yalnız özünü görür, admin hamını
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_admin on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- materials
create policy materials_read on public.materials for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.material_groups mg where mg.material_id = materials.id and mg.group_id = public.my_group()
  )
);
create policy materials_admin on public.materials for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy material_groups_read on public.material_groups for select to authenticated using (public.is_admin() or group_id = public.my_group());
create policy material_groups_admin on public.material_groups for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- material_views: yazma yalnız track_reading funksiyası ilə
create policy material_views_read on public.material_views for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy material_views_admin on public.material_views for delete to authenticated using (public.is_admin());

-- tests
create policy tests_read on public.tests for select to authenticated using (
  public.is_admin() or (published and exists (
    select 1 from public.test_groups tg where tg.test_id = tests.id and tg.group_id = public.my_group()
  ))
);
create policy tests_admin on public.tests for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy test_groups_read on public.test_groups for select to authenticated using (public.is_admin() or group_id = public.my_group());
create policy test_groups_admin on public.test_groups for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- questions: tələbələr birbaşa oxuya bilmir (düzgün cavab gizli qalır)
create policy questions_admin on public.questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- attempts: yazma yalnız funksiyalarla
create policy attempts_read on public.attempts for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy attempts_admin_delete on public.attempts for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- TEST FUNKSİYALARI (qiymətləndirmə serverdə aparılır)
-- ---------------------------------------------------------------------
create or replace function public.grade_attempt(p_attempt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_score int; v_total int;
begin
  select count(*) filter (where (a.answers ->> q.id::text)::int = q.correct), count(*)
    into v_score, v_total
  from public.attempts a
  cross join lateral unnest(a.question_ids) as u(qid)
  join public.questions q on q.id = u.qid
  where a.id = p_attempt;

  update public.attempts
     set score = coalesce(v_score, 0), total = coalesce(v_total, 0), finished_at = coalesce(finished_at, now())
   where id = p_attempt;
end $$;
revoke execute on function public.grade_attempt(uuid) from public, anon, authenticated;

create or replace function public.attempt_expired(p_attempt uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    t.time_limit_min is not null and now() > a.started_at + make_interval(mins => t.time_limit_min) + interval '1 minute',
    false)
  from public.attempts a join public.tests t on t.id = a.test_id
  where a.id = p_attempt;
$$;
revoke execute on function public.attempt_expired(uuid) from public, anon, authenticated;

create or replace function public.start_attempt(p_test uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t public.tests;
  v_uid uuid := auth.uid();
  v_att public.attempts;
  v_used int;
  v_ids uuid[];
  r record;
begin
  if v_uid is null then raise exception 'Sistemə daxil olmaq lazımdır'; end if;

  select * into t from public.tests where id = p_test;
  if not found or not t.published then raise exception 'Test tapılmadı'; end if;
  if not public.is_admin() and not exists (
    select 1 from public.test_groups where test_id = p_test and group_id = public.my_group()
  ) then raise exception 'Bu test sizin qrupa təyin edilməyib'; end if;

  -- vaxtı keçmiş, bitirilməmiş cəhdləri yekunlaşdır
  for r in select id from public.attempts
            where test_id = p_test and user_id = v_uid and finished_at is null loop
    if public.attempt_expired(r.id) then perform public.grade_attempt(r.id); end if;
  end loop;

  select * into v_att from public.attempts
   where test_id = p_test and user_id = v_uid and finished_at is null
   order by started_at desc limit 1;

  if not found then
    if t.opens_at is not null and now() < t.opens_at then raise exception 'Test hələ açılmayıb'; end if;
    if t.closes_at is not null and now() > t.closes_at then raise exception 'Testin vaxtı bitib'; end if;

    select count(*) into v_used from public.attempts where test_id = p_test and user_id = v_uid;
    if t.max_attempts is not null and v_used >= t.max_attempts then
      raise exception 'Cəhd limitiniz bitib';
    end if;

    select array_agg(s.id order by case when t.shuffle_questions then random() else s.position::float8 end)
      into v_ids
      from (select id, position from public.questions where test_id = p_test
             order by random() limit coalesce(t.questions_per_attempt, 100000)) s;

    if v_ids is null then raise exception 'Bu testdə hələ sual yoxdur'; end if;

    insert into public.attempts (test_id, user_id, question_ids)
    values (p_test, v_uid, v_ids) returning * into v_att;
  end if;

  return jsonb_build_object(
    'attempt_id', v_att.id,
    'title', t.title,
    'started_at', v_att.started_at,
    'server_now', now(),
    'time_limit_min', t.time_limit_min,
    'shuffle_options', t.shuffle_options,
    'answers', v_att.answers,
    'tab_switches', v_att.tab_switches,
    'questions', (
      select jsonb_agg(jsonb_build_object('id', q.id, 'text', q.text, 'options', q.options) order by u.ord)
      from unnest(v_att.question_ids) with ordinality as u(qid, ord)
      join public.questions q on q.id = u.qid
    )
  );
end $$;

create or replace function public.save_answers(p_attempt uuid, p_answers jsonb, p_tab_switches int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.attempt_expired(p_attempt) then return; end if;
  update public.attempts
     set answers = coalesce(p_answers, '{}'::jsonb),
         tab_switches = greatest(tab_switches, coalesce(p_tab_switches, 0))
   where id = p_attempt and user_id = auth.uid() and finished_at is null;
end $$;

create or replace function public.submit_attempt(p_attempt uuid, p_answers jsonb, p_tab_switches int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.attempts;
begin
  select * into a from public.attempts where id = p_attempt and user_id = auth.uid();
  if not found then raise exception 'Cəhd tapılmadı'; end if;

  if a.finished_at is null then
    if not public.attempt_expired(p_attempt) then
      update public.attempts set answers = coalesce(p_answers, '{}'::jsonb) where id = p_attempt;
    end if;
    update public.attempts set tab_switches = greatest(tab_switches, coalesce(p_tab_switches, 0)) where id = p_attempt;
    perform public.grade_attempt(p_attempt);
  end if;

  select * into a from public.attempts where id = p_attempt;
  return jsonb_build_object('score', a.score, 'total', a.total);
end $$;

create or replace function public.get_attempt_review(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.attempts; t public.tests; v_admin boolean := public.is_admin(); v_name text;
begin
  select * into a from public.attempts where id = p_attempt;
  if not found or (a.user_id <> auth.uid() and not v_admin) then raise exception 'Cəhd tapılmadı'; end if;
  if a.finished_at is null then raise exception 'Test hələ bitirilməyib'; end if;
  select * into t from public.tests where id = a.test_id;
  select full_name into v_name from public.profiles where id = a.user_id;

  return jsonb_build_object(
    'attempt_id', a.id, 'title', t.title, 'student', v_name,
    'score', a.score, 'total', a.total,
    'started_at', a.started_at, 'finished_at', a.finished_at, 'tab_switches', a.tab_switches,
    'show_answers', (t.show_answers or v_admin),
    'questions', case when t.show_answers or v_admin then (
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'text', q.text, 'options', q.options, 'correct', q.correct,
        'chosen', (a.answers ->> q.id::text)::int, 'explanation', q.explanation
      ) order by u.ord)
      from unnest(a.question_ids) with ordinality as u(qid, ord)
      join public.questions q on q.id = u.qid
    ) else null end
  );
end $$;

-- ---------------------------------------------------------------------
-- OXUMA STATİSTİKASI
-- ---------------------------------------------------------------------
create or replace function public.track_reading(p_material uuid, p_page int, p_seconds int, p_page_count int) returns void
language plpgsql security definer set search_path = public as $$
declare v_sec int := least(greatest(coalesce(p_seconds, 0), 0), 60);
begin
  if auth.uid() is null or public.is_admin() then return; end if;
  if not exists (select 1 from public.material_groups where material_id = p_material and group_id = public.my_group()) then
    return;
  end if;

  insert into public.material_views (user_id, material_id, seconds, pages, last_page, page_count)
  values (auth.uid(), p_material, v_sec,
          case when p_page is null then '{}'::int[] else array[p_page] end, p_page, p_page_count)
  on conflict (user_id, material_id) do update set
    seconds = material_views.seconds + v_sec,
    pages = case when p_page is null or p_page = any(material_views.pages) then material_views.pages
                 else array_append(material_views.pages, p_page) end,
    last_page = coalesce(p_page, material_views.last_page),
    page_count = coalesce(p_page_count, material_views.page_count),
    last_opened = now();
end $$;

grant execute on function public.start_attempt(uuid) to authenticated;
grant execute on function public.save_answers(uuid, jsonb, int) to authenticated;
grant execute on function public.submit_attempt(uuid, jsonb, int) to authenticated;
grant execute on function public.get_attempt_review(uuid) to authenticated;
grant execute on function public.track_reading(uuid, int, int, int) to authenticated;

-- ---------------------------------------------------------------------
-- FAYL SAXLAMA (PDF-lər üçün gizli bucket)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "materials_admin_all" on storage.objects;
drop policy if exists "materials_student_read" on storage.objects;

create policy "materials_admin_all" on storage.objects for all to authenticated
  using (bucket_id = 'materials' and public.is_admin())
  with check (bucket_id = 'materials' and public.is_admin());

create policy "materials_student_read" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and exists (
    select 1 from public.materials m
    join public.material_groups mg on mg.material_id = m.id
    where m.file_path = storage.objects.name and mg.group_id = public.my_group()
  ));
