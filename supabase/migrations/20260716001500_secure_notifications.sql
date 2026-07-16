create or replace function private.enqueue_notification(
  p_recipient_profile_id uuid,
  p_type public.notification_type,
  p_actor_member_id uuid default null,
  p_room_id uuid default null,
  p_post_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_notification_id uuid;
  v_preferences public.notification_preferences%rowtype;
begin
  if p_recipient_profile_id is null then
    return null;
  end if;

  if exists (
    select 1
    from public.room_members
    where id = p_actor_member_id
      and profile_id = p_recipient_profile_id
  ) then
    return null;
  end if;

  select *
  into v_preferences
  from public.notification_preferences
  where profile_id = p_recipient_profile_id;

  if p_type = 'reply' and not coalesce(v_preferences.replies_enabled, true) then
    return null;
  end if;

  if p_type = 'mention' and not coalesce(v_preferences.mentions_enabled, true) then
    return null;
  end if;

  if p_type in ('invite', 'removed', 'ownership_transfer')
    and not coalesce(v_preferences.room_events_enabled, true)
  then
    return null;
  end if;

  insert into public.notifications (
    recipient_profile_id,
    actor_member_id,
    room_id,
    post_id,
    type
  )
  values (
    p_recipient_profile_id,
    p_actor_member_id,
    p_room_id,
    p_post_id,
    p_type
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

create or replace function private.notify_room_member_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor_member_id uuid;
begin
  if new.profile_id is null then
    return new;
  end if;

  v_actor_member_id := private.current_room_member_id(new.room_id);

  if old.role <> new.role and new.role = 'owner' then
    perform private.enqueue_notification(
      new.profile_id,
      'ownership_transfer',
      v_actor_member_id,
      new.room_id,
      null
    );
  end if;

  if old.status = 'active' and new.status = 'removed' then
    perform private.enqueue_notification(
      new.profile_id,
      'removed',
      v_actor_member_id,
      new.room_id,
      null
    );
  end if;

  return new;
end;
$$;

create trigger room_members_create_notifications
after update of role, status on public.room_members
for each row execute function private.notify_room_member_change();

create or replace function public.mark_notifications_read(
  p_notification_ids uuid[] default null,
  p_read_all_before timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_updated_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if (p_notification_ids is null) = (p_read_all_before is null) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if p_notification_ids is not null
    and cardinality(p_notification_ids) not between 1 and 100
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  update public.notifications
  set read_at = now()
  where recipient_profile_id = auth.uid()
    and read_at is null
    and (
      (p_notification_ids is not null and id = any(p_notification_ids))
      or (p_read_all_before is not null and created_at <= p_read_all_before)
    );

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

revoke all on function private.enqueue_notification(
  uuid, public.notification_type, uuid, uuid, uuid
) from public, anon, authenticated;
revoke all on function private.notify_room_member_change() from public, anon, authenticated;
revoke all on function public.mark_notifications_read(uuid[], timestamptz) from public, anon;
grant execute on function public.mark_notifications_read(uuid[], timestamptz) to authenticated;

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

revoke all on table public.notifications from anon, authenticated;
revoke all on table public.notification_preferences from anon, authenticated;

grant select on table public.notifications to authenticated;
grant select on table public.notification_preferences to authenticated;
grant update (
  replies_enabled,
  mentions_enabled,
  room_events_enabled
) on public.notification_preferences to authenticated;

create policy notifications_select_recipient
on public.notifications
for select
to authenticated
using (recipient_profile_id = (select auth.uid()));

create policy notification_preferences_select_owner
on public.notification_preferences
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy notification_preferences_update_owner
on public.notification_preferences
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

comment on function private.enqueue_notification(uuid, public.notification_type, uuid, uuid, uuid)
is 'Creates a non-self in-app notification when the recipient category preference allows it';
comment on function public.mark_notifications_read(uuid[], timestamptz)
is 'Marks only the authenticated recipient notifications by id batch or cursor';
