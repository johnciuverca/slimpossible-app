-- Slimpossible secure bearer invitations for challenge membership.
-- The raw token is returned only when an owner creates an invitation. The
-- database stores only its SHA-256 digest and binds acceptance to auth.uid().

create table public.challenge_invites (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  token_hash text not null unique check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenge_invites_expiry_check check (expires_at > created_at),
  constraint challenge_invites_revoked_at_check check (
    revoked_at is null or revoked_at >= created_at
  )
);

create index challenge_invites_challenge_idx
  on public.challenge_invites (challenge_id, created_at desc);

alter table public.challenge_invites enable row level security;

-- Invite metadata and token digests are available only through the narrowly
-- scoped functions below. In particular, clients never receive token_hash.
revoke all on table public.challenge_invites from anon, authenticated;

create or replace function public.create_challenge_invite(
  target_challenge_id uuid,
  target_expires_at timestamptz
)
returns table (
  invite_id uuid,
  challenge_id uuid,
  expires_at timestamptz,
  token text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  raw_token text;
  created_invite_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.challenges
    where challenges.id = target_challenge_id
      and challenges.owner_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Challenge ownership required.';
  end if;

  if target_expires_at <= now()
     or target_expires_at > now() + interval '30 days' then
    raise exception using
      errcode = '22023',
      message = 'Invitation expiry must be in the next 30 days.';
  end if;

  raw_token := encode(gen_random_bytes(32), 'hex');

  insert into public.challenge_invites (
    challenge_id,
    created_by,
    token_hash,
    expires_at
  ) values (
    target_challenge_id,
    auth.uid(),
    encode(digest(raw_token, 'sha256'), 'hex'),
    target_expires_at
  )
  returning id into created_invite_id;

  return query
  select created_invite_id, target_challenge_id, target_expires_at, raw_token;
end;
$$;

revoke all on function public.create_challenge_invite(uuid, timestamptz) from public;
grant execute on function public.create_challenge_invite(uuid, timestamptz) to authenticated;

create or replace function public.preview_challenge_invite(invite_token text)
returns table (
  invite_id uuid,
  challenge_id uuid,
  challenge_name text,
  expires_at timestamptz,
  revoked_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    i.id,
    i.challenge_id,
    c.name,
    i.expires_at,
    i.revoked_at,
    case
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'active'
    end
  from public.challenge_invites as i
  join public.challenges as c on c.id = i.challenge_id
  where i.token_hash = encode(digest(trim(invite_token), 'sha256'), 'hex');
$$;

revoke all on function public.preview_challenge_invite(text) from public;
grant execute on function public.preview_challenge_invite(text) to anon, authenticated;

create or replace function public.list_challenge_invites(target_challenge_id uuid)
returns table (
  invite_id uuid,
  challenge_id uuid,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id, i.challenge_id, i.expires_at, i.revoked_at, i.created_at
  from public.challenge_invites as i
  join public.challenges as c on c.id = i.challenge_id
  where i.challenge_id = target_challenge_id
    and c.owner_id = auth.uid()
  order by i.created_at desc;
$$;

revoke all on function public.list_challenge_invites(uuid) from public;
grant execute on function public.list_challenge_invites(uuid) to authenticated;

create or replace function public.revoke_challenge_invite(target_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed boolean;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  update public.challenge_invites as i
  set revoked_at = coalesce(i.revoked_at, now()),
      updated_at = now()
  where i.id = target_invite_id
    and exists (
      select 1
      from public.challenges as c
      where c.id = i.challenge_id
        and c.owner_id = auth.uid()
    )
  returning true into changed;

  return coalesce(changed, false);
end;
$$;

revoke all on function public.revoke_challenge_invite(uuid) from public;
grant execute on function public.revoke_challenge_invite(uuid) to authenticated;

create or replace function public.accept_challenge_invite(
  invite_token text,
  participant_display_name text,
  participant_starting_weight_kg numeric,
  participant_target_weight_kg numeric
)
returns public.participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invite_row public.challenge_invites%rowtype;
  existing_participant public.participants%rowtype;
  accepted_participant public.participants%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select i.* into invite_row
  from public.challenge_invites as i
  where i.token_hash = encode(digest(trim(invite_token), 'sha256'), 'hex');

  if not found then
    raise exception using errcode = 'P0004', message = 'Invitation is invalid.';
  end if;
  if invite_row.revoked_at is not null then
    raise exception using errcode = 'P0002', message = 'Invitation is revoked.';
  end if;
  if invite_row.expires_at <= now() then
    raise exception using errcode = 'P0003', message = 'Invitation is expired.';
  end if;
  if trim(coalesce(participant_display_name, '')) = '' then
    raise exception using errcode = '22023', message = 'Display name is required.';
  end if;
  if participant_starting_weight_kg is null or participant_starting_weight_kg <= 0
     or participant_target_weight_kg is null or participant_target_weight_kg <= 0 then
    raise exception using errcode = '22023', message = 'Weights must be positive.';
  end if;

  -- Auth profile creation is safe for a newly authenticated account and does
  -- not change an existing profile's display name.
  insert into public.profiles (id, display_name)
  values (auth.uid(), trim(participant_display_name))
  on conflict (id) do nothing;

  select p.* into existing_participant
  from public.participants as p
  where p.challenge_id = invite_row.challenge_id
    and p.user_id = auth.uid();

  if found then
    return existing_participant;
  end if;

  insert into public.participants (
    challenge_id,
    user_id,
    display_name,
    status,
    starting_weight_kg,
    target_weight_kg,
    joined_at
  ) values (
    invite_row.challenge_id,
    auth.uid(),
    trim(participant_display_name),
    'active',
    participant_starting_weight_kg,
    participant_target_weight_kg,
    now()
  )
  on conflict (challenge_id, user_id) do nothing
  returning * into accepted_participant;

  if not found then
    select p.* into accepted_participant
    from public.participants as p
    where p.challenge_id = invite_row.challenge_id
      and p.user_id = auth.uid();
  end if;

  return accepted_participant;
end;
$$;

revoke all on function public.accept_challenge_invite(text, text, numeric, numeric) from public;
grant execute on function public.accept_challenge_invite(text, text, numeric, numeric) to authenticated;

-- Ownership and membership identity are immutable. Owners can manage safe
-- display/progress fields, but neither an owner nor a member may use an update
-- to transfer control or impersonate another Auth profile.
create or replace function public.prevent_challenge_ownership_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.owner_id is distinct from old.owner_id
     or new.created_by is distinct from old.created_by then
    raise exception using
      errcode = '42501',
      message = 'Challenge ownership cannot be changed.';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_challenge_ownership_change() from public;
grant execute on function public.prevent_challenge_ownership_change() to authenticated;

drop trigger if exists prevent_challenge_ownership_change on public.challenges;
create trigger prevent_challenge_ownership_change
  before update of owner_id, created_by on public.challenges
  for each row
  execute function public.prevent_challenge_ownership_change();

create or replace function public.prevent_participant_user_reassignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception using
      errcode = '42501',
      message = 'Participant identity cannot be reassigned.';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_participant_user_reassignment() from public;
grant execute on function public.prevent_participant_user_reassignment() to authenticated;
