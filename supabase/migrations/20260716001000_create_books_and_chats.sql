create type public.book_source as enum ('kakao', 'manual');
create type public.book_chat_status as enum ('reading', 'completed', 'archived', 'deleted');

create table public.books (
  id uuid primary key default gen_random_uuid(),
  source public.book_source not null,
  isbn13 varchar(13),
  isbn10 varchar(10),
  title varchar(200) not null,
  authors text[] not null default '{}',
  publisher varchar(120),
  published_at date,
  thumbnail_url text,
  external_url text,
  created_at timestamptz not null default now(),
  constraint books_title_not_blank
    check (char_length(btrim(title)) between 1 and 200),
  constraint books_isbn13_format
    check (isbn13 is null or isbn13 ~ '^\d{13}$'),
  constraint books_isbn10_format
    check (isbn10 is null or isbn10 ~ '^\d{9}[\dX]$'),
  constraint books_publisher_length
    check (publisher is null or char_length(publisher) <= 120),
  constraint books_kakao_has_isbn
    check (source = 'manual' or isbn13 is not null or isbn10 is not null)
);

create table public.book_chats (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.reading_rooms (id) on delete cascade,
  book_id uuid not null references public.books (id),
  created_by_member_id uuid references public.room_members (id) on delete set null,
  name varchar(60) not null,
  status public.book_chat_status not null default 'reading',
  completed_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint book_chats_name_not_blank
    check (char_length(btrim(name)) between 1 and 60),
  constraint book_chats_status_timestamps
    check (
      (status = 'reading' and archived_at is null and deleted_at is null)
      or (status = 'completed' and completed_at is not null and archived_at is null and deleted_at is null)
      or (status = 'archived' and archived_at is not null and deleted_at is null)
      or (status = 'deleted' and deleted_at is not null)
    )
);

create unique index books_isbn13_unique
on public.books (isbn13)
where isbn13 is not null;

create unique index books_isbn10_unique
on public.books (isbn10)
where isbn10 is not null;

create index book_chats_room_status_created_at_idx
on public.book_chats (room_id, status, created_at desc)
where deleted_at is null;

create index book_chats_book_id_idx
on public.book_chats (book_id);

create trigger book_chats_set_updated_at
before update on public.book_chats
for each row execute function private.set_updated_at();

comment on table public.books is 'Minimal Kakao or manual book metadata; raw upstream payloads are not stored';
comment on table public.book_chats is 'Book-specific chat streams that inherit room membership';
