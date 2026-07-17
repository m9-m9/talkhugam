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
  v_distinct_member_ids uuid[];
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

  select coalesce(array_agg(distinct requested_member.member_id), '{}')
  into v_distinct_member_ids
  from unnest(v_member_ids) as requested_member(member_id);

  if cardinality(v_distinct_member_ids) > 6 then
    raise exception using errcode = 'P0001', message = 'MENTION_LIMIT_EXCEEDED';
  end if;

  if exists (
    select 1
    from unnest(v_distinct_member_ids) as requested_member(member_id)
    left join public.room_members as member
      on member.id = requested_member.member_id
      and member.room_id = p_room_id
      and member.status = 'active'
    where member.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'MENTION_MEMBER_INVALID';
  end if;

  insert into public.post_mentions (post_id, mentioned_member_id)
  select p_post_id, requested_member.member_id
  from unnest(v_distinct_member_ids) as requested_member(member_id);

  perform private.enqueue_notification(
    member.profile_id,
    'mention',
    p_actor_member_id,
    p_room_id,
    p_post_id
  )
  from unnest(v_distinct_member_ids) as requested_member(member_id)
  join public.room_members as member on member.id = requested_member.member_id
  where member.profile_id is not null
    and member.profile_id is distinct from p_excluded_notification_profile_id;
end;
$$;

revoke all on function private.attach_post_mentions(uuid, uuid, uuid, uuid[], uuid)
from public, anon, authenticated;

comment on function private.attach_post_mentions(uuid, uuid, uuid, uuid[], uuid)
is '같은 방의 활성 멤버 멘션을 중복 없이 최대 6명 연결하고 알림을 생성한다.';
