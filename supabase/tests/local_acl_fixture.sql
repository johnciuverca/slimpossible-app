-- LOCAL ONLY: sentinel records and exact pre-correction ACL/default snapshots.
create schema local_test;
insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000000001', 'Existing local owner'),
  ('00000000-0000-4000-8000-000000000002', 'Existing local member');
insert into public.challenges (id, owner_id, created_by, name, start_date, end_date) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000001', 'Existing sentinel', current_date, current_date + 30);
insert into public.participants (id, challenge_id, user_id, display_name, starting_weight_kg, target_weight_kg) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000001', 'Existing owner', 90, 80);
insert into public.weigh_ins (participant_id, recorded_date, weight_kg, note) values
  ('20000000-0000-4000-8000-000000000001', current_date, 89, 'Preserve existing note');
create table local_test.acl_before as
select p.oid::regprocedure::text as identity,
  jsonb_agg(jsonb_build_array(a.grantor, a.grantee, a.privilege_type, a.is_grantable)
    order by a.grantor, a.grantee, a.privilege_type) as grants
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
where n.nspname = 'public'
group by p.oid;
create table local_test.defaults_before as select * from pg_default_acl;
create table local_test.data_before as
select 'profiles' as name, to_jsonb(p) as row from public.profiles p
union all select 'challenges', to_jsonb(c) from public.challenges c
union all select 'participants', to_jsonb(p) from public.participants p
union all select 'weigh_ins', to_jsonb(w) from public.weigh_ins w
union all select 'challenge_invites', to_jsonb(i) from public.challenge_invites i;
