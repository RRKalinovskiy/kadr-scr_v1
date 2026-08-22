-- ============================================================
-- КАДР · скрин-сборки автотестов — схема Supabase (PostgreSQL)
-- Применить в Supabase SQL Editor или `supabase db push`.
-- Аутентификация: встроенная supabase.auth (регистрация/логин/сессии).
-- ============================================================

-- Профили пользователей (1:1 с auth.users, расширяют их)
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  account_id uuid not null,
  email      text not null,
  name       text not null default '',
  role       text not null default 'owner' check (role in ('owner','qa','dev','viewer')),
  created_at timestamptz not null default now()
);

-- Состояние рабочего места: коллекции, тесты, дерево сценариев, настройки.
-- Хранится единым JSONB-документом на аккаунт (та же форма, что и в localStorage).
create table if not exists public.account_state (
  account_id uuid primary key,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Эталонные скриншоты и снимки прогонов (по тесту)
create table if not exists public.baselines (
  test_id    text primary key,
  account_id uuid not null,
  image      text not null,          -- dataURL
  updated_at timestamptz not null default now()
);

create table if not exists public.run_shots (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  test_id    text not null,
  run_id     text not null,
  base       text,
  result     text,
  diff       text,
  created_at timestamptz not null default now(),
  unique (test_id, run_id)
);

-- ------------------------------------------------------------
-- Автоматика: при регистрации создаём профиль + рабочее место
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, account_id, email, name)
  values (new.id, new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.account_state (account_id, state)
  values (new.id, '{}'::jsonb)
  on conflict (account_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Row Level Security: каждый видит только своё рабочее место
-- ------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.account_state enable row level security;
alter table public.baselines     enable row level security;
alter table public.run_shots     enable row level security;

create policy "profiles: своё рабочее место"
  on public.profiles for all
  using (account_id = auth.uid()) with check (account_id = auth.uid());

create policy "account_state: своё рабочее место"
  on public.account_state for all
  using (account_id = auth.uid()) with check (account_id = auth.uid());

create policy "baselines: своё рабочее место"
  on public.baselines for all
  using (account_id = auth.uid()) with check (account_id = auth.uid());

create policy "run_shots: своё рабочее место"
  on public.run_shots for all
  using (account_id = auth.uid()) with check (account_id = auth.uid());

create index if not exists idx_run_shots_test on public.run_shots (test_id);
