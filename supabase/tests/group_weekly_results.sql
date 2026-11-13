-- LOCAL disposable PostgreSQL only. No logical slots, cron or hosted database.
\set ON_ERROR_STOP on

insert into public.profiles(id, display_name) values
  ('00000000-0000-4000-8000-000000000001', 'Weekly owner'),
  ('00000000-0000-4000-8000-000000000002', 'Weekly member')
on conflict (id) do nothing;

do $$
declare
  target_sunday date := (clock_timestamp() at time zone 'Europe/Bucharest')::date
    - extract(dow from clock_timestamp() at time zone 'Europe/Bucharest')::integer - 14;
  previous_sunday date;
  rollout_sunday date;
  cutoff timestamptz;
  observed_state text;
  test_challenge_id constant uuid := '40400000-0000-4000-8000-000000000001';
begin
  previous_sunday := target_sunday - 7;
  rollout_sunday := target_sunday + 28;
  cutoff := public.group_weekly_cutoff(target_sunday);

  if public.group_weekly_cutoff('2026-01-11') <> '2026-01-11 18:00:00+00'::timestamptz
     or public.group_weekly_cutoff('2026-07-12') <> '2026-07-12 17:00:00+00'::timestamptz then
    raise exception 'Bucharest Sunday cutoff does not account for DST.';
  end if;
  if not public.group_weekly_gate_accepts(target_sunday, cutoff - interval '1 microsecond')
     or public.group_weekly_gate_accepts(target_sunday, cutoff)
     or public.group_weekly_gate_accepts(target_sunday, cutoff + interval '1 microsecond') then
    raise exception 'Sunday cutoff gate must be strict at equality.';
  end if;

  insert into public.challenges(
    id, owner_id, created_by, name, start_date, end_date, status, challenge_kind
  ) values (
    test_challenge_id, '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001', 'Local weekly results',
    previous_sunday - 14, rollout_sunday + 28, 'active', 'group'
  );
  insert into public.participants(
    id, challenge_id, user_id, display_name, status,
    starting_weight_kg, target_weight_kg, joined_at
  ) values
    ('40400000-0000-4000-8000-000000000011', test_challenge_id,
      '00000000-0000-4000-8000-000000000001', 'Ava', 'active', 90, 80, now() - interval '60 days'),
    ('40400000-0000-4000-8000-000000000012', test_challenge_id,
      '00000000-0000-4000-8000-000000000002', 'Ben', 'active', 90, 80, now() - interval '60 days');
  insert into public.personal_weigh_ins(id, user_id, recorded_date, weight_kg, note) values
    ('40400000-0000-4000-8000-000000000025', '00000000-0000-4000-8000-000000000001', target_sunday - 21, 84, 'private note'),
    ('40400000-0000-4000-8000-000000000026', '00000000-0000-4000-8000-000000000002', target_sunday - 21, 89, 'private note'),
    ('40400000-0000-4000-8000-000000000027', '00000000-0000-4000-8000-000000000001', target_sunday - 14, 82, 'private note'),
    ('40400000-0000-4000-8000-000000000028', '00000000-0000-4000-8000-000000000002', target_sunday - 14, 87, 'private note'),
    ('40400000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000001', previous_sunday, 80, 'private note'),
    ('40400000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000001', target_sunday, 78, 'private note'),
    ('40400000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000002', previous_sunday, 85, 'private note'),
    ('40400000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000002', target_sunday, 83, 'private note');
  insert into public.personal_weigh_in_group_shares(personal_weigh_in_id, challenge_id) values
    ('40400000-0000-4000-8000-000000000025', test_challenge_id),
    ('40400000-0000-4000-8000-000000000026', test_challenge_id),
    ('40400000-0000-4000-8000-000000000027', test_challenge_id),
    ('40400000-0000-4000-8000-000000000028', test_challenge_id),
    ('40400000-0000-4000-8000-000000000021', test_challenge_id),
    ('40400000-0000-4000-8000-000000000022', test_challenge_id),
    ('40400000-0000-4000-8000-000000000023', test_challenge_id),
    ('40400000-0000-4000-8000-000000000024', test_challenge_id);

  if exists (select 1 from public.group_weekly_result_control) then
    raise exception 'Rollout must remain unset before explicit initialization.';
  end if;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform public.initialize_group_weekly_results(rollout_sunday);

  if (select effective_from_sunday from public.group_weekly_result_control where singleton)
      <> rollout_sunday then
    raise exception 'Initializer did not keep the selected effective Sunday.';
  end if;
  if not exists (select 1 from public.group_weekly_candidate_weeks as candidate_week
    where candidate_week.challenge_id = test_challenge_id and candidate_week.sunday = rollout_sunday + 28) then
    raise exception 'Initialization did not seed the challenge Sunday horizon.';
  end if;
  if exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name like 'group_weekly_candidate%'
      and column_name in ('note', 'email', 'raw_user_id')) then
    raise exception 'Candidate snapshots contain fields outside the minimal scoring contract.';
  end if;
  if has_table_privilege('authenticated', 'public.group_weekly_candidates', 'select')
     or has_table_privilege('service_role', 'public.group_weekly_candidates', 'select') then
    raise exception 'Private candidate snapshots are readable by client or service roles.';
  end if;

  -- Local historical date override exercises finalization without waiting for Sunday.
  update public.group_weekly_result_control
  set effective_from_sunday = target_sunday - 14 where singleton;
  insert into public.group_weekly_candidate_weeks(challenge_id, sunday)
    values (test_challenge_id, target_sunday - 21),
      (test_challenge_id, target_sunday - 14),
      (test_challenge_id, previous_sunday), (test_challenge_id, target_sunday)
    on conflict do nothing;
  perform public._group_weekly_ensure_snapshot(test_challenge_id, target_sunday - 21);
  perform public._group_weekly_ensure_snapshot(test_challenge_id, target_sunday - 14);
  perform public._group_weekly_ensure_snapshot(test_challenge_id, previous_sunday);
  perform public._group_weekly_ensure_snapshot(test_challenge_id, target_sunday);
  perform set_config('request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000001', true);
  select result.result_state into observed_state
  from public.get_group_weekly_result_display(test_challenge_id, target_sunday) as result;
  if observed_state <> 'finalized' then
    raise exception 'Latest-first display did not finalize the missed Sundays chronologically.';
  end if;
  if (select count(*) from public.group_weekly_results as result
      where result.challenge_id = test_challenge_id
        and result.sunday between target_sunday - 14 and target_sunday) <> 3 then
    raise exception 'Latest-first finalization did not preserve all three missed award weeks.';
  end if;
  if not exists (select 1 from public.group_weekly_results as result
    where result.challenge_id = test_challenge_id and result.sunday = target_sunday
      and result_outcome = 'shared_winners' and winner_count = 2
      and active_participant_count = 2 and recorded_participant_count = 2
      and eligible_participant_count = 2) then
    raise exception 'Expected an actual-only tied award for two eligible members.';
  end if;
  if (select count(*) from public.group_weekly_result_winners as winner
      where winner.challenge_id = test_challenge_id and winner.sunday = target_sunday) <> 2 then
    raise exception 'Tied winners were not frozen.';
  end if;

  update public.personal_weigh_ins set weight_kg = 70
  where id = '40400000-0000-4000-8000-000000000022';
  delete from public.personal_weigh_in_group_shares
  where personal_weigh_in_id = '40400000-0000-4000-8000-000000000024';
  update public.participants set display_name = 'Updated Ava'
  where id = '40400000-0000-4000-8000-000000000011';
  if (select count(*) from public.group_weekly_result_winners as winner
      where winner.challenge_id = test_challenge_id and winner.sunday = target_sunday) <> 2
     or (select result.result_outcome from public.group_weekly_results as result
      where result.challenge_id = test_challenge_id and result.sunday = target_sunday) <> 'shared_winners' then
    raise exception 'Edits after finalization changed the immutable award.';
  end if;
  if not exists (select 1 from public.group_weekly_result_winners as winner
    where winner.challenge_id = test_challenge_id and winner.sunday = target_sunday
      and winner.display_name = 'Ava') then
    raise exception 'A post-cutoff participant update changed the frozen winner label.';
  end if;
end;
$$;

do $$
declare
  target_sunday date := (clock_timestamp() at time zone 'Europe/Bucharest')::date
    - extract(dow from clock_timestamp() at time zone 'Europe/Bucharest')::integer - 14;
  previous_sunday date;
  no_result_id constant uuid := '40400000-0000-4000-8000-000000000002';
  sole_id constant uuid := '40400000-0000-4000-8000-000000000003';
  sole_eligible_id constant uuid := '40400000-0000-4000-8000-000000000004';
  test_id uuid;
begin
  previous_sunday := target_sunday - 7;
  insert into public.challenges(
    id, owner_id, created_by, name, start_date, end_date, status, challenge_kind
  ) values
    (no_result_id, '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001', 'No eligible result',
      previous_sunday - 14, target_sunday, 'active', 'group'),
    (sole_id, '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001', 'One active participant',
      previous_sunday - 14, target_sunday + 14, 'active', 'group'),
    (sole_eligible_id, '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001', 'One eligible participant',
      previous_sunday - 14, target_sunday + 14, 'active', 'group');
  insert into public.participants(
    id, challenge_id, user_id, display_name, status,
    starting_weight_kg, target_weight_kg, joined_at
  ) values
    ('40400000-0000-4000-8000-000000000031', no_result_id,
      '00000000-0000-4000-8000-000000000001', 'Ava', 'active', 90, 80, now() - interval '30 days'),
    ('40400000-0000-4000-8000-000000000032', no_result_id,
      '00000000-0000-4000-8000-000000000002', 'Ben', 'active', 90, 80, now() - interval '30 days'),
    ('40400000-0000-4000-8000-000000000033', sole_id,
      '00000000-0000-4000-8000-000000000001', 'Ava', 'active', 90, 80, now() - interval '30 days'),
    ('40400000-0000-4000-8000-000000000034', sole_eligible_id,
      '00000000-0000-4000-8000-000000000001', 'Ava', 'active', 90, 80, now() - interval '30 days'),
    ('40400000-0000-4000-8000-000000000035', sole_eligible_id,
      '00000000-0000-4000-8000-000000000002', 'Ben', 'active', 90, 80, now() - interval '30 days');
  insert into public.personal_weigh_in_group_shares(personal_weigh_in_id, challenge_id) values
    ('40400000-0000-4000-8000-000000000022', no_result_id),
    ('40400000-0000-4000-8000-000000000021', sole_id),
    ('40400000-0000-4000-8000-000000000022', sole_id),
    ('40400000-0000-4000-8000-000000000021', sole_eligible_id),
    ('40400000-0000-4000-8000-000000000022', sole_eligible_id),
    ('40400000-0000-4000-8000-000000000024', sole_eligible_id);

  insert into public.group_weekly_candidate_weeks(challenge_id, sunday)
  values (no_result_id, target_sunday - 21), (no_result_id, target_sunday - 14),
    (no_result_id, previous_sunday), (no_result_id, target_sunday)
  on conflict do nothing;
  perform public._group_weekly_ensure_snapshot(no_result_id, target_sunday - 21);
  perform public._group_weekly_ensure_snapshot(no_result_id, target_sunday - 14);
  perform public._group_weekly_ensure_snapshot(no_result_id, previous_sunday);
  perform public._group_weekly_ensure_snapshot(no_result_id, target_sunday);

  foreach test_id in array array[sole_id, sole_eligible_id]
  loop
    insert into public.group_weekly_candidate_weeks(challenge_id, sunday)
    values (test_id, previous_sunday), (test_id, target_sunday)
    on conflict do nothing;
    perform public._group_weekly_ensure_snapshot(test_id, previous_sunday);
    perform public._group_weekly_ensure_snapshot(test_id, target_sunday);
    perform public._finalize_group_weekly_result_locked(test_id, target_sunday);
  end loop;

  if not exists (select 1 from public.group_weekly_results as result
    where result.challenge_id = sole_id and result.sunday = target_sunday
      and result.result_outcome = 'sole_participant' and result.eligible_participant_count = 1
      and result.winner_count = 0) then
    raise exception 'A sole active participant received a competitive award.';
  end if;
  if not exists (select 1 from public.group_weekly_results as result
    where result.challenge_id = sole_eligible_id and result.sunday = target_sunday
      and result.result_outcome = 'sole_eligible' and result.eligible_participant_count = 1
      and result.active_participant_count = 2 and result.winner_count = 0) then
    raise exception 'A sole eligible candidate received a competitive award.';
  end if;
end;
$$;

do $$
declare
  target_sunday date := (clock_timestamp() at time zone 'Europe/Bucharest')::date
    - extract(dow from clock_timestamp() at time zone 'Europe/Bucharest')::integer - 14;
  open_sunday date := public._group_weekly_upcoming_sunday();
  rejoin_at timestamptz;
  rejoin_id constant uuid := '40400000-0000-4000-8000-000000000005';
  prejoin_id constant uuid := '40400000-0000-4000-8000-000000000006';
  summary record;
begin
  insert into public.challenges(
    id, owner_id, created_by, name, start_date, end_date, status, challenge_kind
  ) values
    (rejoin_id, '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001', 'Rejoin episode',
      open_sunday - 14, open_sunday + 14, 'active', 'group'),
    (prejoin_id, '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001', 'Prejoin Sunday share',
      target_sunday - 14, target_sunday, 'active', 'group');
  insert into public.participants(
    id, challenge_id, user_id, display_name, status,
    starting_weight_kg, target_weight_kg, joined_at
  ) values
    ('40400000-0000-4000-8000-000000000051', rejoin_id,
      '00000000-0000-4000-8000-000000000001', 'Ava', 'active', 90, 80, now() - interval '30 days'),
    ('40400000-0000-4000-8000-000000000052', rejoin_id,
      '00000000-0000-4000-8000-000000000002', 'Ben', 'active', 90, 80, now() - interval '30 days'),
    ('40400000-0000-4000-8000-000000000061', prejoin_id,
      '00000000-0000-4000-8000-000000000001', 'Ava', 'active', 90, 80, now()),
    ('40400000-0000-4000-8000-000000000062', prejoin_id,
      '00000000-0000-4000-8000-000000000002', 'Ben', 'active', 90, 80, now());
  insert into public.personal_weigh_ins(id, user_id, recorded_date, weight_kg, note) values
    ('40400000-0000-4000-8000-000000000029',
      '00000000-0000-4000-8000-000000000001', open_sunday - 7, 79, null),
    ('40400000-0000-4000-8000-000000000030',
      '00000000-0000-4000-8000-000000000001', open_sunday, 77, null);
  insert into public.personal_weigh_in_group_shares(personal_weigh_in_id, challenge_id) values
    ('40400000-0000-4000-8000-000000000029', rejoin_id),
    ('40400000-0000-4000-8000-000000000030', rejoin_id),
    ('40400000-0000-4000-8000-000000000022', prejoin_id);
  insert into public.group_weekly_candidate_weeks(challenge_id, sunday)
  values (rejoin_id, open_sunday - 7), (prejoin_id, target_sunday)
  on conflict do nothing;
  perform public._group_weekly_ensure_snapshot(rejoin_id, open_sunday - 7);
  perform public._group_weekly_ensure_snapshot(prejoin_id, target_sunday);

  insert into public.group_weekly_candidates(
    challenge_id, sunday, user_id, participant_id, joined_at,
    display_name, is_active, actual_weight_kg
  )
  select rejoin_id, open_sunday - 7, participant.user_id, participant.id,
    participant.joined_at, participant.display_name, true, 79
  from public.participants as participant
  where participant.challenge_id = rejoin_id
    and participant.user_id = '00000000-0000-4000-8000-000000000001'
  on conflict (challenge_id, sunday, user_id) do update
    set actual_weight_kg = excluded.actual_weight_kg;

  select participant.joined_at into rejoin_at
  from public.participants as participant
  where participant.challenge_id = rejoin_id and participant.user_id =
    '00000000-0000-4000-8000-000000000001';
  update public.participants set joined_at = clock_timestamp()
  where challenge_id = rejoin_id
    and user_id = '00000000-0000-4000-8000-000000000001';

  select * into summary from public._group_weekly_snapshot_summary(rejoin_id, open_sunday);
  if summary.eligible_count <> 0
     or (select candidate.actual_weight_kg from public.group_weekly_candidates as candidate
       where candidate.challenge_id = rejoin_id and candidate.sunday = open_sunday
         and candidate.user_id = '00000000-0000-4000-8000-000000000001') is not null
     or (select candidate.joined_at from public.group_weekly_candidates as candidate
       where candidate.challenge_id = rejoin_id and candidate.sunday = open_sunday
         and candidate.user_id = '00000000-0000-4000-8000-000000000001') <= rejoin_at then
    raise exception 'Rejoin reused a previous membership episode or pre-rejoin weigh-in.';
  end if;
  if (select candidate.joined_at from public.group_weekly_candidates as candidate
      where candidate.challenge_id = rejoin_id and candidate.sunday = open_sunday - 7
        and candidate.user_id = '00000000-0000-4000-8000-000000000001') is not distinct from
     (select candidate.joined_at from public.group_weekly_candidates as candidate
      where candidate.challenge_id = rejoin_id and candidate.sunday = open_sunday
        and candidate.user_id = '00000000-0000-4000-8000-000000000001') then
    raise exception 'Rejoin did not retain distinct per-week membership episodes.';
  end if;
  if (select candidate.actual_weight_kg from public.group_weekly_candidates as candidate
      where candidate.challenge_id = prejoin_id and candidate.sunday = target_sunday
        and candidate.user_id = '00000000-0000-4000-8000-000000000001') is not null then
    raise exception 'A Sunday weigh-in from before joining was admitted after a new share.';
  end if;
  if public._finalize_group_weekly_results_through(prejoin_id, target_sunday)
     or exists (select 1 from public.group_weekly_results as result
       where result.challenge_id = prejoin_id and result.sunday = target_sunday) then
    raise exception 'A missing prior Sunday snapshot was misreported as a no-eligible result.';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
select * from public.get_group_weekly_result_display(
  '40400000-0000-4000-8000-000000000001',
  (clock_timestamp() at time zone 'Europe/Bucharest')::date
    - extract(dow from clock_timestamp() at time zone 'Europe/Bucharest')::integer
);
select * from public.get_group_weekly_result_display(
  '40400000-0000-4000-8000-000000000001',
  (clock_timestamp() at time zone 'Europe/Bucharest')::date
    - extract(dow from clock_timestamp() at time zone 'Europe/Bucharest')::integer - 14
);
select * from public.get_group_weekly_result_display(
  '40400000-0000-4000-8000-000000000001',
  (clock_timestamp() at time zone 'Europe/Bucharest')::date
    - extract(dow from clock_timestamp() at time zone 'Europe/Bucharest')::integer - 28
);
select * from public.get_group_weekly_win_counts(
  '40400000-0000-4000-8000-000000000002'
);
select * from public.get_provisional_group_leader_summary(
  '40400000-0000-4000-8000-000000000001', current_date
);
select eligible_participant_count, weekly_winner_count, weekly_winner_names
from public.get_group_progress_summary(
  '40400000-0000-4000-8000-000000000001',
  (clock_timestamp() at time zone 'Europe/Bucharest')::date
    - extract(dow from clock_timestamp() at time zone 'Europe/Bucharest')::integer
);
reset role;

do $$
declare
  target_sunday date := (clock_timestamp() at time zone 'Europe/Bucharest')::date
    - extract(dow from clock_timestamp() at time zone 'Europe/Bucharest')::integer - 14;
begin
  if (select count(*) from public.group_weekly_results as result
      where result.challenge_id = '40400000-0000-4000-8000-000000000002'
        and result.sunday between target_sunday - 14 and target_sunday) <> 3 then
    raise exception 'Standings-first finalization did not fill every due Sunday chronologically.';
  end if;
  if not exists (select 1 from public.group_weekly_results as result
    where result.challenge_id = '40400000-0000-4000-8000-000000000002'
      and result.sunday = target_sunday and result.result_outcome = 'no_eligible_candidates') then
    raise exception 'Standings-first did not persist the eligible no-result outcome.';
  end if;
  if (select count(*) from public.group_weekly_result_winners as winner
      where winner.challenge_id = '40400000-0000-4000-8000-000000000001'
        and winner.sunday = target_sunday - 14) <> 2 then
    raise exception 'Revisiting an older week lost its immutable award.';
  end if;
end;
$$;
