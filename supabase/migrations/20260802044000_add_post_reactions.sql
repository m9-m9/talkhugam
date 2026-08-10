create table public.post_reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  member_id uuid not null references public.room_members (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id, emoji),
  constraint post_reactions_emoji_not_blank
    check (char_length(btrim(emoji)) between 1 and 16)
);

create index post_reactions_post_id_idx
on public.post_reactions (post_id, created_at);

alter table public.post_reactions enable row level security;

revoke all on table public.post_reactions from anon, authenticated;
grant select on table public.post_reactions to authenticated;

create policy post_reactions_select_active_room_member
on public.post_reactions
for select
to authenticated
using (private.can_access_post(post_id));

create or replace function public.toggle_post_reaction(
  p_post_id uuid,
  p_emoji text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_emoji is null or char_length(btrim(p_emoji)) not between 1 and 16 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select member.id
  into v_member_id
  from public.posts as post
  join public.book_chats as chat
    on chat.id = post.book_chat_id
    and chat.deleted_at is null
  join public.room_members as member
    on member.room_id = chat.room_id
    and member.profile_id = auth.uid()
    and member.status = 'active'
  where post.id = p_post_id
    and post.deleted_at is null;

  if v_member_id is null then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.post_reactions
    where post_id = p_post_id
      and member_id = v_member_id
      and emoji = p_emoji
  ) then
    delete from public.post_reactions
    where post_id = p_post_id
      and member_id = v_member_id
      and emoji = p_emoji;
    return;
  end if;

  insert into public.post_reactions (post_id, member_id, emoji)
  values (p_post_id, v_member_id, p_emoji);
end;
$$;

revoke all on function public.toggle_post_reaction(uuid, text) from public, anon;
grant execute on function public.toggle_post_reaction(uuid, text) to authenticated;

comment on table public.post_reactions is 'Unicode emoji reactions left by room members on book-chat messages';
comment on function public.toggle_post_reaction(uuid, text) is 'Toggles the current active room member reaction on an accessible book-chat message';
