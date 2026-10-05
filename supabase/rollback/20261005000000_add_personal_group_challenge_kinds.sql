-- Guarded rollback for 20261005000000_add_personal_group_challenge_kinds.sql.
-- Revert the application first. This intentionally refuses to remove the
-- personal/group distinction while any personal challenge rows exist.

begin;

do $$
begin
  if exists (
    select 1
    from public.challenges
    where challenge_kind = 'personal'
  ) then
    raise exception
      'Rollback refused: preserve or deliberately retire personal challenges before removing their kind.';
  end if;
end;
$$;

drop trigger if exists prevent_personal_challenge_invites
  on public.challenge_invites;
drop function if exists public.prevent_personal_challenge_invites();

drop policy if exists personal_challenges_limit_participant_insert
  on public.participants;
drop policy if exists personal_challenges_limit_participant_update
  on public.participants;
drop policy if exists personal_challenges_limit_participant_select
  on public.participants;

drop policy if exists challenges_select_owned_or_member on public.challenges;
create policy challenges_select_owned_or_member
  on public.challenges for select
  to authenticated
  using (
    owner_id = auth.uid()
    or public.is_challenge_member(id)
  );

create or replace function public.is_challenge_member(target_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.participants
    where participants.challenge_id = target_challenge_id
      and participants.user_id = auth.uid()
  );
$$;

revoke all on function public.is_challenge_member(uuid) from public;
grant execute on function public.is_challenge_member(uuid) to authenticated;

drop trigger if exists prevent_challenge_kind_change
  on public.challenges;
drop function if exists public.prevent_challenge_kind_change();

alter table public.challenges
  drop constraint if exists challenges_challenge_kind_check,
  drop column if exists challenge_kind;

commit;
