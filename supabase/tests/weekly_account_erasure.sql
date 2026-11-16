-- Disposable local database only. Never run against staging or production.
\set ON_ERROR_STOP on

insert into auth.users(id, created_at) values
  ('00000000-0000-4000-8000-000000000006', now())
on conflict (id) do nothing;
insert into public.profiles(id, display_name) values
  ('00000000-0000-4000-8000-000000000006', 'Account Erasure Secret Name')
on conflict (id) do nothing;

do $$
declare
  target_challenge constant uuid := '40400000-0000-4000-8000-000000000100';
  target_participant constant uuid := '40400000-0000-4000-8000-000000000071';
  other_participant constant uuid := '40400000-0000-4000-8000-000000000072';
  target_sunday date := (clock_timestamp() at time zone 'Europe/Bucharest')::date
    + (7 - extract(dow from clock_timestamp() at time zone 'Europe/Bucharest')::integer);
  next_sunday date;
begin
  if extract(dow from target_sunday) <> 0 then
    raise exception 'Fixture target must be a Sunday.';
  end if;
  next_sunday := target_sunday + 7;

  insert into public.challenges(
    id, owner_id, created_by, name, start_date, end_date,
    status, challenge_kind
  ) values (
    target_challenge, '00000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000006', 'Erasure keeps this challenge',
    current_date - 7, current_date + 35, 'active', 'group'
  );
  insert into public.participants(
    id, challenge_id, user_id, display_name, status, starting_weight_kg,
    target_weight_kg, joined_at
  ) values
    (target_participant, target_challenge,
      '00000000-0000-4000-8000-000000000006', 'Account Erasure Secret Name',
      'active', 90, 80, now() - interval '30 days'),
    (other_participant, target_challenge,
      '00000000-0000-4000-8000-000000000002', 'Remaining member',
      'active', 88, 78, now() - interval '25 days');
  insert into public.weigh_ins(id, participant_id, recorded_date, weight_kg, note)
  values ('40400000-0000-4000-8000-000000000073', target_participant,
    current_date - 1, 89.5, 'Legacy private note');
  insert into public.participant_target_milestones(
    id, challenge_id, participant_id, target_weight_kg
  ) values ('40400000-0000-4000-8000-000000000074', target_challenge,
    target_participant, 80);
  insert into public.personal_weigh_ins(
    id, user_id, recorded_date, weight_kg, note
  ) values (
    '40400000-0000-4000-8000-000000000075',
    '00000000-0000-4000-8000-000000000006', target_sunday, 89.5,
    'Personal private note'
  );
  insert into public.personal_weigh_in_group_shares(personal_weigh_in_id, challenge_id)
  values ('40400000-0000-4000-8000-000000000075', target_challenge);
  insert into public.challenge_invites(
    id, challenge_id, created_by, token_hash, expires_at
  ) values (
    '40400000-0000-4000-8000-000000000076', target_challenge,
    '00000000-0000-4000-8000-000000000006', repeat('6', 64), now() + interval '1 day'
  );

  insert into public.group_weekly_candidate_weeks(challenge_id, sunday, snapshot_ready)
  values (target_challenge, target_sunday, true),
    (target_challenge, next_sunday, true)
  on conflict (challenge_id, sunday) do update set snapshot_ready = true;
  insert into public.group_weekly_candidates(
    challenge_id, sunday, user_id, participant_id, joined_at, display_name,
    is_active, actual_weight_kg, baseline_weight_kg, baseline_source,
    baseline_source_date
  ) values
    (target_challenge, target_sunday,
      '00000000-0000-4000-8000-000000000006', target_participant,
      now() - interval '30 days', 'Account Erasure Secret Name', true,
      89.5, 90, 'first_week_actual', target_sunday - 4),
    (target_challenge, next_sunday,
      '00000000-0000-4000-8000-000000000006', target_participant,
      now() - interval '30 days', 'Account Erasure Secret Name', true,
      null, null, 'none', null)
  on conflict (challenge_id, sunday, user_id) do update set
    actual_weight_kg = excluded.actual_weight_kg,
    baseline_weight_kg = excluded.baseline_weight_kg,
    baseline_source = excluded.baseline_source,
    baseline_source_date = excluded.baseline_source_date;
  insert into public.group_weekly_results(
    challenge_id, sunday, finalized_at, result_outcome,
    active_participant_count, recorded_participant_count,
    eligible_participant_count, winner_count, sole_participant_name
  ) values
    (target_challenge, target_sunday, now(), 'winner', 2, 2, 2, 1, null),
    (target_challenge, next_sunday, now(), 'sole_eligible', 1, 1, 1, 0,
      'Account Erasure Secret Name');
  insert into public.group_weekly_result_winners(
    challenge_id, sunday, user_id, participant_id, member_key, display_name,
    weight_change_kg, previous_weight_kg, current_weight_kg, baseline_source,
    baseline_source_date
  ) values (
    target_challenge, target_sunday,
    '00000000-0000-4000-8000-000000000006', target_participant,
    md5(target_challenge::text || ':00000000-0000-4000-8000-000000000006'),
    'Account Erasure Secret Name', -0.5, 90, 89.5,
    'first_week_actual', target_sunday - 4
  );

  update public.challenges set status = 'archived'
  where id = target_challenge;
  delete from auth.users where id = '00000000-0000-4000-8000-000000000006';

  if exists (select 1 from auth.users where id = '00000000-0000-4000-8000-000000000006')
     or exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000006') then
    raise exception 'Auth and profile rows were not deleted.';
  end if;
  if not exists (select 1 from public.challenges where id = target_challenge
      and owner_id is null and created_by is null and status = 'archived') then
    raise exception 'Account deletion removed its challenge or retained owner identity.';
  end if;
  if not exists (select 1 from public.group_weekly_results where challenge_id = target_challenge
      and sunday = target_sunday and winner_count = 1 and result_outcome = 'winner') then
    raise exception 'The finalized award count or result changed during erasure.';
  end if;
  if not exists (select 1 from public.group_weekly_result_winners as winner
      where winner.challenge_id = target_challenge and winner.sunday = target_sunday
        and winner.user_id is null and winner.participant_id is null
        and winner.member_key is null and winner.display_name = 'Deleted member'
        and winner.weight_change_kg is null and winner.previous_weight_kg is null
        and winner.current_weight_kg is null and winner.baseline_source is null
        and winner.baseline_source_date is null and winner.baseline_before_date is null
        and winner.baseline_before_weight_kg is null and winner.baseline_after_date is null
        and winner.baseline_after_weight_kg is null) then
    raise exception 'Winner identity or detailed scoring evidence was not erased.';
  end if;
  if exists (select 1 from public.group_weekly_results where challenge_id = target_challenge
      and sunday = next_sunday and sole_participant_name <> 'Deleted member') then
    raise exception 'Sole-eligible participant name was not anonymized.';
  end if;
  if exists (select 1 from public.group_weekly_candidates where user_id = '00000000-0000-4000-8000-000000000006')
     or exists (select 1 from public.personal_weigh_ins where user_id = '00000000-0000-4000-8000-000000000006')
     or exists (select 1 from public.weigh_ins where id = '40400000-0000-4000-8000-000000000073')
     or exists (select 1 from public.participant_target_milestones where participant_id = target_participant)
     or exists (select 1 from public.challenge_invites where id = '40400000-0000-4000-8000-000000000076') then
    raise exception 'Account-linked private weigh-ins, milestones, invites or candidate evidence remain.';
  end if;
  if not exists (select 1 from public.participants where id = other_participant
      and user_id = '00000000-0000-4000-8000-000000000002') then
    raise exception 'Another group member was changed by account erasure.';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
  -- The preceding weekly scenario moves this disposable database's rollout
  -- date into the past. Keep this RPC focused on award counting, not catch-up
  -- finalization of unrelated fixture Sundays.
  update public.group_weekly_result_control
  set effective_from_sunday = target_sunday where singleton;
  if (select awards.win_count from public.get_group_weekly_win_counts(target_challenge) as awards
      where awards.display_name = 'Deleted member') <> 1 then
    raise exception 'The anonymous lifetime award count was not retained.';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  if not public.delete_archived_group_challenge(target_challenge) then
    raise exception 'An active member could not delete the archived ownerless group.';
  end if;
  if exists (select 1 from public.group_weekly_results where challenge_id = target_challenge)
     or exists (select 1 from public.group_weekly_result_winners where challenge_id = target_challenge)
     or exists (select 1 from public.group_weekly_candidates where challenge_id = target_challenge) then
    raise exception 'Permanent challenge deletion left weekly award or evidence rows.';
  end if;
end;
$$;

\echo PASS account erasure removes personal data and scoring evidence while preserving anonymous awards and challenge cascades
