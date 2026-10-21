-- Add an explicit, optional challenge kind without rewriting existing rows.
-- NULL is the legacy-group representation; new app-created rows set a kind.
--
-- Rollback notes: revert the application first. Do not remove this column
-- while personal challenge rows exist, because their privacy classification
-- would be lost. Preserve or deliberately retire those rows after owner review,
-- then follow the guarded rollback notes in the matching supabase/rollback file.

alter table public.challenges
  add column challenge_kind text,
  add constraint challenges_challenge_kind_check
    check (challenge_kind is null or challenge_kind in ('personal', 'group'));

comment on column public.challenges.challenge_kind is
  'Personal challenges are owner-private; NULL represents a pre-16.1 group challenge.';

-- Challenge membership grants read access only to group/legacy challenges.
-- SECURITY DEFINER avoids the challenge RLS policy hiding a personal row from
-- this membership check and thereby accidentally treating it as a group.
create or replace function public.is_challenge_member(target_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.participants as participant
    join public.challenges as challenge
      on challenge.id = participant.challenge_id
    where participant.challenge_id = target_challenge_id
      and participant.user_id = auth.uid()
      and challenge.challenge_kind is distinct from 'personal'
  );
$$;

revoke all on function public.is_challenge_member(uuid) from public;
grant execute on function public.is_challenge_member(uuid) to authenticated;

-- Membership grants challenge metadata access only for group/legacy contexts.
-- A personal challenge is visible only to its owner, even if an unexpected
-- participant row is present.
drop policy if exists challenges_select_owned_or_member on public.challenges;

create policy challenges_select_owned_or_member
  on public.challenges for select
  to authenticated
  using (
    owner_id = auth.uid()
    or (
      challenge_kind is distinct from 'personal'
      and public.is_challenge_member(id)
    )
  );

-- Keep the challenge kind stable so an existing group (and its memberships)
-- cannot be silently converted into a private personal challenge, or vice versa.
create or replace function public.prevent_challenge_kind_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.challenge_kind is distinct from old.challenge_kind then
    raise exception using
      errcode = '42501',
      message = 'Challenge kind cannot be changed after creation.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_challenge_kind_change() from public;

create trigger prevent_challenge_kind_change
  before update of challenge_kind on public.challenges
  for each row
  execute function public.prevent_challenge_kind_change();

-- Existing owner-management policies remain permissive; these restrictive
-- policies add an AND guard so personal challenges can only ever have the
-- owner as a participant. Group membership behavior is unchanged.
create policy personal_challenges_limit_participant_insert
  on public.participants as restrictive
  for insert to authenticated
  with check (
    not exists (
      select 1
      from public.challenges as challenge
      where challenge.id = participants.challenge_id
        and challenge.challenge_kind = 'personal'
        and participants.user_id <> auth.uid()
    )
  );

create policy personal_challenges_limit_participant_update
  on public.participants as restrictive
  for update to authenticated
  using (
    not exists (
      select 1
      from public.challenges as challenge
      where challenge.id = participants.challenge_id
        and challenge.challenge_kind = 'personal'
        and participants.user_id <> auth.uid()
    )
  )
  with check (
    not exists (
      select 1
      from public.challenges as challenge
      where challenge.id = participants.challenge_id
        and challenge.challenge_kind = 'personal'
        and participants.user_id <> auth.uid()
    )
  );

create policy personal_challenges_limit_participant_select
  on public.participants as restrictive
  for select to authenticated
  using (
    participants.user_id <> auth.uid()
    or public.is_challenge_member(participants.challenge_id)
    or exists (
      select 1
      from public.challenges as challenge
      where challenge.id = participants.challenge_id
        and challenge.owner_id = auth.uid()
    )
  );

-- SECURITY DEFINER invite functions still pass through this trigger. Since
-- challenge kinds are immutable, a personal challenge cannot gain invite links.
create or replace function public.prevent_personal_challenge_invites()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.challenges as challenge
    where challenge.id = new.challenge_id
      and challenge.challenge_kind = 'personal'
  ) then
    raise exception using
      errcode = '42501',
      message = 'Personal challenges cannot have group invitations.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_personal_challenge_invites() from public;

create trigger prevent_personal_challenge_invites
  before insert or update of challenge_id on public.challenge_invites
  for each row
  execute function public.prevent_personal_challenge_invites();
