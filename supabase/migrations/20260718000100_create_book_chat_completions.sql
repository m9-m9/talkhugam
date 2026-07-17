create table public.book_chat_completions (
  id uuid primary key default gen_random_uuid(),
  book_chat_id uuid not null references public.book_chats (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  rating smallint,
  review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint book_chat_completions_book_chat_profile_unique
    unique (book_chat_id, profile_id),
  constraint book_chat_completions_rating_range
    check (rating is null or rating between 1 and 5),
  constraint book_chat_completions_review_length
    check (review is null or char_length(review) <= 1000)
);

create index book_chat_completions_profile_completed_at_idx
on public.book_chat_completions (profile_id, completed_at desc);

create trigger book_chat_completions_set_updated_at
before update on public.book_chat_completions
for each row execute function private.set_updated_at();

alter table public.book_chat_completions enable row level security;

revoke all on table public.book_chat_completions from anon, authenticated;
grant select on table public.book_chat_completions to authenticated;

create policy book_chat_completions_select_own_or_room_member
on public.book_chat_completions
for select
to authenticated
using (
  profile_id = auth.uid()
  or private.can_access_book_chat(book_chat_id)
);

create or replace function public.upsert_book_chat_completion(
  p_book_chat_id uuid,
  p_rating smallint default null,
  p_review text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_chat public.book_chats%rowtype;
  v_review text := nullif(btrim(p_review), '');
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select *
  into v_chat
  from public.book_chats
  where id = p_book_chat_id
    and deleted_at is null
  for update;

  if v_chat.id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  if not private.is_active_room_member(v_chat.room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if p_rating is not null and p_rating not between 1 and 5 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if v_review is not null and char_length(v_review) > 1000 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  insert into public.book_chat_completions (
    book_chat_id,
    profile_id,
    rating,
    review
  )
  values (
    p_book_chat_id,
    auth.uid(),
    p_rating,
    v_review
  )
  on conflict (book_chat_id, profile_id) do update
  set
    rating = excluded.rating,
    review = excluded.review,
    updated_at = now();
end;
$$;

create or replace function public.remove_book_chat_completion(
  p_book_chat_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_chat public.book_chats%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select *
  into v_chat
  from public.book_chats
  where id = p_book_chat_id
    and deleted_at is null
  for update;

  if v_chat.id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  if not private.is_active_room_member(v_chat.room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  delete from public.book_chat_completions
  where book_chat_id = p_book_chat_id
    and profile_id = auth.uid();
end;
$$;

revoke all on function public.upsert_book_chat_completion(uuid, smallint, text)
from public, anon;
revoke all on function public.remove_book_chat_completion(uuid)
from public, anon;

grant execute on function public.upsert_book_chat_completion(uuid, smallint, text)
to authenticated;
grant execute on function public.remove_book_chat_completion(uuid)
to authenticated;

comment on table public.book_chat_completions is
  '독서방 멤버가 책 대화방별로 남기는 개인 완독 시점과 선택 총평을 보관한다.';
comment on function public.upsert_book_chat_completion(uuid, smallint, text) is
  '활성 독서방 멤버의 개인 완독 기록과 선택 별점·총평을 생성하거나 수정한다.';
comment on function public.remove_book_chat_completion(uuid) is
  '활성 독서방 멤버가 자신의 개인 완독 기록을 삭제한다.';
