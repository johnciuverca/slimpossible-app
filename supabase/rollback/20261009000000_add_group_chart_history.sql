-- Remove only #211's additive read RPC; existing history and all data survive.
begin;
drop function if exists public.get_group_chart_history(uuid);
commit;
