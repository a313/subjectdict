-- =====================================================================
-- SubjectDict — Supabase schema
-- Chạy trong Supabase Dashboard → SQL Editor (chạy 1 lần), sau đó chạy seed.sql
-- =====================================================================

-- ---------- Bảng ----------
create table if not exists public.subjects (
  id        text primary key,
  name_vi   text not null,
  name_en   text not null,
  color     text not null default '#4361EE',
  sort      int  not null default 0
);

create table if not exists public.topics (
  id         text primary key,
  subject_id text not null references public.subjects(id) on delete cascade,
  name_vi    text not null,
  name_en    text not null,
  sort       int  not null default 0
);

create table if not exists public.terms (
  id          text primary key default gen_random_uuid()::text,
  subject_id  text not null references public.subjects(id) on delete cascade,
  topic_id    text references public.topics(id) on delete set null,
  grade       smallint not null default 6 check (grade between 6 and 9),
  term_en     text not null check (char_length(term_en) between 1 and 120),
  term_vi     text not null check (char_length(term_vi) between 1 and 160),
  ipa         text not null default '',
  pos         text not null default '',
  def_en      text not null default '',
  def_vi      text not null default '',
  example_en  text not null default '',
  example_vi  text not null default '',
  note        text not null default '',
  related     text[] not null default '{}',
  status      text not null default 'published' check (status in ('draft','published')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists terms_subject_idx on public.terms(subject_id);
create index if not exists terms_topic_idx   on public.terms(topic_id);

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  grade        smallint check (grade between 6 and 9),
  school       text,
  role         text not null default 'student' check (role in ('student','admin')),
  created_at   timestamptz not null default now()
);

create table if not exists public.saved_terms (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  term_id    text not null references public.terms(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, term_id)
);

create table if not exists public.quiz_results (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  scope      text not null default '',
  score      int  not null check (score >= 0),
  total      int  not null check (total > 0 and score <= total),
  created_at timestamptz not null default now()
);
create index if not exists quiz_user_idx on public.quiz_results(user_id, created_at desc);

create table if not exists public.search_logs (
  id         bigint generated always as identity primary key,
  query      text not null check (char_length(query) between 1 and 100),
  found      boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists search_logs_time_idx on public.search_logs(created_at desc);

-- ---------- Hàm tiện ích ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Tự tạo profile khi có người đăng kí
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, grade)
  values (
    new.id, new.email,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'grade', '')::smallint
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Chặn người dùng tự nâng quyền / đổi email trong profile
create or replace function public.protect_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role  := old.role;
    new.email := old.email;
  end if;
  if new.id = auth.uid() and old.role = 'admin' and new.role <> 'admin' then
    raise exception 'Không thể tự gỡ quyền admin của chính mình';
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- Tự cập nhật updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists terms_touch on public.terms;
create trigger terms_touch before update on public.terms
  for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ----------
alter table public.subjects     enable row level security;
alter table public.topics       enable row level security;
alter table public.terms        enable row level security;
alter table public.profiles     enable row level security;
alter table public.saved_terms  enable row level security;
alter table public.quiz_results enable row level security;
alter table public.search_logs  enable row level security;

-- subjects / topics: ai cũng đọc, admin ghi
drop policy if exists "subjects read"  on public.subjects;
drop policy if exists "subjects admin" on public.subjects;
create policy "subjects read"  on public.subjects for select using (true);
create policy "subjects admin" on public.subjects for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "topics read"  on public.topics;
drop policy if exists "topics admin" on public.topics;
create policy "topics read"  on public.topics for select using (true);
create policy "topics admin" on public.topics for all using (public.is_admin()) with check (public.is_admin());

-- terms: ai cũng đọc bản đã xuất bản; admin đọc tất cả và ghi
drop policy if exists "terms read"  on public.terms;
drop policy if exists "terms admin" on public.terms;
create policy "terms read"  on public.terms for select using (status = 'published' or public.is_admin());
create policy "terms admin" on public.terms for all using (public.is_admin()) with check (public.is_admin());

-- profiles: xem/sửa của mình; admin xem/sửa tất cả
drop policy if exists "profiles self read"    on public.profiles;
drop policy if exists "profiles self update"  on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles self read"    on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles self update"  on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- saved_terms: chỉ của mình
drop policy if exists "saved own" on public.saved_terms;
create policy "saved own" on public.saved_terms for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- quiz_results: ghi/đọc của mình; admin đọc tất cả
drop policy if exists "quiz own insert" on public.quiz_results;
drop policy if exists "quiz read"       on public.quiz_results;
create policy "quiz own insert" on public.quiz_results for insert with check (user_id = auth.uid());
create policy "quiz read"       on public.quiz_results for select using (user_id = auth.uid() or public.is_admin());

-- search_logs: ai cũng ghi (kể cả chưa đăng nhập); chỉ admin đọc
drop policy if exists "logs insert" on public.search_logs;
drop policy if exists "logs admin"  on public.search_logs;
create policy "logs insert" on public.search_logs for insert with check (true);
create policy "logs admin"  on public.search_logs for select using (public.is_admin());

-- ---------- Quyền cho API ----------
grant usage on schema public to anon, authenticated;
grant select on public.subjects, public.topics, public.terms to anon, authenticated;
grant insert on public.search_logs to anon, authenticated;
grant insert, update, delete on public.subjects, public.topics, public.terms to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.saved_terms to authenticated;
grant select, insert on public.quiz_results to authenticated;
grant select on public.search_logs to authenticated;

-- =====================================================================
-- Sau khi tự đăng kí tài khoản trên website, cấp quyền admin cho chính mình:
--   update public.profiles set role = 'admin' where email = 'email-cua-ban@example.com';
-- =====================================================================
