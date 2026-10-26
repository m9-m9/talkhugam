begin;

\ir ../helpers/auth.inc

select plan(14);

select has_table('public', 'user_legal_consents', 'legal consent table should exist');
select col_is_fk(
  'public',
  'user_legal_consents',
  'profile_id',
  'legal consent records should belong to a profile'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_legal_consents'::regclass),
  'legal consent records should have RLS enabled'
);
select is(
  has_table_privilege('authenticated', 'public.user_legal_consents', 'INSERT'),
  false,
  'users should record required consents only through the narrow RPC'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000165',
  'consent-owner@test.local',
  '동의 사용자'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000166',
  'consent-stranger@test.local',
  '외부 사용자'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000165');
set local role authenticated;

select lives_ok(
  $$ select public.record_required_legal_consents('2026-10-26.1', '2026-10-26.1') $$,
  'an authenticated user should record the canonical required document versions'
);
select is(
  (select count(*) from public.user_legal_consents),
  2::bigint,
  'a consent action should create one row for each required document'
);
select lives_ok(
  $$ select public.record_required_legal_consents('2026-10-26.1', '2026-10-26.1') $$,
  'recording an already accepted version should be idempotent'
);
select is(
  (select count(*) from public.user_legal_consents),
  2::bigint,
  'the same consent version should not create duplicate rows'
);
select throws_ok(
  $$ select public.record_required_legal_consents('2026-07-18', '2026-10-26.1') $$,
  'P0001',
  'LEGAL_DOCUMENT_VERSION_REQUIRED',
  'an outdated document version should be rejected'
);
select lives_ok(
  $$ select public.record_required_legal_consents('2026-07-18.2', '2026-07-18.2') $$,
  'the previous 2026-07-18.2 version should still be accepted during the rollout transition'
);
select is(
  (select count(*) from public.user_legal_consents where document_version = '2026-07-18.2'),
  2::bigint,
  'a transition-period consent should be recorded under the previous version'
);
select throws_ok(
  $$ select public.record_required_legal_consents('2026-10-26.1', 'arbitrary-version') $$,
  'P0001',
  'LEGAL_DOCUMENT_VERSION_REQUIRED',
  'an arbitrary document version should be rejected'
);
select throws_ok(
  $$ select public.record_required_legal_consents('arbitrary-version', 'arbitrary-version') $$,
  'P0001',
  'LEGAL_DOCUMENT_VERSION_REQUIRED',
  'an arbitrary version pair should be rejected even during the transition'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000166');
set local role authenticated;

select is_empty(
  $$ select * from public.user_legal_consents $$,
  'another user should not read consent records they do not own'
);

select * from finish();

rollback;
