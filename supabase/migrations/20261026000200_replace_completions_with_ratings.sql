create table private.book_chat_completions_backup_20261026 as
select * from public.book_chat_completions;

create table private.book_chat_reading_progresses_backup_20261026 as
select * from public.book_chat_reading_progresses;

revoke all on table private.book_chat_completions_backup_20261026 from public, anon, authenticated;
revoke all on table private.book_chat_reading_progresses_backup_20261026 from public, anon, authenticated;

drop function if exists public.upsert_book_chat_reading_progress(uuid, integer, integer);
drop table public.book_chat_reading_progresses;

drop function if exists public.upsert_book_chat_completion(uuid, smallint, text);
drop function if exists public.remove_book_chat_completion(uuid);

delete from public.book_chat_completions where rating is null;

alter table public.book_chat_completions rename to book_chat_ratings;
alter table public.book_chat_ratings drop column completed_at;
alter table public.book_chat_ratings alter column rating set not null;
alter table public.book_chat_ratings
  rename constraint book_chat_completions_book_chat_profile_unique to book_chat_ratings_book_chat_profile_unique;
alter table public.book_chat_ratings
  rename constraint book_chat_completions_rating_range to book_chat_ratings_rating_range;
alter table public.book_chat_ratings
  rename constraint book_chat_completions_review_length to book_chat_ratings_review_length;
alter trigger book_chat_completions_set_updated_at on public.book_chat_ratings
  rename to book_chat_ratings_set_updated_at;
alter policy book_chat_completions_select_own_or_room_member on public.book_chat_ratings
  rename to book_chat_ratings_select_own_or_room_member;

create index book_chat_ratings_profile_updated_at_idx
on public.book_chat_ratings (profile_id, updated_at desc);

delete from public.notification_push_outbox
where notification_id in (select id from public.notifications where type = 'completion');
delete from public.notifications where type = 'completion';

create or replace function public.upsert_book_chat_rating(
  p_book_chat_id uuid,
  p_rating smallint,
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

  if p_rating is null or p_rating not between 1 and 5 or char_length(coalesce(v_review, '')) > 1000 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select * into v_chat
  from public.book_chats
  where book_chats.id = p_book_chat_id and book_chats.deleted_at is null
  for update;

  if v_chat.id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  if v_chat.status = 'archived' then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_ARCHIVED';
  end if;

  if not private.is_active_room_member(v_chat.room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  insert into public.book_chat_ratings (book_chat_id, profile_id, rating, review)
  values (p_book_chat_id, auth.uid(), p_rating, v_review)
  on conflict (book_chat_id, profile_id)
  do update set rating = excluded.rating, review = excluded.review, updated_at = now();
end;
$$;

create or replace function public.remove_book_chat_rating(p_book_chat_id uuid)
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

  select * into v_chat
  from public.book_chats
  where book_chats.id = p_book_chat_id and book_chats.deleted_at is null
  for update;

  if v_chat.id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  if v_chat.status = 'archived' then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_ARCHIVED';
  end if;

  if not private.is_active_room_member(v_chat.room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  delete from public.book_chat_ratings
  where book_chat_ratings.book_chat_id = p_book_chat_id
    and book_chat_ratings.profile_id = auth.uid();
end;
$$;

revoke all on function public.upsert_book_chat_rating(uuid, smallint, text) from public, anon;
revoke all on function public.remove_book_chat_rating(uuid) from public, anon;
grant execute on function public.upsert_book_chat_rating(uuid, smallint, text) to authenticated;
grant execute on function public.remove_book_chat_rating(uuid) to authenticated;

comment on function public.upsert_book_chat_rating(uuid, smallint, text) is
  '활성 책방 멤버의 책 별점과 선택 총평을 저장하거나 수정하며 보관된 책 대화 변경을 거부한다.';
comment on function public.remove_book_chat_rating(uuid) is
  '활성 책방 멤버가 자신의 책 별점 기록을 삭제하며 보관된 책 대화 변경을 거부한다.';
