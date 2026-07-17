create or replace function public.delete_video_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_post public.posts%rowtype;
  v_member_id uuid;
  v_room_id uuid;
begin
  select *
  into v_post
  from public.posts
  where id = p_post_id
  for update;

  if v_post.id is null or v_post.type <> 'video' or v_post.deleted_at is not null then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;

  select room_id
  into v_room_id
  from public.book_chats
  where id = v_post.book_chat_id;

  v_member_id := private.current_room_member_id(v_room_id);
  if v_member_id is null then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  if v_post.author_member_id is distinct from v_member_id
    and not private.is_room_owner(v_room_id)
  then
    raise exception using errcode = 'P0001', message = 'ROOM_FORBIDDEN';
  end if;

  update public.posts
  set deleted_at = now()
  where id = v_post.id;

  if exists (
    select 1
    from public.video_assets
    where post_id = v_post.id
      and status <> 'deleted'
  ) then
    perform private.enqueue_deletion_job('post', v_post.id, 'mux');
  end if;
end;
$$;

revoke all on function public.delete_video_post(uuid) from public, anon;
grant execute on function public.delete_video_post(uuid) to authenticated;

comment on function public.delete_video_post(uuid)
is 'Allows a video author or room owner to soft-delete a video and enqueue its Mux asset deletion.';
