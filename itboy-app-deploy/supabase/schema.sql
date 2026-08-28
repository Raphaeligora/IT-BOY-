-- IT BOY - Schema Supabase (compte, plans, tracker d'habitudes)
-- A coller integralement dans Supabase -> SQL Editor -> New query -> Run,
-- une fois le projet Supabase cree (voir README.md a la racine du repo).
--
-- Couvre : profiles, quiz_sessions, habits, habit_logs + RLS +
-- application de la limite de plan COTE BASE (pas seulement cote front,
-- comme l'exige prompt-compte-tracker-itboy.md section 5).

create extension if not exists pgcrypto;

-- ============================================================
-- 1. profiles - un profil par utilisateur, plan free/premium
--    email : copie de auth.users.email, tenue a jour par trigger,
--    pour pouvoir contacter chaque inscrit depuis la base sans
--    devoir interroger auth.users (non accessible via l'API REST).
--    onboarded : passe a true par /plans une fois qu'un plan est
--    choisi, pour ne plus jamais renvoyer l'utilisateur vers cet
--    ecran aux connexions suivantes.
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  email text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Creation automatique du profil (plan='free') a l'inscription, avec
-- copie de l'email. C'est la ligne prevue par le spec ("Creer une
-- ligne dans profiles avec plan = 'free' par defaut"), faite cote
-- serveur via trigger - jamais par un insert client, pour eviter
-- qu'un utilisateur choisisse son propre plan a l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, plan, email) values (new.id, 'free', new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Garde profiles.email synchronise si l'utilisateur change son email
-- (confirmation d'un nouvel email cote Supabase Auth).
create or replace function public.sync_user_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute procedure public.sync_user_email();

-- ============================================================
-- 2. quiz_sessions - reponses au quiz + habitudes suggerees
--    Creee de facon anonyme (avant inscription), reliee a un
--    user_id une fois le compte cree.
-- ============================================================

create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  suggested_habit_ids text[] not null default '{}',
  skipped boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.quiz_sessions enable row level security;

-- Insert anonyme autorise (l'id, un UUID v4, sert de secret de session
-- cote client - non enumerable). Aucune donnee sensible n'y est stockee.
create policy "quiz_sessions_insert_anon"
  on public.quiz_sessions for insert
  with check (user_id is null);

create policy "quiz_sessions_select_own_or_anon"
  on public.quiz_sessions for select
  using (user_id is null or auth.uid() = user_id);

-- Permet de relier une session anonyme au compte qui vient d'etre cree.
create policy "quiz_sessions_claim"
  on public.quiz_sessions for update
  using (user_id is null)
  with check (auth.uid() = user_id);

-- ============================================================
-- 3. habits - habitudes actives/archivees d'un utilisateur
-- ============================================================

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly')),
  frequency_per_week int check (frequency_per_week between 1 and 7),
  source text not null default 'custom' check (source in ('quiz', 'custom')),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.habits enable row level security;

create policy "habits_select_own"
  on public.habits for select
  using (auth.uid() = user_id);

create policy "habits_insert_own"
  on public.habits for insert
  with check (auth.uid() = user_id);

create policy "habits_update_own"
  on public.habits for update
  using (auth.uid() = user_id);

create policy "habits_delete_own"
  on public.habits for delete
  using (auth.uid() = user_id);

-- Regle metier critique (spec section 5) : nombre d'habitudes actives
-- limite par le plan (3 en free, 10 en premium), verifie EN BASE - un
-- appel direct a l'API REST Supabase ne peut donc pas contourner un
-- bouton desactive cote front.
create or replace function public.enforce_habit_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_plan text;
  max_habits int;
  active_count int;
begin
  if new.archived = false then
    select plan into user_plan from public.profiles where id = new.user_id;
    max_habits := case when user_plan = 'premium' then 10 else 3 end;

    select count(*) into active_count
    from public.habits
    where user_id = new.user_id
      and archived = false
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if active_count >= max_habits then
      raise exception 'Limite de % habitudes atteinte pour ton plan (%)', max_habits, coalesce(user_plan, 'free')
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists habits_enforce_limit on public.habits;
create trigger habits_enforce_limit
  before insert or update of archived, user_id on public.habits
  for each row execute procedure public.enforce_habit_limit();

-- ============================================================
-- 4. habit_logs - un log = un jour complete pour une habitude
-- ============================================================

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  completed_date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, completed_date)
);

alter table public.habit_logs enable row level security;

create policy "habit_logs_select_own"
  on public.habit_logs for select
  using (auth.uid() = user_id);

create policy "habit_logs_insert_own"
  on public.habit_logs for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
  );

create policy "habit_logs_delete_own"
  on public.habit_logs for delete
  using (auth.uid() = user_id);

create index if not exists habit_logs_habit_id_idx on public.habit_logs (habit_id);
create index if not exists habits_user_id_idx on public.habits (user_id);

-- ============================================================
-- 5. Migration pour un projet Supabase deja provisionne AVANT
--    l'ajout de profiles.email / profiles.onboarded (aout 2026).
--    Sans effet si les colonnes existent deja.
-- ============================================================

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists onboarded boolean not null default false;
update public.profiles p set email = u.email from auth.users u where p.id = u.id and p.email is null;
