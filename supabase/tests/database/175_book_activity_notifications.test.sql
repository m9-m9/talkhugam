begin;

\ir ../helpers/auth.inc

select plan(17);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000871',
  'activity-author@test.local',
  '활동 작성자'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000872',
  'activity-reader@test.local',
  '활동 독자'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000873',
  'activity-mentioned@test.local',
  '활동 멘션'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000874',
  'activity-muted@test.local',
  '활동 알림끔'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000875',
  'activity-outsider@test.local',
  '활동 외부'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000871',
  '책 활동 알림 책방',
  '00000000-0000-0000-0000-000000000871'
);

insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values
  (
    '20000000-0000-0000-0000-000000000871',
    '10000000-0000-0000-0000-000000000871',
    '00000000-0000-0000-0000-000000000871',
    'owner',
    '활동 작성자'
  ),
  (
    '20000000-0000-0000-0000-000000000872',
    '10000000-0000-0000-0000-000000000871',
    '00000000-0000-0000-0000-000000000872',
    'member',
    '활동 독자'
  ),
  (
    '20000000-0000-0000-0000-000000000873',
    '10000000-0000-0000-0000-000000000871',
    '00000000-0000-0000-0000-000000000873',
    'member',
    '활동 멘션'
  ),
  (
    '20000000-0000-0000-0000-000000000874',
    '10000000-0000-0000-0000-000000000871',
    '00000000-0000-0000-0000-000000000874',
    'member',
    '활동 알림끔'
  );

insert into public.books (id, source, title)
values ('30000000-0000-0000-0000-000000000871', 'manual', '활동 알림 테스트 책');

insert into public.book_chats (id, room_id, book_id, created_by_member_id, name)
values (
  '40000000-0000-0000-0000-000000000871',
  '10000000-0000-0000-0000-000000000871',
  '30000000-0000-0000-0000-000000000871',
  '20000000-0000-0000-0000-000000000871',
  '활동 알림 책 대화'
);

update public.notification_preferences
set room_events_enabled = false
where profile_id = '00000000-0000-0000-0000-000000000874';

select tests.authenticate_as('00000000-0000-0000-0000-000000000871');
set local role authenticated;

create temporary table text_post as
select public.create_post(
  '40000000-0000-0000-0000-000000000871',
  '50000000-0000-0000-0000-000000000871',
  'text',
  '오늘의 독후감이에요.',
  '[]'::jsonb,
  array['20000000-0000-0000-0000-000000000873'::uuid]
) as id;

reset role;

select is(
  (select count(*) from public.notifications where type = 'post'),
  1::bigint,
  '새 독후감은 멘션을 제외한 책방 멤버에게 한 번 알린다'
);
select is(
  (
    select recipient_profile_id
    from public.notifications
    where type = 'post'
  ),
  '00000000-0000-0000-0000-000000000872'::uuid,
  '새 독후감 알림은 일반 책방 멤버에게 전달한다'
);
select is(
  (select count(*) from public.notifications where type = 'mention'),
  1::bigint,
  '멘션 대상은 기존 멘션 알림만 받는다'
);
select is(
  (select count(*) from public.notifications where recipient_profile_id = '00000000-0000-0000-0000-000000000874'),
  0::bigint,
  '책방 알림을 끈 멤버에게는 책 활동 알림을 만들지 않는다'
);
select is(
  (
    select book_chat_id
    from public.notifications
    where type = 'post'
  ),
  '40000000-0000-0000-0000-000000000871'::uuid,
  '새 독후감 알림은 이동할 책 대화를 보관한다'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000871');
set local role authenticated;

create temporary table video_post as
select public.create_post(
  '40000000-0000-0000-0000-000000000871',
  '70000000-0000-0000-0000-000000000871',
  'video',
  null,
  '[]'::jsonb,
  '{}'::uuid[]
) as id;

reset role;

insert into public.video_assets (post_id, mux_upload_id)
select id, 'activity-upload-871'
from video_post;

select is(
  public.apply_mux_video_event(
    'activity-ready-871',
    'video.asset.ready',
    (select id from video_post),
    'ready',
    'activity-asset-871',
    'activity-asset-871',
    'activity-playback-871',
    20,
    '9:16'
  ),
  true,
  '준비가 완료된 영상 이벤트를 적용한다'
);
select is(
  (select count(*) from public.notifications where type = 'video'),
  2::bigint,
  '준비가 완료된 영상은 알림을 켠 다른 책방 멤버에게만 알린다'
);
select is(
  (
    select count(*)
    from public.notifications
    where type = 'video'
      and book_chat_id = '40000000-0000-0000-0000-000000000871'
  ),
  2::bigint,
  '영상 알림은 모두 해당 책 대화로 이동할 수 있다'
);
select is(
  public.apply_mux_video_event(
    'activity-ready-871',
    'video.asset.ready',
    (select id from video_post),
    'ready',
    'activity-asset-871',
    'activity-asset-871',
    'activity-playback-871',
    20,
    '9:16'
  ),
  false,
  '중복 Mux 이벤트는 영상 알림도 중복 생성하지 않는다'
);
select is(
  (select count(*) from public.notifications where type = 'video'),
  2::bigint,
  '중복 영상 이벤트 뒤에도 영상 알림 수가 유지된다'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000871');
set local role authenticated;

select lives_ok(
  $$
    select public.upsert_book_chat_completion(
      '40000000-0000-0000-0000-000000000871',
      5::smallint,
      '완독 총평'
    )
  $$,
  '첫 완독 기록을 저장할 수 있다'
);

reset role;

select is(
  (select count(*) from public.notifications where type = 'completion'),
  2::bigint,
  '첫 완독 기록은 알림을 켠 다른 책방 멤버에게만 알린다'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000871');
set local role authenticated;

select lives_ok(
  $$
    select public.upsert_book_chat_completion(
      '40000000-0000-0000-0000-000000000871',
      4::smallint,
      '수정한 총평'
    )
  $$,
  '기존 완독 기록을 수정할 수 있다'
);

reset role;

select is(
  (select count(*) from public.notifications where type = 'completion'),
  2::bigint,
  '완독 기록 수정은 새 책 활동 알림을 만들지 않는다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000872');
set local role authenticated;

select is(
  (select count(*) from public.notifications),
  3::bigint,
  '책방 멤버는 자신의 새 독후감·영상·완독 알림만 조회한다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000875');
set local role authenticated;

select is(
  (select count(*) from public.notifications),
  0::bigint,
  '책방 외부 사용자는 책 활동 알림을 조회하지 못한다'
);
select throws_ok(
  $$
    select public.upsert_book_chat_completion(
      '40000000-0000-0000-0000-000000000871',
      null,
      null
    )
  $$,
  'P0001',
  'ROOM_FORBIDDEN',
  '책방 외부 사용자는 완독 활동을 만들 수 없다'
);

reset role;

select * from finish();

rollback;
