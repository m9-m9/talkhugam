begin;

\ir ../helpers/auth.inc

select plan(20);

select has_table('public', 'notifications', 'notifications table should exist');
select has_table(
  'public',
  'notification_preferences',
  'notification_preferences table should exist'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000181',
  'notification-owner@test.local',
  '알림 방장'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000182',
  'notification-member@test.local',
  '알림 멤버'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000183',
  'notification-outsider@test.local',
  '알림 외부 사용자'
);

select is(
  (select count(*) from public.notification_preferences),
  3::bigint,
  'creating profiles should create default notification preferences'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000081',
  '알림 테스트 방',
  '00000000-0000-0000-0000-000000000181'
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
    '20000000-0000-0000-0000-000000000081',
    '10000000-0000-0000-0000-000000000081',
    '00000000-0000-0000-0000-000000000181',
    'owner',
    '알림 방장'
  ),
  (
    '20000000-0000-0000-0000-000000000082',
    '10000000-0000-0000-0000-000000000081',
    '00000000-0000-0000-0000-000000000182',
    'member',
    '알림 멤버'
  );

insert into public.books (id, source, title)
values ('40000000-0000-0000-0000-000000000081', 'manual', '알림 테스트 책');

insert into public.book_chats (id, room_id, book_id, created_by_member_id, name)
values (
  '50000000-0000-0000-0000-000000000081',
  '10000000-0000-0000-0000-000000000081',
  '40000000-0000-0000-0000-000000000081',
  '20000000-0000-0000-0000-000000000081',
  '알림 테스트 채팅'
);

insert into public.posts (
  id,
  book_chat_id,
  author_member_id,
  type,
  body,
  client_id,
  author_name_snapshot
)
values (
  '60000000-0000-0000-0000-000000000081',
  '50000000-0000-0000-0000-000000000081',
  '20000000-0000-0000-0000-000000000081',
  'text',
  '알림을 발생시키는 원문',
  '70000000-0000-0000-0000-000000000081',
  '알림 방장'
);

create temporary table reply_notification as
select private.enqueue_notification(
  '00000000-0000-0000-0000-000000000182',
  'reply',
  '20000000-0000-0000-0000-000000000081',
  '10000000-0000-0000-0000-000000000081',
  '60000000-0000-0000-0000-000000000081'
) as id;

grant select on reply_notification to authenticated;

select isnt(
  (select id from reply_notification),
  null::uuid,
  'an enabled reply notification should be created'
);
select is(
  private.enqueue_notification(
    '00000000-0000-0000-0000-000000000181',
    'reply',
    '20000000-0000-0000-0000-000000000081',
    '10000000-0000-0000-0000-000000000081',
    '60000000-0000-0000-0000-000000000081'
  ),
  null::uuid,
  'an actor should not receive a self notification'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000182');
set local role authenticated;

select lives_ok(
  $$
    update public.notification_preferences
    set mentions_enabled = false
    where profile_id = '00000000-0000-0000-0000-000000000182'
  $$,
  'a user should update their own notification preferences'
);
select is_empty(
  $$
    update public.notification_preferences
    set mentions_enabled = false
    where profile_id = '00000000-0000-0000-0000-000000000181'
    returning profile_id
  $$,
  'a user should not update another profile preferences'
);

reset role;

select is(
  private.enqueue_notification(
    '00000000-0000-0000-0000-000000000182',
    'mention',
    '20000000-0000-0000-0000-000000000081',
    '10000000-0000-0000-0000-000000000081',
    '60000000-0000-0000-0000-000000000081'
  ),
  null::uuid,
  'a disabled mention category should suppress notification creation'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000181');
set local role authenticated;

select lives_ok(
  $$
    select public.transfer_room_ownership(
      '10000000-0000-0000-0000-000000000081',
      '20000000-0000-0000-0000-000000000082'
    )
  $$,
  'ownership transfer should create a room event notification'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000182');
set local role authenticated;

select is((select count(*) from public.notifications), 2::bigint, 'a recipient should select only their notifications');
select is(
  (select count(*) from public.notifications where type = 'ownership_transfer'),
  1::bigint,
  'ownership transfer should notify the new owner'
);
select is(
  public.mark_notifications_read(array[(select id from reply_notification)], null),
  1,
  'a recipient should mark a notification by id'
);
select is(
  public.mark_notifications_read(array[(select id from reply_notification)], null),
  0,
  'marking an already read notification should be idempotent'
);
select is(
  public.mark_notifications_read(null, now()),
  1,
  'a recipient should mark remaining notifications by cursor'
);
select is(
  (select count(*) from public.notifications where read_at is null),
  0::bigint,
  'the recipient should have no unread notifications'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000181');
set local role authenticated;

select is((select count(*) from public.notifications), 0::bigint, 'the actor should not select recipient notifications');
select is(
  public.mark_notifications_read(array[(select id from reply_notification)], null),
  0,
  'the actor should not mark recipient notifications'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000183');
set local role authenticated;

select is((select count(*) from public.notifications), 0::bigint, 'an unrelated user should not select notifications');
select throws_ok(
  $$
    insert into public.notifications (recipient_profile_id, type)
    values ('00000000-0000-0000-0000-000000000183', 'system')
  $$,
  '42501',
  null,
  'an authenticated user should not insert notifications directly'
);

reset role;
set local role anon;

select throws_ok(
  $$select * from public.notifications$$,
  '42501',
  null,
  'anon should not select notifications'
);

reset role;

select * from finish();

rollback;
