-- LOCAL DISPOSABLE DATABASE ONLY. Focused regression for invite reactivation.
\set ON_ERROR_STOP on

INSERT INTO public.profiles (id, display_name) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Invite test owner'),
  ('00000000-0000-4000-8000-000000000002', 'Invite test member'),
  ('00000000-0000-4000-8000-000000000003', 'Invite test outsider');

INSERT INTO public.challenges (
  id, owner_id, created_by, name, start_date, end_date, status
) VALUES
  ('10000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000001',
   'Invite withdrawal regression', current_date, current_date + 30, 'active');

INSERT INTO public.participants (
  challenge_id, user_id, display_name, status, starting_weight_kg,
  target_weight_kg, joined_at
) VALUES
  ('10000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000002',
   'Invite test member', 'active', 90, 80, now() - interval '5 days');

CREATE TEMP TABLE invite_test_state (
  old_token text,
  fresh_token text,
  old_joined_at timestamptz,
  withdrawal_cutoff timestamptz
);

-- Create a valid invite before the withdrawal and preserve it as an old link.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
INSERT INTO invite_test_state (old_token)
SELECT token FROM public.create_challenge_invite(
  '10000000-0000-4000-8000-000000000001', now() + interval '7 days'
);

-- Withdraw the member. Trigger, rather than updated_at, establishes the cutoff.
UPDATE public.participants
SET status = 'withdrawn', updated_at = updated_at
WHERE challenge_id = '10000000-0000-4000-8000-000000000001'
  AND user_id = '00000000-0000-4000-8000-000000000002';

UPDATE invite_test_state
SET old_joined_at = p.joined_at,
    withdrawal_cutoff = p.withdrawn_at
FROM public.participants AS p
WHERE p.challenge_id = '10000000-0000-4000-8000-000000000001'
  AND p.user_id = '00000000-0000-4000-8000-000000000002';

-- The old, still-valid invite cannot undo withdrawal; result is unchanged row.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
DO $$
DECLARE result public.participants%rowtype;
BEGIN
  result := public.accept_challenge_invite(
    (SELECT old_token FROM invite_test_state), 'Changed name', 88, 79
  );
  IF result.status <> 'withdrawn' THEN
    RAISE EXCEPTION 'old invitation reactivated withdrawn participant';
  END IF;
  IF result.withdrawn_at IS DISTINCT FROM (SELECT withdrawal_cutoff FROM invite_test_state WHERE withdrawal_cutoff IS NOT NULL LIMIT 1) THEN
    RAISE EXCEPTION 'old invitation changed the withdrawal cutoff';
  END IF;
END;
$$;

-- Fresh invite created after the cutoff is eligible to start a new membership.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
SELECT pg_sleep(0.02);
INSERT INTO invite_test_state (fresh_token)
SELECT token FROM public.create_challenge_invite(
  '10000000-0000-4000-8000-000000000001', now() + interval '7 days'
);
DO $$
DECLARE created_at timestamptz;
BEGIN
  SELECT i.created_at INTO created_at
  FROM public.challenge_invites AS i
  WHERE i.token_hash = encode(
    extensions.digest((SELECT fresh_token FROM invite_test_state WHERE fresh_token IS NOT NULL LIMIT 1), 'sha256'), 'hex'
  );
  IF created_at <= (SELECT withdrawal_cutoff FROM invite_test_state WHERE withdrawal_cutoff IS NOT NULL LIMIT 1) THEN
    RAISE EXCEPTION 'test setup did not create invite after withdrawal';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
DO $$
DECLARE result public.participants%rowtype;
BEGIN
  result := public.accept_challenge_invite(
    (SELECT fresh_token FROM invite_test_state WHERE fresh_token IS NOT NULL LIMIT 1), 'Rejoined member', 87, 78
  );
  IF result.status <> 'active' OR result.withdrawn_at IS NOT NULL THEN
    RAISE EXCEPTION 'fresh invitation did not reactivate membership';
  END IF;
  IF result.display_name <> 'Rejoined member' OR result.starting_weight_kg <> 87 THEN
    RAISE EXCEPTION 'fresh invitation did not apply new membership details';
  END IF;
  IF result.joined_at <= (SELECT old_joined_at FROM invite_test_state WHERE old_joined_at IS NOT NULL LIMIT 1) THEN
    RAISE EXCEPTION 'fresh invitation did not begin a new membership period';
  END IF;
END;
$$;

\echo 'PASS invite rejoin withdrawal authorization regression'
