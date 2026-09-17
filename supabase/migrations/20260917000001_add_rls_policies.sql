-- Slimpossible row-level security and privacy boundaries.
-- Policies are evaluated with the authenticated Supabase user's auth.uid().

alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.participants enable row level security;
alter table public.weigh_ins enable row level security;

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy challenges_select_owned
  on public.challenges for select
  to authenticated
  using (owner_id = auth.uid());

create policy challenges_insert_owned
  on public.challenges for insert
  to authenticated
  with check (owner_id = auth.uid() and created_by = auth.uid());

create policy challenges_update_owned
  on public.challenges for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and created_by = auth.uid());

create policy challenges_delete_owned
  on public.challenges for delete
  to authenticated
  using (owner_id = auth.uid());

create policy participants_select_owned_or_self
  on public.participants for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.challenges
      where challenges.id = participants.challenge_id
        and challenges.owner_id = auth.uid()
    )
  );

create policy participants_insert_for_owned_challenge
  on public.participants for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.challenges
      where challenges.id = participants.challenge_id
        and challenges.owner_id = auth.uid()
    )
  );

create policy participants_update_for_owned_challenge
  on public.participants for update
  to authenticated
  using (
    exists (
      select 1
      from public.challenges
      where challenges.id = participants.challenge_id
        and challenges.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.challenges
      where challenges.id = participants.challenge_id
        and challenges.owner_id = auth.uid()
    )
  );

create policy participants_delete_for_owned_challenge
  on public.participants for delete
  to authenticated
  using (
    exists (
      select 1
      from public.challenges
      where challenges.id = participants.challenge_id
        and challenges.owner_id = auth.uid()
    )
  );

create policy weigh_ins_select_own
  on public.weigh_ins for select
  to authenticated
  using (
    exists (
      select 1
      from public.participants
      where participants.id = weigh_ins.participant_id
        and participants.user_id = auth.uid()
    )
  );

create policy weigh_ins_insert_own
  on public.weigh_ins for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.participants
      where participants.id = weigh_ins.participant_id
        and participants.user_id = auth.uid()
    )
  );

create policy weigh_ins_update_own
  on public.weigh_ins for update
  to authenticated
  using (
    exists (
      select 1
      from public.participants
      where participants.id = weigh_ins.participant_id
        and participants.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.participants
      where participants.id = weigh_ins.participant_id
        and participants.user_id = auth.uid()
    )
  );

create policy weigh_ins_delete_own
  on public.weigh_ins for delete
  to authenticated
  using (
    exists (
      select 1
      from public.participants
      where participants.id = weigh_ins.participant_id
        and participants.user_id = auth.uid()
    )
  );

-- Owners receive aggregate progress only. Notes, weights, participant IDs, and
-- other raw private fields are intentionally excluded from this result.
create or replace function public.get_challenge_progress_summary(
  target_challenge_id uuid
)
returns table (
  challenge_id uuid,
  active_participant_count bigint,
  participants_with_recorded_weight_count bigint,
  total_weigh_in_count bigint,
  latest_recorded_date date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    count(distinct p.id) filter (where p.status = 'active'),
    count(distinct p.id) filter (where w.id is not null),
    count(w.id),
    max(w.recorded_date)
  from public.challenges as c
  left join public.participants as p
    on p.challenge_id = c.id
   and p.status = 'active'
  left join public.weigh_ins as w
    on w.participant_id = p.id
  where c.id = target_challenge_id
    and c.owner_id = auth.uid()
  group by c.id;
$$;

revoke all on function public.get_challenge_progress_summary(uuid) from public;
grant execute on function public.get_challenge_progress_summary(uuid) to authenticated;
