begin;

\ir ../helpers/auth.inc

select plan(4);

select has_schema('tests', 'tests schema should exist');
select has_function(
  'tests',
  'create_supabase_user',
  array['uuid', 'text', 'text'],
  'create_supabase_user helper should exist'
);
select has_function(
  'tests',
  'authenticate_as',
  array['uuid'],
  'authenticate_as helper should exist'
);

select is(
  tests.create_supabase_user(
    '00000000-0000-0000-0000-000000000101',
    'owner@test.local',
    '방장'
  ),
  '00000000-0000-0000-0000-000000000101'::uuid,
  'test user helper should return the supplied id'
);

select * from finish();

rollback;
