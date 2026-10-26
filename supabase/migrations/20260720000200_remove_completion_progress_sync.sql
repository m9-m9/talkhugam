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
  v_actor_member_id uuid;
  v_completion_id uuid;
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

  select id
  into v_actor_member_id
  from public.room_members
  where room_id = v_chat.room_id
    and profile_id = auth.uid()
    and status = 'active';

  if v_actor_member_id is null then
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
  on conflict (book_chat_id, profile_id) do nothing
  returning id into v_completion_id;

  if v_completion_id is null then
    update public.book_chat_completions
    set
      rating = p_rating,
      review = v_review,
      updated_at = now()
    where book_chat_id = p_book_chat_id
      and profile_id = auth.uid();

    return;
  end if;

  perform private.enqueue_book_chat_activity_notifications(
    p_book_chat_id,
    'completion',
    v_actor_member_id
  );
end;
$$;

comment on function public.upsert_book_chat_completion(uuid, smallint, text) is
  '활성 책방 멤버의 개인 완독 기록을 저장하고 최초 완독일 때만 책방 멤버에게 알린다.';
