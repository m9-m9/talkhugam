begin;

\ir ../helpers/auth.inc

select plan(19);

select has_table('public', 'device_tokens', '기기 토큰 테이블이 존재해야 한다');
select has_table('public', 'notification_push_outbox', '푸시 발송 outbox 테이블이 존재해야 한다');
select has_column(
  'public',
  'notification_preferences',
  'push_enabled',
  '푸시 전체 수신 설정 열이 존재해야 한다'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.device_tokens'::regclass),
  true,
  '기기 토큰 테이블은 RLS를 활성화해야 한다'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.notification_push_outbox'::regclass),
  true,
  '푸시 outbox 테이블은 RLS를 활성화해야 한다'
);
select is(
  has_table_privilege('authenticated', 'public.device_tokens', 'SELECT'),
  false,
  '인증 사용자는 기기 토큰을 직접 조회할 수 없어야 한다'
);
select is(
  has_table_privilege('authenticated', 'public.notification_push_outbox', 'SELECT'),
  false,
  '인증 사용자는 푸시 outbox를 직접 조회할 수 없어야 한다'
);
select is(
  has_column_privilege(
    'authenticated',
    'public.notification_preferences',
    'push_enabled',
    'UPDATE'
  ),
  true,
  '인증 사용자는 자신의 푸시 전체 수신 설정만 갱신할 수 있어야 한다'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000241',
  'push-owner@test.local',
  '푸시 소유자'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000242',
  'push-other@test.local',
  '푸시 다른 사용자'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000241');
set local role authenticated;

select lives_ok(
  $$select public.register_device_token('ExponentPushToken[push-owner-token]', 'ios')$$,
  '인증 사용자는 검증한 Expo 기기 토큰을 등록할 수 있어야 한다'
);
select throws_ok(
  $$select public.register_device_token('not-a-push-token', 'ios')$$,
  'P0001',
  'VALIDATION_FAILED',
  'Expo 형식이 아닌 기기 토큰은 거부해야 한다'
);
select throws_ok(
  $$select public.register_device_token('ExponentPushToken[push-owner-token]', 'web')$$,
  'P0001',
  'VALIDATION_FAILED',
  'iOS와 Android 외 플랫폼은 거부해야 한다'
);

reset role;

select is(
  (
    select profile_id
    from public.device_tokens
    where expo_push_token = 'ExponentPushToken[push-owner-token]'
  ),
  '00000000-0000-0000-0000-000000000241'::uuid,
  '등록한 토큰은 현재 인증 사용자에게만 연결해야 한다'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000242');
set local role authenticated;

select lives_ok(
  $$select public.revoke_device_token('ExponentPushToken[push-owner-token]')$$,
  '다른 사용자의 토큰 해제 요청은 정보를 노출하지 않고 종료해야 한다'
);

reset role;

select is(
  (
    select revoked_at is null
    from public.device_tokens
    where expo_push_token = 'ExponentPushToken[push-owner-token]'
  ),
  true,
  '다른 사용자는 소유하지 않은 토큰을 해제할 수 없어야 한다'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000241');
set local role authenticated;

select lives_ok(
  $$select public.revoke_device_token('ExponentPushToken[push-owner-token]')$$,
  '토큰 소유자는 자신의 토큰을 해제할 수 있어야 한다'
);

reset role;

select ok(
  (
    select revoked_at is not null
    from public.device_tokens
    where expo_push_token = 'ExponentPushToken[push-owner-token]'
  ),
  '토큰 소유자의 해제는 활성 상태를 제거해야 한다'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000241',
  '푸시 outbox 테스트 방',
  '00000000-0000-0000-0000-000000000241'
);

insert into public.notifications (recipient_profile_id, room_id, type)
values (
  '00000000-0000-0000-0000-000000000241',
  '10000000-0000-0000-0000-000000000241',
  'reply'
);

select is(
  (select count(*) from public.notification_push_outbox),
  1::bigint,
  '새 답글 알림은 worker용 outbox 작업 하나를 만들어야 한다'
);
select is(
  (select status from public.notification_push_outbox limit 1),
  'pending',
  '새 outbox 작업은 pending 상태에서 시작해야 한다'
);

update public.notification_preferences
set push_enabled = false
where profile_id = '00000000-0000-0000-0000-000000000241';

insert into public.notifications (recipient_profile_id, room_id, type)
values (
  '00000000-0000-0000-0000-000000000241',
  '10000000-0000-0000-0000-000000000241',
  'mention'
);

select is(
  (select count(*) from public.notification_push_outbox),
  1::bigint,
  '푸시 전체 수신을 끄면 새 내부 알림의 outbox 작업을 만들지 않아야 한다'
);

select * from finish();

rollback;
