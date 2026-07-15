create or replace function private.attach_post_labels(
  p_post_id uuid,
  p_labels jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if jsonb_typeof(coalesce(p_labels, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if jsonb_array_length(coalesce(p_labels, '[]'::jsonb)) > 10 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_labels, '[]'::jsonb)) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or coalesce(item.value ->> 'kind', '') not in ('page', 'chapter', 'custom')
      or char_length(btrim(coalesce(item.value ->> 'value', ''))) not between 1 and 40
  ) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  insert into public.post_labels (post_id, kind, value, sort_order)
  select
    p_post_id,
    (item.value ->> 'kind')::public.label_kind,
    btrim(item.value ->> 'value'),
    (item.ordinality - 1)::smallint
  from jsonb_array_elements(coalesce(p_labels, '[]'::jsonb))
    with ordinality as item(value, ordinality);
end;
$$;

create or replace function private.attach_post_mentions(
  p_post_id uuid,
  p_room_id uuid,
  p_actor_member_id uuid,
  p_mentioned_member_ids uuid[],
  p_excluded_notification_profile_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_member_ids uuid[] := coalesce(p_mentioned_member_ids, '{}');
begin
  if cardinality(v_member_ids) > 20
    or exists (
      select 1
      from unnest(v_member_ids) as requested_member(member_id)
      where requested_member.member_id is null
    )
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if exists (
    select 1
    from (
      select distinct member_id
      from unnest(v_member_ids) as requested_member(member_id)
    ) as requested
    left join public.room_members as member
      on member.id = requested.member_id
      and member.room_id = p_room_id
      and member.status = 'active'
    where member.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'MENTION_MEMBER_INVALID';
  end if;

  insert into public.post_mentions (post_id, mentioned_member_id)
  select p_post_id, member_id
  from (
    select distinct member_id
    from unnest(v_member_ids) as requested_member(member_id)
  ) as requested;

  perform private.enqueue_notification(
    member.profile_id,
    'mention',
    p_actor_member_id,
    p_room_id,
    p_post_id
  )
  from (
    select distinct member_id
    from unnest(v_member_ids) as requested_member(member_id)
  ) as requested
  join public.room_members as member on member.id = requested.member_id
  where member.profile_id is not null
    and member.profile_id is distinct from p_excluded_notification_profile_id;
end;
$$;

revoke all on function private.attach_post_labels(uuid, jsonb)
from public, anon, authenticated;
revoke all on function private.attach_post_mentions(uuid, uuid, uuid, uuid[], uuid)
from public, anon, authenticated;

comment on function private.attach_post_labels(uuid, jsonb)
is 'Validates and attaches at most ten ordered labels to a post';
comment on function private.attach_post_mentions(uuid, uuid, uuid, uuid[], uuid)
is 'Validates same-room mentions, deduplicates them, and enqueues mention notifications';
