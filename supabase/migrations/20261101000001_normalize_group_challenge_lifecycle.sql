-- #372: ordinary groups are usable immediately; Draft has no group workflow.
-- Preserve the shared column's draft default for personal challenge semantics.
begin;
create or replace function public.normalize_group_challenge_status()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.challenge_kind is distinct from 'personal' and new.status = 'draft' then
    new.status := 'active';
  end if;
  return new;
end;
$$;
revoke all on function public.normalize_group_challenge_status() from public;
create trigger challenges_normalize_group_status
before insert or update of status, challenge_kind on public.challenges
for each row execute function public.normalize_group_challenge_status();

-- Exact historical normalization: group (including legacy NULL kind) + draft only. No dates, timestamps,
-- ownership, memberships, weigh-ins, shares or archive provenance are changed.
-- Ended draft groups also become Active; expiry is resolved on restore.
update public.challenges set status = 'active'
where challenge_kind is distinct from 'personal' and status = 'draft';
commit;
