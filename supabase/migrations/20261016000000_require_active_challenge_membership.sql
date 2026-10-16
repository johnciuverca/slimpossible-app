-- Withdrawn participants must not retain group metadata visibility.
-- Sensitive group RPCs separately require active membership; align the RLS
-- challenge-list helper with that same fail-closed membership definition.

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
      and participant.status = 'active'
      and challenge.challenge_kind is distinct from 'personal'
  );
$$;

revoke all on function public.is_challenge_member(uuid) from public;
grant execute on function public.is_challenge_member(uuid) to authenticated;
