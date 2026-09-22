-- Slimpossible RLS hardening for Issue #146.
-- Members need challenge metadata, but raw weigh-ins remain participant-only.

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

drop policy if exists challenges_select_owned on public.challenges;
drop policy if exists challenges_select_owned_or_member on public.challenges;

create policy challenges_select_owned_or_member
  on public.challenges for select
  to authenticated
  using (
    owner_id = auth.uid()
    or public.is_challenge_member(id)
  );

create or replace function public.prevent_participant_user_reassignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is distinct from old.user_id
     and exists (
       select 1
       from public.weigh_ins
       where weigh_ins.participant_id = old.id
     ) then
    raise exception using
      errcode = '42501',
      message = 'Participant membership cannot be reassigned after weigh-ins exist.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_participant_user_reassignment() from public;
grant execute on function public.prevent_participant_user_reassignment() to authenticated;

drop trigger if exists prevent_participant_user_reassignment
  on public.participants;

create trigger prevent_participant_user_reassignment
  before update of user_id on public.participants
  for each row
  execute function public.prevent_participant_user_reassignment();
