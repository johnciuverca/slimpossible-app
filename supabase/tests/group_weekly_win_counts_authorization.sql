-- Local-only regression coverage for the derived weekly win count RPC.
begin;

do $$
declare
  owner_id uuid := '00000000-0000-4000-8000-000000000001';
  member_a uuid := '00000000-0000-4000-8000-000000000002';
  member_b uuid := '00000000-0000-4000-8000-000000000003';
  outsider_id uuid := '00000000-0000-4000-8000-000000000099';
  challenge_id uuid := gen_random_uuid();
  other_challenge_id uuid := gen_random_uuid();
  first_sunday date := date_trunc('week', current_date)::date - 22;
  actual_counts jsonb;
  repeated_counts jsonb;
  weekly_summary jsonb;
  denied boolean := false;
begin
  insert into auth.users (id) values (member_a), (member_b)
  on conflict (id) do nothing;
  insert into public.profiles (id, display_name) values
    (owner_id, 'Win count owner'), (member_a, 'Member A'),
    (member_b, 'Member B'), (outsider_id, 'Win count outsider')
  on conflict (id) do nothing;
  insert into public.challenges (
    id, owner_id, created_by, name, start_date, end_date, status, challenge_kind
  ) values
    (challenge_id, owner_id, owner_id, 'Win count group', current_date - 60, current_date + 30, 'active', 'group'),
    (other_challenge_id, outsider_id, outsider_id, 'Other win count group', current_date - 60, current_date + 30, 'active', 'group');
  insert into public.participants (
    id, challenge_id, user_id, display_name, status,
    starting_weight_kg, target_weight_kg, joined_at
  ) values
    (gen_random_uuid(), challenge_id, owner_id, 'Win count owner', 'active', 100, 80, now()),
    (gen_random_uuid(), challenge_id, member_a, 'Member A', 'active', 100, 80, now()),
    (gen_random_uuid(), challenge_id, member_b, 'Member B', 'active', 100, 80, now()),
    (gen_random_uuid(), challenge_id, outsider_id, 'Inactive member', 'withdrawn', 100, 80, now());

  insert into public.personal_weigh_ins (id, user_id, recorded_date, weight_kg, note) values
    (gen_random_uuid(), member_a, first_sunday, 100, 'private'),
    (gen_random_uuid(), member_a, first_sunday + 7, 95, 'private'),
    (gen_random_uuid(), member_a, first_sunday + 14, 93, 'private'),
    (gen_random_uuid(), member_b, first_sunday, 100, 'private'),
    (gen_random_uuid(), member_b, first_sunday + 7, 95, 'private'),
    (gen_random_uuid(), member_b, first_sunday + 14, 96, 'private');
  insert into public.personal_weigh_in_group_shares (personal_weigh_in_id, challenge_id)
    select entry.id, challenge_id from public.personal_weigh_ins as entry
    where entry.user_id in (member_a, member_b)
      and entry.recorded_date between first_sunday and first_sunday + 14;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  select jsonb_agg(jsonb_build_object(
    'name', counts.display_name, 'wins', counts.win_count
  ) order by counts.display_name)
  into actual_counts
  from public.get_group_weekly_win_counts(challenge_id) as counts;
  select jsonb_agg(jsonb_build_object(
    'name', counts.display_name, 'wins', counts.win_count
  ) order by counts.display_name)
  into repeated_counts
  from public.get_group_weekly_win_counts(challenge_id) as counts;
  if actual_counts is distinct from repeated_counts then
    raise exception 'Repeated reads changed derived weekly win counts';
  end if;
  if actual_counts is distinct from '[{"name":"Member A","wins":2},{"name":"Member B","wins":1},{"name":"Win count owner","wins":0}]'::jsonb then
    raise exception 'Unexpected tied, unique, or zero-win counts: %', actual_counts;
  end if;
  if actual_counts::text like '%user_id%' or actual_counts::text like '%participant_id%' then
    raise exception 'The public result exposed a raw identity';
  end if;
  select to_jsonb(summary.*) into weekly_summary
  from public.get_group_progress_summary(challenge_id, first_sunday + 14) as summary;
  if weekly_summary->>'weekly_winner_count' <> '1'
     or weekly_summary->'weekly_winner_names' <> '["Member A"]'::jsonb
     or weekly_summary->>'eligible_participant_count' <> '2' then
    raise exception 'The current weekly result diverged from the shared rule: %', weekly_summary;
  end if;
  if has_function_privilege('authenticated',
       'public._get_group_weekly_result(uuid,date)', 'EXECUTE') then
    raise exception 'Authenticated users can execute the internal winner helper';
  end if;

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  begin
    perform * from public.get_group_weekly_win_counts(challenge_id);
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'An outsider received challenge weekly win counts';
  end if;
end;
$$;

rollback;
