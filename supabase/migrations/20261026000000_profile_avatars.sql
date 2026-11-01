begin;

alter table public.profiles
  add column avatar_path text,
  add column avatar_preset_id text,
  add constraint profiles_avatar_path_owner_scoped check (
    avatar_path is null or avatar_path ~ (
      '^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
    )
  ),
  add constraint profiles_avatar_preset_valid check (
    avatar_preset_id is null or avatar_preset_id ~ '^(male|female)-(0[1-9]|1[0-5])$'
  ),
  add constraint profiles_avatar_selection_exclusive check (
    avatar_path is null or avatar_preset_id is null
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy profile_avatars_select_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy profile_avatars_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy profile_avatars_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
