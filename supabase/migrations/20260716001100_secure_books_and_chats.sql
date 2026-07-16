create or replace function private.can_access_book_chat(p_book_chat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.book_chats
    where id = p_book_chat_id
      and deleted_at is null
      and private.is_active_room_member(room_id)
  );
$$;

create or replace function private.can_access_book(p_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.book_chats
    where book_id = p_book_id
      and deleted_at is null
      and private.is_active_room_member(room_id)
  );
$$;

revoke all on function private.can_access_book_chat(uuid) from public, anon;
revoke all on function private.can_access_book(uuid) from public, anon;
grant execute on function private.can_access_book_chat(uuid) to authenticated;
grant execute on function private.can_access_book(uuid) to authenticated;

alter table public.books enable row level security;
alter table public.book_chats enable row level security;

revoke all on table public.books from anon, authenticated;
revoke all on table public.book_chats from anon, authenticated;

grant select on table public.books to authenticated;
grant select on table public.book_chats to authenticated;

create policy books_select_accessible_chat
on public.books
for select
to authenticated
using (private.can_access_book(id));

create policy book_chats_select_active_room_member
on public.book_chats
for select
to authenticated
using (deleted_at is null and private.is_active_room_member(room_id));

create or replace function public.create_book_chat(
  p_room_id uuid,
  p_source public.book_source,
  p_title text,
  p_name text,
  p_authors text[] default '{}',
  p_isbn10 text default null,
  p_isbn13 text default null,
  p_publisher text default null,
  p_published_at date default null,
  p_thumbnail_url text default null,
  p_external_url text default null
)
returns table (book_id uuid, book_chat_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_member_id uuid;
  v_book_id uuid;
  v_book_chat_id uuid;
  v_isbn10 text := upper(regexp_replace(coalesce(p_isbn10, ''), '[^0-9X]', '', 'g'));
  v_isbn13 text := regexp_replace(coalesce(p_isbn13, ''), '[^0-9]', '', 'g');
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select member.id
  into v_member_id
  from public.room_members as member
  join public.reading_rooms as room on room.id = member.room_id
  where member.room_id = p_room_id
    and member.profile_id = auth.uid()
    and member.status = 'active'
    and room.status = 'active'
    and room.deleted_at is null;

  if v_member_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if char_length(btrim(p_title)) not between 1 and 200
    or char_length(btrim(p_name)) not between 1 and 60
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  v_isbn10 := nullif(v_isbn10, '');
  v_isbn13 := nullif(v_isbn13, '');

  if p_source = 'kakao' and v_isbn10 is null and v_isbn13 is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if v_isbn13 is not null then
    insert into public.books (
      source, isbn13, isbn10, title, authors, publisher,
      published_at, thumbnail_url, external_url
    )
    values (
      p_source, v_isbn13, v_isbn10, btrim(p_title), coalesce(p_authors, '{}'),
      nullif(btrim(p_publisher), ''), p_published_at,
      nullif(btrim(p_thumbnail_url), ''), nullif(btrim(p_external_url), '')
    )
    on conflict (isbn13) where isbn13 is not null do update
    set
      source = case when books.source = 'kakao' then books.source else excluded.source end,
      isbn10 = coalesce(books.isbn10, excluded.isbn10),
      title = excluded.title,
      authors = excluded.authors,
      publisher = excluded.publisher,
      published_at = excluded.published_at,
      thumbnail_url = excluded.thumbnail_url,
      external_url = excluded.external_url
    returning id into v_book_id;
  elsif v_isbn10 is not null then
    insert into public.books (
      source, isbn10, title, authors, publisher,
      published_at, thumbnail_url, external_url
    )
    values (
      p_source, v_isbn10, btrim(p_title), coalesce(p_authors, '{}'),
      nullif(btrim(p_publisher), ''), p_published_at,
      nullif(btrim(p_thumbnail_url), ''), nullif(btrim(p_external_url), '')
    )
    on conflict (isbn10) where isbn10 is not null do update
    set
      source = case when books.source = 'kakao' then books.source else excluded.source end,
      title = excluded.title,
      authors = excluded.authors,
      publisher = excluded.publisher,
      published_at = excluded.published_at,
      thumbnail_url = excluded.thumbnail_url,
      external_url = excluded.external_url
    returning id into v_book_id;
  else
    insert into public.books (source, title, authors, publisher, published_at)
    values (
      p_source,
      btrim(p_title),
      coalesce(p_authors, '{}'),
      nullif(btrim(p_publisher), ''),
      p_published_at
    )
    returning id into v_book_id;
  end if;

  insert into public.book_chats (
    room_id,
    book_id,
    created_by_member_id,
    name
  )
  values (p_room_id, v_book_id, v_member_id, btrim(p_name))
  returning id into v_book_chat_id;

  return query select v_book_id, v_book_chat_id;
end;
$$;

create or replace function public.set_book_chat_status(
  p_book_chat_id uuid,
  p_status public.book_chat_status
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_chat public.book_chats%rowtype;
begin
  select *
  into v_chat
  from public.book_chats
  where id = p_book_chat_id and deleted_at is null
  for update;

  if v_chat.id is null then
    raise exception using errcode = 'P0001', message = 'BOOK_CHAT_NOT_FOUND';
  end if;

  if not private.is_active_room_member(v_chat.room_id) then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if p_status = 'deleted' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  update public.book_chats
  set
    status = p_status,
    completed_at = case
      when p_status = 'completed' then coalesce(completed_at, now())
      when p_status = 'reading' then null
      else completed_at
    end,
    archived_at = case when p_status = 'archived' then now() else null end
  where id = p_book_chat_id;
end;
$$;

revoke all on function public.create_book_chat(
  uuid, public.book_source, text, text, text[], text, text, text, date, text, text
) from public, anon;
revoke all on function public.set_book_chat_status(uuid, public.book_chat_status)
from public, anon;

grant execute on function public.create_book_chat(
  uuid, public.book_source, text, text, text[], text, text, text, date, text, text
) to authenticated;
grant execute on function public.set_book_chat_status(uuid, public.book_chat_status)
to authenticated;
