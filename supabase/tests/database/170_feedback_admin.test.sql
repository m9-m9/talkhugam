begin;

\ir ../helpers/auth.inc

select plan(10);

select has_table('public', 'admin_users', 'operator allowlist should exist');
select has_table('public', 'feedback_tickets', 'feedback ticket inbox should exist');
select col_is_fk(
  'public',
  'feedback_tickets',
  'author_profile_id',
  'feedback tickets should belong to their author profile'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.feedback_tickets'::regclass),
  'feedback tickets should have RLS enabled'
);
select is(
  has_table_privilege('authenticated', 'public.feedback_tickets', 'SELECT'),
  false,
  'regular users should not query the operator inbox directly'
);
select is(
  has_table_privilege('authenticated', 'public.feedback_tickets', 'INSERT'),
  false,
  'regular users should create feedback only through the server boundary'
);
select has_function(
  'public',
  'is_current_user_admin',
  array[]::text[],
  'the browser should have a narrow operator access check'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000171',
  'feedback-member@test.local',
  '의견 사용자'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000172',
  'feedback-admin@test.local',
  '운영 사용자'
);

insert into public.admin_users (profile_id)
values ('00000000-0000-0000-0000-000000000172');

select tests.authenticate_as('00000000-0000-0000-0000-000000000171');
set local role authenticated;

select is(
  public.is_current_user_admin(),
  false,
  'a regular user should not be identified as an operator'
);
select is_empty(
  $$ select * from public.feedback_tickets $$,
  'a regular user should not read feedback tickets through RLS'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000172');
set local role authenticated;

select is(
  public.is_current_user_admin(),
  true,
  'an allowlisted user should be identified as an operator'
);
select is_empty(
  $$ select * from public.feedback_tickets $$,
  'an operator should still use the Edge Function instead of direct table access'
);

select * from finish();

rollback;
