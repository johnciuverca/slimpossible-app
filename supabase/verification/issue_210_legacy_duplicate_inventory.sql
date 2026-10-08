-- Owner-run READ ONLY preflight for #210. Do not attach raw notes or enter the
-- returned identities in a shared PR comment. Run only against approved
-- non-production staging after the #209 migration is available.
begin transaction read only;

select
  participant.user_id,
  weigh_in.recorded_date,
  count(*)::integer as legacy_rows,
  count(distinct weigh_in.weight_kg)::integer as distinct_weights,
  count(distinct weigh_in.note)::integer as distinct_non_null_notes,
  count(*) filter (where weigh_in.note is null)::integer as rows_without_note,
  count(*) filter (where weigh_in.share_with_group)::integer as prior_opt_in_rows,
  count(distinct participant.challenge_id)::integer as distinct_challenges
from public.weigh_ins as weigh_in
join public.participants as participant
  on participant.id = weigh_in.participant_id
group by participant.user_id, weigh_in.recorded_date
having count(*) > 1
order by participant.user_id, weigh_in.recorded_date;

rollback;
