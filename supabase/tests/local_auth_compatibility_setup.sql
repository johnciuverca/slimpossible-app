-- LOCAL DISPOSABLE DATABASE ONLY. Not a Supabase migration or remote seed.
-- Minimal Auth shim + inspected Supabase-style defaults; not full Supabase Auth.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create schema storage;
create extension pgcrypto with schema extensions;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null
);
create function storage.foldername(object_name text) returns text[]
  language sql immutable as $$
  select coalesce(array_agg(parts.part order by parts.ordinality), array[]::text[])
  from unnest(string_to_array(object_name, '/')) with ordinality as parts(part, ordinality)
  where parts.ordinality < cardinality(string_to_array(object_name, '/'));
$$;
create table auth.users (id uuid primary key, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '');
$$;
grant usage on schema public, auth, extensions, storage to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, service_role;
insert into auth.users (id, created_at) values
  ('00000000-0000-4000-8000-000000000099', '2000-01-01'),
  ('00000000-0000-4000-8000-000000000001', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000002', '2026-01-02'),
  ('00000000-0000-4000-8000-000000000003', '2026-01-03');
