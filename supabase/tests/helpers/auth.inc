create schema if not exists tests;

create or replace function tests.create_supabase_user(
  p_user_id uuid,
  p_email text,
  p_display_name text default '테스트 사용자'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, auth
as $$
declare
  v_user_id uuid;
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_user_id,
    'authenticated',
    'authenticated',
    p_email,
    '',
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('display_name', p_display_name),
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now()
  returning id into v_user_id;

  return v_user_id;
end;
$$;

create or replace function tests.authenticate_as(p_user_id uuid)
returns void
language plpgsql
set search_path = pg_catalog
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_user_id,
      'role', 'authenticated',
      'aal', 'aal1'
    )::text,
    true
  );
end;
$$;

create or replace function tests.clear_authentication()
returns void
language plpgsql
set search_path = pg_catalog
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;
