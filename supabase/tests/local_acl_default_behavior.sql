-- LOCAL ONLY: confirm this narrow delta leaves future-function defaults intact.
begin;
create function public.local_default_grant_probe() returns boolean language sql as $$ select true; $$;
do $$
begin
  if not has_function_privilege('anon', 'public.local_default_grant_probe()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.local_default_grant_probe()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.local_default_grant_probe()', 'EXECUTE') then
    raise exception 'Future-function default grants changed unexpectedly.';
  end if;
  raise notice 'New functions still inherit platform defaults; review ACLs on each future migration.';
end;
$$;
rollback;
