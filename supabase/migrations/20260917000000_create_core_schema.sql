-- Slimpossible core schema.
-- Authentication integration and row-level security are intentionally deferred.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  start_date date not null,
  end_date date not null,
  target_weight_kg numeric(6, 2),
  status text not null default 'draft' check (
    status in ('draft', 'active', 'completed', 'archived')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenges_date_range_check check (end_date >= start_date),
  constraint challenges_target_weight_check check (
    target_weight_kg is null or target_weight_kg > 0
  )
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  display_name text not null check (char_length(trim(display_name)) > 0),
  status text not null default 'invited' check (
    status in ('invited', 'active', 'completed', 'withdrawn')
  ),
  starting_weight_kg numeric(6, 2) not null check (starting_weight_kg > 0),
  target_weight_kg numeric(6, 2) not null check (
    target_weight_kg > 0 and target_weight_kg <= starting_weight_kg
  ),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participants_joined_at_check check (
    status = 'invited' or joined_at is not null
  ),
  constraint participants_challenge_user_unique unique (challenge_id, user_id)
);

create table public.weigh_ins (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  recorded_date date not null,
  weight_kg numeric(6, 2) not null check (weight_kg > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weigh_ins_participant_date_unique unique (participant_id, recorded_date)
);

create index challenges_owner_id_idx on public.challenges (owner_id);

create index participants_challenge_status_idx
  on public.participants (challenge_id, status);

create index participants_user_id_idx on public.participants (user_id);

create index weigh_ins_participant_date_desc_idx
  on public.weigh_ins (participant_id, recorded_date desc);

create index weigh_ins_recorded_date_participant_idx
  on public.weigh_ins (recorded_date, participant_id);
