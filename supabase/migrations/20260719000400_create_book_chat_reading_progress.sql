create table public.book_chat_reading_progresses (
  book_chat_id uuid not null references public.book_chats (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  current_page integer not null,
  total_pages integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (book_chat_id, profile_id),
  constraint book_chat_reading_progresses_page_range
    check (current_page between 0 and total_pages),
  constraint book_chat_reading_progresses_total_pages_positive
    check (total_pages > 0)
);

create index book_chat_reading_progresses_profile_updated_at_idx
on public.book_chat_reading_progresses (profile_id, updated_at desc);

create trigger book_chat_reading_progresses_set_updated_at
before update on public.book_chat_reading_progresses
for each row execute function private.set_updated_at();

alter table public.book_chat_reading_progresses enable row level security;

revoke all on table public.book_chat_reading_progresses from anon, authenticated;
grant select on table public.book_chat_reading_progresses to authenticated;

create policy book_chat_reading_progresses_select_owner
on public.book_chat_reading_progresses
for select
to authenticated
using (profile_id = (select auth.uid()));

create or replace function public.upsert_book_chat_reading_progress(
  p_book_chat_id uuid,
  p_current_page integer,
  p_total_pages integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_room_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_total_pages <= 0 or p_current_page < 0 or p_current_page > p_total_pages then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select room_id
  into v_room_id
  from public.book_chats
  where id = p_book_chat_id
    and status = 'reading'
    and deleted_at is null;

  if v_room_id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  if not private.is_active_room_member(v_room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  insert into public.book_chat_reading_progresses (
    book_chat_id,
    profile_id,
    current_page,
    total_pages
  )
  values (
    p_book_chat_id,
    auth.uid(),
    p_current_page,
    p_total_pages
  )
  on conflict (book_chat_id, profile_id) do update
  set
    current_page = excluded.current_page,
    total_pages = excluded.total_pages,
    updated_at = now();
end;
$$;

revoke all on function public.upsert_book_chat_reading_progress(uuid, integer, integer)
from public, anon;
grant execute on function public.upsert_book_chat_reading_progress(uuid, integer, integer)
to authenticated;

comment on table public.book_chat_reading_progresses is
  '책방 멤버가 책 대화별로 보관하는 개인 독서 진행 페이지와 전체 페이지 수다.';
comment on function public.upsert_book_chat_reading_progress(uuid, integer, integer) is
  '활성 책방 멤버가 자신의 현재·전체 독서 페이지를 검증해 생성하거나 수정한다.';
