-- Accepting a current invitation can restore a previously withdrawn
-- membership only when that invitation was created after the membership's
-- last update. This lets an owner re-invite someone without making old invite
-- links silently undo a later withdrawal.
create or replace function public.accept_challenge_invite(
  invite_token text,
  participant_display_name text,
  participant_starting_weight_kg numeric,
  participant_target_weight_kg numeric
)
returns public.participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invite_row public.challenge_invites%rowtype;
  accepted_participant public.participants%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select i.* into invite_row
  from public.challenge_invites as i
  where i.token_hash = encode(
    extensions.digest(trim(invite_token), 'sha256'),
    'hex'
  );

  if not found then
    raise exception using errcode = 'P0004', message = 'Invitation is invalid.';
  end if;
  if invite_row.revoked_at is not null then
    raise exception using errcode = 'P0002', message = 'Invitation is revoked.';
  end if;
  if invite_row.expires_at <= now() then
    raise exception using errcode = 'P0003', message = 'Invitation is expired.';
  end if;
  if trim(coalesce(participant_display_name, '')) = '' then
    raise exception using errcode = '22023', message = 'Display name is required.';
  end if;
  if participant_starting_weight_kg is null or participant_starting_weight_kg <= 0
     or participant_target_weight_kg is null or participant_target_weight_kg <= 0 then
    raise exception using errcode = '22023', message = 'Weights must be positive.';
  end if;

  insert into public.profiles (id, display_name)
  values (auth.uid(), trim(participant_display_name))
  on conflict (id) do nothing;

  insert into public.participants as existing (
    challenge_id,
    user_id,
    display_name,
    status,
    starting_weight_kg,
    target_weight_kg,
    joined_at
  ) values (
    invite_row.challenge_id,
    auth.uid(),
    trim(participant_display_name),
    'active',
    participant_starting_weight_kg,
    participant_target_weight_kg,
    now()
  )
  on conflict (challenge_id, user_id) do update
  set display_name = excluded.display_name,
      status = 'active',
      starting_weight_kg = excluded.starting_weight_kg,
      target_weight_kg = excluded.target_weight_kg,
      joined_at = case
        when existing.status = 'withdrawn' then now()
        else coalesce(existing.joined_at, now())
      end,
      updated_at = now()
  where existing.status = 'invited'
     or (
       existing.status = 'withdrawn'
       and invite_row.created_at > existing.updated_at
     )
  returning * into accepted_participant;

  -- Preserve active or completed memberships, and withdrawn memberships when
  -- the accepted invitation predates their last update.
  if not found then
    select p.* into accepted_participant
    from public.participants as p
    where p.challenge_id = invite_row.challenge_id
      and p.user_id = auth.uid();
  end if;

  return accepted_participant;
end;
$$;

revoke all on function public.accept_challenge_invite(text, text, numeric, numeric) from public;
grant execute on function public.accept_challenge_invite(text, text, numeric, numeric) to authenticated;
