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
-- limite par le plan (3 en free, illimite en premium - decision du
-- 2026-09-28 : une fois Premium debloque, plus aucun plafond), verifie
-- EN BASE - un appel direct a l'API REST Supabase ne peut donc pas
-- contourner un bouton desactive cote front.
create or replace function public.enforce_habit_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_plan text;
  active_count int;
begin
  if new.archived = false then
    select plan into user_plan from public.profiles where id = new.user_id;

    -- Premium : pas de plafond, on ne compte meme pas les lignes existantes.
    if coalesce(user_plan, 'free') = 'premium' then
      return new;
    end if;

    select count(*) into active_count
    from public.habits
    where user_id = new.user_id
      and archived = false
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if active_count >= 3 then
      raise exception 'Limite de 3 habitudes atteinte pour ton plan (free)'
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

-- ============================================================
-- 6. Migration Stripe (aout 2026) - colonnes pour relier un profil
--    a son client/abonnement Stripe. Remplies par
--    api/stripe-webhook.js une fois le paiement Premium confirme.
--    Sans effet si les colonnes existent deja (deja appliquee en
--    production via SQL Editor).
-- ============================================================

alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;

-- ============================================================
-- 7. Migration refonte (2026-09-28) - archivage auto au retour
--    Premium -> Free, et table d'evenements pour le backtest.
--    Sans effet si deja appliquee.
-- ============================================================

-- 7a. Retour Premium -> Free : on ARCHIVE (jamais on ne supprime) les
--     habitudes au-dela des 3 autorisees en free, en gardant les 3
--     plus anciennes (les plus etablies = les moins disruptives a
--     perdre). L'utilisateur retrouve tout son historique s'il
--     repasse Premium plus tard (rien n'est jamais efface).
create or replace function public.enforce_plan_downgrade()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.plan = 'free' and old.plan = 'premium' then
    update public.habits
    set archived = true
    where user_id = new.id
      and archived = false
      and id not in (
        select id from public.habits
        where user_id = new.id and archived = false
        order by created_at asc
        limit 3
      );
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_plan_downgrade on public.profiles;
create trigger on_profile_plan_downgrade
  after update of plan on public.profiles
  for each row execute procedure public.enforce_plan_downgrade();

-- 7b. Evenements produit (funnel), pour mesurer ce qui marche sans
--     dependre d'un outil tiers. Ecriture seule depuis le client (anon
--     ou authentifie) ; lecture reservee au service role (dashboard
--     Supabase / requetes SQL directes), jamais exposee au front.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  anon_id text,
  name text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "events_insert_anyone"
  on public.events for insert
  with check (true);

create index if not exists events_name_idx on public.events (name);
create index if not exists events_user_id_idx on public.events (user_id);

-- ============================================================
-- 8. Migration refonte dashboard (2026-09-29) - tri manuel des
--    habitudes (glisser-deposer sur /dashboard, cf. habitracker.cc).
--    position : ordre choisi par l'utilisateur, uniquement utilise
--    quand il selectionne le tri "Manuel" (par defaut le tri "Par
--    activite" reste calcule cote client depuis habit_logs, pas
--    besoin de colonne). Nouvelle habitude = position max + 1.
-- ============================================================

alter table public.habits add column if not exists position integer not null default 0;

-- Backfill : position = ordre de creation existant, par utilisateur,
-- pour un tri manuel initial coherent avant le premier reordering.
update public.habits h
set position = sub.rn
from (
  select id, row_number() over (partition by user_id order by created_at asc) as rn
  from public.habits
) sub
where h.id = sub.id and h.position = 0;

-- ============================================================
-- 9. Migration UX (2026-09-29) - note libre par coche + streak
--    freeze (jeton mensuel qui protege un jour manque sans casser
--    le streak). Une coche "freeze" est une ligne habit_logs comme
--    une autre (donc comptee par le calcul de streak cote front,
--    voir streak.js) mais marquee source='freeze' pour ne pas
--    compter dans les celebrations/exports comme une vraie coche,
--    et pour limiter le nombre utilisable par mois (cf. dashboard.js,
--    FREEZE_LIMITS - 1/mois Free, 4/mois Premium, verifie cote
--    front uniquement : pas une regle de securite, juste un confort
--    de motivation, donc pas de trigger dedie).
-- ============================================================

alter table public.habit_logs add column if not exists note text;
alter table public.habit_logs add column if not exists source text not null default 'checkin' check (source in ('checkin', 'freeze'));

-- ============================================================
-- 10. Creation d'habitude plus precise (2026-09-29) - type
--     (habitude classique avec streak vs tracker simple, sans
--     notion de serie a proteger : pas de freeze, badge = total
--     de coches au lieu du streak, cf. dashboard.js/habitDetail.js),
--     description libre, et couleur d'accent personnalisee (accent
--     de la carte + case a cocher, cf. style.css --habit-accent).
-- ============================================================

alter table public.habits add column if not exists type text not null default 'habit' check (type in ('habit', 'tracker'));
alter table public.habits add column if not exists description text;
alter table public.habits add column if not exists color text;

-- ============================================================
-- 11. Dashboard interne (2026-09-29) - la table `events` (section 7b)
--     n'etait lisible que par le service role (Supabase SQL editor).
--     On ouvre la lecture UNIQUEMENT au proprietaire du produit
--     (verifie par email, pas par role, puisqu'il n'y a pas de
--     notion d'admin/role ailleurs dans le schema) pour un dashboard
--     prive /admin/ dans l'app : nombre de vues par page, clics par
--     bouton (voir data-track dans le HTML + assets/js/lib/track.js).
--     Toujours pas expose a un visiteur normal : la policy insert
--     existante (events_insert_anyone) ne change pas.
-- ============================================================

create policy "events_select_owner"
  on public.events for select
  using ((auth.jwt() ->> 'email') = 'raphaeligora@gmail.com');

-- ============================================================
-- 12. Rattrapage inscriptions (2026-10-02) - le trigger
--     on_auth_user_created (section 1) cree deja une ligne profiles
--     a chaque inscription, mais certains comptes plus anciens n'ont
--     jamais ete rattrapes (profil manquant, ou email jamais
--     synchronise). On repare les deux, et on permet au proprietaire
--     de lire tous les profils (jusqu'ici "profiles_select_own" ne
--     laissait chacun voir que le sien) pour pouvoir suivre les
--     nouvelles inscriptions sans repasser par le SQL editor a chaque
--     fois.
-- ============================================================

-- Cree le profil manquant pour tout compte auth.users qui n'en a pas.
insert into public.profiles (id, plan, email, created_at)
select u.id, 'free', u.email, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Resynchronise l'email de tous les profils existants.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email <> u.email);

create policy "profiles_select_owner"
  on public.profiles for select
  using ((auth.jwt() ->> 'email') = 'raphaeligora@gmail.com');
