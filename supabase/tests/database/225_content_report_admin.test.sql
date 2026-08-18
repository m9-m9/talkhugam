begin;

select plan(13);

select has_table('public', 'content_report_actions', '신고 조치 이력 테이블이 존재해야 한다');
select is(has_table_privilege('authenticated', 'public.content_report_actions', 'SELECT'), false, '신고 조치 이력 원본은 인증 사용자에게 직접 노출되지 않아야 한다');
select has_function('public', 'list_content_reports', '운영자 신고 목록 RPC가 존재해야 한다');
select has_function('public', 'update_content_report', '운영자 신고 상태 변경 RPC가 존재해야 한다');

select tests.create_supabase_user('00000000-0000-0000-0000-000000000291', 'reporter@test.local', '신고자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000292', 'operator@test.local', '운영자');
select tests.create_supabase_user('00000000-0000-0000-0000-000000000293', 'outsider@test.local', '외부');

insert into public.admin_users (profile_id) values ('00000000-0000-0000-0000-000000000292');
insert into public.content_reports (reporter_profile_id, target_type, target_id, reason)
values ('00000000-0000-0000-0000-000000000291', 'profile', '00000000-0000-0000-0000-000000000293', '운영자 확인이 필요해요');

select tests.authenticate_as('00000000-0000-0000-0000-000000000293');
set local role authenticated;

select throws_ok(
  $$select * from public.list_content_reports()$$,
  'P0001', 'ADMIN_FORBIDDEN',
  '일반 사용자는 신고 운영함을 조회할 수 없어야 한다'
);
select throws_ok(
  $$select * from public.update_content_report((select id from public.content_reports limit 1), 'reviewing')$$,
  'P0001', 'ADMIN_FORBIDDEN',
  '일반 사용자는 신고 상태를 바꿀 수 없어야 한다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000292');
set local role authenticated;

select is((select count(*) from public.list_content_reports('open')), 1::bigint, '운영자는 열린 신고와 신고 사유를 목록에서 조회할 수 있어야 한다');
select lives_ok(
  $$select * from public.update_content_report((select id from public.content_reports limit 1), 'reviewing')$$,
  '운영자는 신고를 검토 상태로 바꿀 수 있어야 한다'
);
select is((select count(*) from public.content_report_actions), 1::bigint, '상태 변경은 조치 이력으로 남아야 한다');
select throws_ok(
  $$select * from public.update_content_report((select id from public.content_reports limit 1), 'resolved')$$,
  'P0001', 'VALIDATION_FAILED',
  '종결에는 빈 조치 메모를 허용하지 않아야 한다'
);
select lives_ok(
  $$select * from public.update_content_report((select id from public.content_reports limit 1), 'resolved', '검토 후 조치 완료')$$,
  '운영자는 종결 메모와 함께 신고를 처리할 수 있어야 한다'
);
select is((select resolution_note from public.content_reports), '검토 후 조치 완료', '종결 메모가 신고 원본에 저장되어야 한다');
select is((select count(*) from public.content_report_actions), 2::bigint, '종결도 별도 조치 이력으로 남아야 한다');

reset role;
select * from finish();

rollback;
