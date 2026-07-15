begin;

\ir ../helpers/auth.inc

select plan(12);

select is(
  (
    select count(*)
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relkind = 'r'
      and not pg_class.relrowsecurity
  ),
  0::bigint,
  'every public table should have RLS enabled'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000141',
  'rls-a@test.local',
  '사용자 A'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000142',
  'rls-b@test.local',
  '사용자 B'
);

insert into public.reading_rooms (id, name, created_by)
values
  (
    '10000000-0000-0000-0000-000000000041',
    'A의 방',
    '00000000-0000-0000-0000-000000000141'
  ),
  (
    '10000000-0000-0000-0000-000000000042',
    'B의 방',
    '00000000-0000-0000-0000-000000000142'
  );

insert into public.room_members (
  id,
  room_id,
  profile_id,
  role,
  room_display_name
)
values
  (
    '20000000-0000-0000-0000-000000000041',
    '10000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000141',
    'owner',
    '사용자 A'
  ),
  (
    '20000000-0000-0000-0000-000000000042',
    '10000000-0000-0000-0000-000000000042',
    '00000000-0000-0000-0000-000000000142',
    'owner',
    '사용자 B'
  );

insert into public.room_invites (
  id,
  room_id,
  created_by_member_id,
  code_hash,
  token_hash,
  expires_at
)
values
  (
    '30000000-0000-0000-0000-000000000041',
    '10000000-0000-0000-0000-000000000041',
    '20000000-0000-0000-0000-000000000041',
    repeat('a', 64),
    repeat('b', 64),
    now() + interval '1 day'
  ),
  (
    '30000000-0000-0000-0000-000000000042',
    '10000000-0000-0000-0000-000000000042',
    '20000000-0000-0000-0000-000000000042',
    repeat('c', 64),
    repeat('d', 64),
    now() + interval '1 day'
  );

select tests.authenticate_as('00000000-0000-0000-0000-000000000141');
set local role authenticated;

select is((select count(*) from public.reading_rooms), 1::bigint, 'A should only select A room');
select is((select count(*) from public.room_members), 1::bigint, 'A should only select A members');
select is((select count(*) from public.profiles), 1::bigint, 'A should not select B profile');
select is((select count(*) from public.room_invites), 1::bigint, 'A owner should only select A invites');
select is(
  private.is_active_room_member('10000000-0000-0000-0000-000000000042'),
  false,
  'A should not be an active member of B room'
);
select is(
  private.is_room_owner('10000000-0000-0000-0000-000000000042'),
  false,
  'A should not be owner of B room'
);
select is(
  private.current_room_member_id('10000000-0000-0000-0000-000000000042'),
  null::uuid,
  'A should not resolve a member id in B room'
);
select is_empty(
  $$
    update public.reading_rooms
    set name = '침범 시도'
    where id = '10000000-0000-0000-0000-000000000042'
    returning id
  $$,
  'A should not update B room'
);
select throws_ok(
  $$
    insert into public.room_members (
      room_id,
      profile_id,
      role,
      room_display_name
    )
    values (
      '10000000-0000-0000-0000-000000000042',
      '00000000-0000-0000-0000-000000000141',
      'member',
      '직접 가입'
    )
  $$,
  '42501',
  null,
  'A should not bypass join RPC with a direct membership insert'
);
select is(
  (
    select count(*)
    from public.room_invites
    where id = '30000000-0000-0000-0000-000000000042'
  ),
  0::bigint,
  'A should not select B invite by a known id'
);

reset role;
set local role anon;

select throws_ok(
  $$select * from public.profiles$$,
  '42501',
  null,
  'anon should not select profiles'
);

reset role;

select * from finish();

rollback;
