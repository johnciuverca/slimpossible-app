-- Revert the application before running this rollback.
-- Dropping the column discards participants' per-entry sharing choices. Review
-- and preserve that data first if rollback happens after opt-ins are collected.
begin;

drop function if exists public.get_group_weigh_in_history(uuid);
alter table public.weigh_ins drop column if exists share_with_group;

commit;
