begin;

\ir ../helpers/auth.inc

select plan(17);

select has_table('public', 'books', 'books table should exist');
select has_table('public', 'book_chats', 'book_chats table should exist');
select ok(
  (select indisunique from pg_index where indexrelid = 'public.books_isbn13_unique'::regclass),
  'isbn13 should have a unique partial index'
);
select ok(
  (select indisunique from pg_index where indexrelid = 'public.books_isbn10_unique'::regclass),
  'isbn10 should have a unique partial index'
);

select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000161',
  'book-member@test.local',
  '책 멤버'
);
select tests.create_supabase_user(
  '00000000-0000-0000-0000-000000000162',
  'book-stranger@test.local',
  '책 외부 사용자'
);

insert into public.reading_rooms (id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000061',
  '도서 테스트 방',
  '00000000-0000-0000-0000-000000000161'
);

insert into public.room_members (
  id,
  room_id,
  profile_id,
  role,
  room_display_name
)
values (
  '20000000-0000-0000-0000-000000000061',
  '10000000-0000-0000-0000-000000000061',
  '00000000-0000-0000-0000-000000000161',
  'owner',
  '책 멤버'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000161');

create temporary table first_chat as
select *
from public.create_book_chat(
  '10000000-0000-0000-0000-000000000061',
  'kakao',
  '미움받을 용기',
  '첫 번째 대화',
  array['기시미 이치로', '고가 후미타케'],
  '8996991341',
  '9788996991342',
  '인플루엔셜',
  '2014-11-17',
  'https://example.com/cover.jpg',
  'https://example.com/book'
);

create temporary table second_chat as
select *
from public.create_book_chat(
  '10000000-0000-0000-0000-000000000061',
  'kakao',
  '미움받을 용기',
  '두 번째 대화',
  array['기시미 이치로', '고가 후미타케'],
  '8996991341',
  '9788996991342',
  '인플루엔셜',
  '2014-11-17',
  'https://example.com/cover.jpg',
  'https://example.com/book'
);

select is(
  (select book_id from first_chat),
  (select book_id from second_chat),
  'matching ISBN should reuse the book row'
);
select isnt(
  (select book_chat_id from first_chat),
  (select book_chat_id from second_chat),
  'the same book should allow multiple chat rooms'
);
select is((select count(*) from public.books), 1::bigint, 'ISBN upsert should keep one book');
select is((select count(*) from public.book_chats), 2::bigint, 'two book chats should be created');

select lives_ok(
  format(
    'select public.set_book_chat_status(%L::uuid, %L::public.book_chat_status)',
    (select book_chat_id from first_chat),
    'completed'
  ),
  'an active member should complete a book chat'
);
select ok(
  (
    select completed_at is not null
    from public.book_chats
    where id = (select book_chat_id from first_chat)
  ),
  'completing should set completed_at'
);
select lives_ok(
  format(
    'select public.set_book_chat_status(%L::uuid, %L::public.book_chat_status)',
    (select book_chat_id from first_chat),
    'archived'
  ),
  'an active member should archive a book chat'
);
select ok(
  (
    select archived_at is not null
    from public.book_chats
    where id = (select book_chat_id from first_chat)
  ),
  'archiving should set archived_at'
);
select lives_ok(
  format(
    'select public.set_book_chat_status(%L::uuid, %L::public.book_chat_status)',
    (select book_chat_id from first_chat),
    'reading'
  ),
  'an archived book chat should be restorable'
);
select ok(
  (
    select completed_at is null and archived_at is null
    from public.book_chats
    where id = (select book_chat_id from first_chat)
  ),
  'restoring to reading should clear completion and archive timestamps'
);

select tests.authenticate_as('00000000-0000-0000-0000-000000000162');
set local role authenticated;

select is((select count(*) from public.books), 0::bigint, 'a non-member should not select books');
select is((select count(*) from public.book_chats), 0::bigint, 'a non-member should not select chats');
select throws_ok(
  $$
    select *
    from public.create_book_chat(
      '10000000-0000-0000-0000-000000000061',
      'manual',
      '침범 도서',
      '침범 대화'
    )
  $$,
  'P0001',
  'ROOM_FORBIDDEN',
  'a non-member should not create a book chat in another room'
);

reset role;

select * from finish();

rollback;
