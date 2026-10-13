-- Issue #265: allow a participant to correct only their own enrollment baseline.
-- This exception does not change target, membership, weigh-ins, shares or milestones.
begin;

create function public.correct_my_enrollment_starting_weight(
  target_challenge_id uuid,
  target_starting_weight_kg numeric
)
returns table (
  challenge_id uuid,
  starting_weight_kg numeric,
  target_weight_kg numeric
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  participant public.participants%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;
  if target_challenge_id is null then
    raise exception using errcode = '22023', message = 'A selected challenge is required.';
  end if;

  select member.* into participant
  from public.participants as member
  join public.challenges as challenge on challenge.id = member.challenge_id
  where member.challenge_id = target_challenge_id
    and member.user_id = actor_id
    and member.status = 'active'
    and (
      challenge.challenge_kind is distinct from 'personal'
      or challenge.owner_id = actor_id
    )
  for update of member;

  if not found then
    raise exception using errcode = '42501',
      message = 'Active enrollment access required.';
  end if;

  if target_starting_weight_kg is null
     or target_starting_weight_kg < 0.01
     or target_starting_weight_kg > 9999.99
     or target_starting_weight_kg <> round(target_starting_weight_kg, 2)
     or target_starting_weight_kg < participant.target_weight_kg then
    raise exception using errcode = '22023',
      message = 'Starting weight must be at least your current target, within the supported range, to two decimal places.';
  end if;

  update public.participants as member
  set starting_weight_kg = target_starting_weight_kg
  where member.id = participant.id
  returning member.challenge_id, member.starting_weight_kg,
    member.target_weight_kg
  into challenge_id, starting_weight_kg, target_weight_kg;

  return next;
end;
$$;

revoke all on function public.correct_my_enrollment_starting_weight(uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.correct_my_enrollment_starting_weight(uuid, numeric)
  to authenticated;

commit;
