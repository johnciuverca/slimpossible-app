begin;

do $$
declare bucket storage.buckets%rowtype;
begin
  select * into bucket from storage.buckets where id = 'profile-avatars';
  if not found or bucket.public or bucket.file_size_limit <> 2097152
     or bucket.allowed_mime_types <> array['image/jpeg', 'image/png', 'image/webp'] then
    raise exception 'Profile avatar bucket must be private and enforce the configured size and MIME limits';
  end if;
end;
$$;

set local role anon;
do $$
begin
  if (select count(*) from storage.objects where bucket_id = 'profile-avatars') <> 0 then
    raise exception 'Anonymous users can read avatar objects';
  end if;
  begin
    insert into storage.objects (bucket_id, name)
    values ('profile-avatars', '00000000-0000-4000-8000-000000000001/55555555-5555-4555-8555-555555555555.png');
    raise exception 'Anonymous user inserted an avatar object';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

insert into storage.objects (bucket_id, name)
values ('profile-avatars', '00000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.png');
insert into storage.objects (bucket_id, name)
values ('profile-avatars', '00000000-0000-4000-8000-000000000001/44444444-4444-4444-8444-444444444444.webp');

update public.profiles
set avatar_path = '00000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.png'
where id = auth.uid();

do $$
begin
  if (select count(*) from storage.objects where bucket_id = 'profile-avatars') <> 2 then
    raise exception 'Avatar owner could not read their own objects';
  end if;
  if (select avatar_path from public.profiles where id = auth.uid()) is null then
    raise exception 'Avatar owner could not save their own profile object path';
  end if;
  begin
    update public.profiles set avatar_path = '00000000-0000-4000-8000-000000000002/22222222-2222-4222-8222-222222222222.png'
    where id = auth.uid();
    raise exception 'Profile accepted an avatar path outside the owner folder';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set avatar_preset_id = 'female-16' where id = auth.uid();
    raise exception 'Profile accepted an unknown built-in avatar';
  exception when check_violation then null;
  end;
  update public.profiles set avatar_path = null, avatar_preset_id = 'female-15' where id = auth.uid();
  delete from storage.objects where bucket_id = 'profile-avatars'
    and name = '00000000-0000-4000-8000-000000000001/44444444-4444-4444-8444-444444444444.webp';
  if (select count(*) from storage.objects where bucket_id = 'profile-avatars') <> 1 then
    raise exception 'Avatar owner could not delete their own object';
  end if;
  begin
    insert into storage.objects (bucket_id, name)
    values ('profile-avatars', '00000000-0000-4000-8000-000000000002/22222222-2222-4222-8222-222222222222.jpg');
    raise exception 'Avatar owner inserted into another user folder';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
do $$
begin
  if (select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000001') <> 0 then
    raise exception 'Another account can read the owner profile selection';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'profile-avatars') <> 0 then
    raise exception 'Another account can read an avatar object';
  end if;
  delete from storage.objects where bucket_id = 'profile-avatars'
    and name = '00000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.png';
  if (select count(*) from storage.objects where bucket_id = 'profile-avatars') <> 0 then
    raise exception 'Another account deleted the avatar owner object';
  end if;
  begin
    insert into storage.objects (bucket_id, name)
    values ('profile-avatars', '00000000-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333.webp');
    raise exception 'Another account inserted into the avatar owner folder';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
do $$
begin
  if (select count(*) from storage.objects where bucket_id = 'profile-avatars') <> 1 then
    raise exception 'Another account deleted the avatar owner object';
  end if;
end;
$$;

rollback;
