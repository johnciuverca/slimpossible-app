select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
do $$ begin
 if exists(select 1 from normalization_before b join public.challenges c using(id)
 where to_jsonb(c) is distinct from
 case when (b.original->>'challenge_kind') is distinct from 'personal' and b.original->>'status'='draft'
 then jsonb_set(b.original,'{status}','"active"') else b.original end)
 then raise exception 'normalization changed unrelated data or missed group drafts'; end if;
end $$;
-- Historical draft archives restore to Active, or Completed after expiry.
select public.restore_group_challenge('90000000-0000-4000-8000-000000000005');
do $$ begin
 if not exists(select 1 from public.challenges where id='90000000-0000-4000-8000-000000000005' and status='active') then raise exception 'Draft archive restored as Draft'; end if;
end $$;
-- Omitted status keeps personal semantics, but groups are usable immediately.
insert into public.challenges(owner_id,created_by,name,start_date,end_date,challenge_kind)
values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000004','Default group',current_date,current_date+1,'group'),
('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000004','Default personal',current_date,current_date+1,'personal');
do $$ begin
 if not exists(select 1 from public.challenges where name='Default group' and status='active') or not exists(select 1 from public.challenges where name='Default personal' and status='draft') then raise exception 'kind-aware defaults failed'; end if;
end $$;
-- Remove only disposable fixture rows before the main authorization harness.
delete from public.challenges where owner_id='00000000-0000-4000-8000-000000000004';
delete from public.profiles where id='00000000-0000-4000-8000-000000000004';
\echo PASS scoped historical normalization and kind-aware defaults

drop table normalization_before;
