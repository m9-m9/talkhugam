begin;

\ir ../helpers/auth.inc

select plan(12);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000371',
  'manager-owner@test.local',
  '운영 권한 방장'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000372',
  'manager-operator@test.local',
  '운영 권한 운영자'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000373',
  'manager-member@test.local',
  '운영 권한 참여자'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000371',
  '운영 권한 테스트 방',
  '00000000-0000-0000-0000-000000000371'
);

insert into public.room_members (id, room_id, profile_id, role, room_display_name)
values
  (
    '20000000-0000-0000-0000-000000000371',
    '10000000-0000-0000-0000-000000000371',
    '00000000-0000-0000-0000-000000000371',
    'owner',
    '운영 권한 방장'
  ),
  (
    '20000000-0000-0000-0000-000000000372',
    '10000000-0000-0000-0000-000000000371',
    '00000000-0000-0000-0000-000000000372',
    'member',
    '운영 권한 운영자'
  ),
  (
    '20000000-0000-0000-0000-000000000373',
    '10000000-0000-0000-0000-000000000371',
    '00000000-0000-0000-0000-000000000373',
    'member',
    '운영 권한 참여자'
  );

select has_function(
  'public',
  'update_room_member_role',
  array['uuid', 'uuid', 'member_role'],
  '방장은 멤버 역할을 변경하는 RPC를 사용할 수 있다'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000371');
set local role authenticated;

select lives_ok(
  $$
    select public.update_room_member_role(
      '10000000-0000-0000-0000-000000000371',
      '20000000-0000-0000-0000-000000000372',
      'manager'
    )
  $$,
  '방장은 참여자를 운영자로 승격할 수 있다'
);
select is(
  (
    select role
    from public.room_members
    where id = '20000000-0000-0000-0000-000000000372'
  ),
  'manager'::public.member_role,
  '승격된 멤버는 운영자 역할을 가진다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000372');
set local role authenticated;

select lives_ok(
  $$
    select * from public.create_room_invite(
      '10000000-0000-0000-0000-000000000371',
      interval '1 day',
      1::smallint
    )
  $$,
  '운영자는 초대 코드를 만들 수 있다'
);
create temporary table operator_book_chat as
select * from public.create_book_chat(
  '10000000-0000-0000-0000-000000000371',
  'manual',
  '운영자가 등록한 책',
  '운영자 책 대화'
);
select ok(
  (select book_chat_id is not null from operator_book_chat),
  '운영자는 읽을 책을 등록할 수 있다'
);
select lives_ok(
  format(
    'select public.set_book_chat_status(%L::uuid, %L::public.book_chat_status)',
    (select book_chat_id from operator_book_chat),
    'completed'
  ),
  '운영자는 책 대화를 완독으로 변경할 수 있다'
);
select throws_ok(
  $$
    select public.update_room_member_role(
      '10000000-0000-0000-0000-000000000371',
      '20000000-0000-0000-0000-000000000373',
      'manager'
    )
  $$,
  'P0001',
  'ROOM_FORBIDDEN',
  '운영자는 다른 참여자의 역할을 바꿀 수 없다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000373');
set local role authenticated;

select throws_ok(
  $$
    select * from public.create_room_invite(
      '10000000-0000-0000-0000-000000000371',
      interval '1 day',
      1::smallint
    )
  $$,
  'P0001',
  'ROOM_FORBIDDEN',
  '참여자는 초대 코드를 만들 수 없다'
);
select throws_ok(
  $$
    select * from public.create_book_chat(
      '10000000-0000-0000-0000-000000000371',
      'manual',
      '참여자가 등록한 책',
      '참여자 책 대화'
    )
  $$,
  'P0001',
  'ROOM_FORBIDDEN',
  '참여자는 읽을 책을 바로 등록할 수 없다'
);
select throws_ok(
  format(
    'select public.set_book_chat_status(%L::uuid, %L::public.book_chat_status)',
    (select book_chat_id from operator_book_chat),
    'archived'
  ),
  'P0001',
  'ROOM_FORBIDDEN',
  '참여자는 책 대화 상태를 변경할 수 없다'
);

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-000000000371');
set local role authenticated;

select lives_ok(
  $$
    select public.update_room_member_role(
      '10000000-0000-0000-0000-000000000371',
      '20000000-0000-0000-0000-000000000372',
      'member'
    )
  $$,
  '방장은 운영자를 다시 참여자로 변경할 수 있다'
);
select is(
  (
    select role
    from public.room_members
    where id = '20000000-0000-0000-0000-000000000372'
  ),
  'member'::public.member_role,
  '권한 변경은 참여자 역할로 저장된다'
);

reset role;

select * from finish();

rollback;
