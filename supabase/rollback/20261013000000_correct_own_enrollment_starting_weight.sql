-- Roll back the Issue #265 RPC only. Corrected participant baselines are data
-- and are intentionally not rewritten by this schema rollback.
drop function if exists public.correct_my_enrollment_starting_weight(uuid, numeric);
