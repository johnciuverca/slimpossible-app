-- Record an explicit withdrawal cutoff so invite freshness does not depend on
-- updated_at, which is not automatically maintained for participant changes.

BEGIN;

ALTER TABLE public.participants
  ADD COLUMN withdrawn_at timestamptz;

-- Existing withdrawn rows have no trustworthy event time. Treat migration time
-- as their cutoff so only invitations created after this migration can restore
-- them. The column, backfill, trigger and RPC change commit atomically.
UPDATE public.participants
SET withdrawn_at = transaction_timestamp()
WHERE status = 'withdrawn'
  AND withdrawn_at IS NULL;

CREATE OR REPLACE FUNCTION public.track_participant_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'withdrawn' THEN
      NEW.withdrawn_at := statement_timestamp();
    ELSE
      NEW.withdrawn_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'withdrawn' THEN
      NEW.withdrawn_at := statement_timestamp();
    ELSIF NEW.status = 'active' THEN
      NEW.withdrawn_at := NULL;
    ELSE
      -- Keep the cutoff while a withdrawn member is provisioned as invited.
      NEW.withdrawn_at := OLD.withdrawn_at;
    END IF;
  ELSIF NEW.status = 'withdrawn' THEN
    -- Callers cannot clear or backdate a withdrawal cutoff.
    NEW.withdrawn_at := coalesce(OLD.withdrawn_at, statement_timestamp());
  ELSE
    NEW.withdrawn_at := OLD.withdrawn_at;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.track_participant_withdrawal() FROM PUBLIC;

CREATE TRIGGER participants_track_withdrawal
BEFORE INSERT OR UPDATE OF status, withdrawn_at ON public.participants
FOR EACH ROW EXECUTE FUNCTION public.track_participant_withdrawal();
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
        when existing.withdrawn_at is not null then now()
        else coalesce(existing.joined_at, now())
      end,
      updated_at = now()
  where (
      existing.status = 'invited'
      and (existing.withdrawn_at is null or invite_row.created_at > existing.withdrawn_at)
    )
     or (
       existing.status = 'withdrawn'
       and invite_row.created_at > existing.withdrawn_at
     )
  returning * into accepted_participant;

  -- Preserve active or completed memberships, and withdrawn memberships when
  -- the accepted invitation predates their recorded withdrawal cutoff.
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

COMMIT;
