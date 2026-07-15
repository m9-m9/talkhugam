create type public.post_type as enum ('text', 'video');
create type public.label_kind as enum ('page', 'chapter', 'custom');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  book_chat_id uuid not null references public.book_chats (id) on delete cascade,
  author_member_id uuid references public.room_members (id) on delete set null,
  type public.post_type not null,
  body varchar(500),
  parent_post_id uuid references public.posts (id) on delete set null,
  root_post_id uuid references public.posts (id) on delete cascade,
  depth smallint not null default 0,
  client_id uuid not null,
  author_name_snapshot varchar(30) not null,
  author_avatar_snapshot text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint posts_body_not_blank
    check (body is null or char_length(btrim(body)) between 1 and 500),
  constraint posts_author_name_not_blank
    check (char_length(btrim(author_name_snapshot)) between 1 and 30),
  constraint posts_phase_one_thread_shape
    check (
      (
        depth = 0
        and parent_post_id is null
        and root_post_id is null
      )
      or (
        depth = 1
        and parent_post_id is not null
        and root_post_id is not null
        and parent_post_id = root_post_id
        and type = 'text'
      )
    ),
  constraint posts_video_is_root
    check (type <> 'video' or depth = 0),
  constraint posts_edit_time_order
    check (edited_at is null or edited_at >= created_at),
  constraint posts_delete_time_order
    check (deleted_at is null or deleted_at >= created_at)
);

create table public.post_labels (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  kind public.label_kind not null,
  value varchar(40) not null,
  sort_order smallint not null default 0,
  constraint post_labels_value_not_blank
    check (char_length(btrim(value)) between 1 and 40),
  constraint post_labels_sort_order_nonnegative
    check (sort_order >= 0),
  constraint post_labels_post_sort_unique
    unique (post_id, sort_order)
);

create table public.post_mentions (
  post_id uuid not null references public.posts (id) on delete cascade,
  mentioned_member_id uuid not null references public.room_members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, mentioned_member_id)
);

create unique index posts_author_client_unique
on public.posts (author_member_id, client_id)
where author_member_id is not null;

create index posts_book_chat_feed_idx
on public.posts (book_chat_id, created_at desc, id desc)
where depth = 0;

create index posts_root_thread_idx
on public.posts (root_post_id, created_at, id)
where depth = 1;

create index posts_author_member_id_idx
on public.posts (author_member_id)
where author_member_id is not null;

create index post_labels_post_id_idx
on public.post_labels (post_id, sort_order);

create index post_mentions_member_id_idx
on public.post_mentions (mentioned_member_id, created_at desc);

comment on table public.posts is 'Book-chat messages; reviews and videos are root posts and Phase 1 replies have depth one';
comment on column public.posts.client_id is 'Client-generated idempotency key scoped to the author membership';
comment on column public.posts.author_name_snapshot is 'Room display name captured when the post is created';
comment on table public.post_labels is 'Ordered page, chapter, or custom labels attached to a post';
comment on table public.post_mentions is 'Room members mentioned by a post';
