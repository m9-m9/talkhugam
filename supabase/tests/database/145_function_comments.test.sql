begin;

select plan(2);

with documented_function_names(function_name) as (
  values
    ('private.attach_post_labels'),
    ('private.attach_post_mentions'),
    ('private.can_access_book'),
    ('private.can_access_book_chat'),
    ('private.can_access_post'),
    ('private.current_room_member_id'),
    ('private.enqueue_deletion_job'),
    ('private.enqueue_notification'),
    ('private.generate_invite_code'),
    ('private.handle_new_auth_user'),
    ('private.hash_invite_value'),
    ('private.is_active_room_member'),
    ('private.is_room_owner'),
    ('private.notify_room_member_change'),
    ('private.profile_display_name'),
    ('private.set_updated_at'),
    ('private.shares_active_room'),
    ('private.validate_post_mention'),
    ('private.validate_post_references'),
    ('private.validate_video_asset_post'),
    ('public.apply_mux_video_event'),
    ('public.backend_operational_health'),
    ('public.claim_deletion_jobs'),
    ('public.consume_rate_limit'),
    ('public.create_book_chat'),
    ('public.create_post'),
    ('public.create_reading_room'),
    ('public.create_reply'),
    ('public.create_room_invite'),
    ('public.delete_book_chat'),
    ('public.delete_reading_room'),
    ('public.delete_video_post'),
    ('public.finish_account_deletion'),
    ('public.finish_deletion_job'),
    ('public.get_deletion_job_asset_ids'),
    ('public.get_my_reading_room_summaries'),
    ('public.join_room_by_invite'),
    ('public.leave_room'),
    ('public.mark_notifications_read'),
    ('public.prepare_account_deletion'),
    ('public.restore_book_chat'),
    ('public.restore_reading_room'),
    ('public.revoke_room_invite'),
    ('public.set_book_chat_status'),
    ('public.transfer_room_ownership'),
    ('public.update_room_member_profile')
),
database_functions as (
  select
    namespace.nspname || '.' || procedure.proname as function_name,
    obj_description(procedure.oid, 'pg_proc') as description
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  join documented_function_names as expected
    on expected.function_name = namespace.nspname || '.' || procedure.proname
  where procedure.prokind = 'f'
)
select is(
  count(distinct function_name),
  46::bigint,
  '모든 애플리케이션 데이터베이스 함수가 존재한다'
)
from database_functions;

with documented_function_names(function_name) as (
  values
    ('private.attach_post_labels'),
    ('private.attach_post_mentions'),
    ('private.can_access_book'),
    ('private.can_access_book_chat'),
    ('private.can_access_post'),
    ('private.current_room_member_id'),
    ('private.enqueue_deletion_job'),
    ('private.enqueue_notification'),
    ('private.generate_invite_code'),
    ('private.handle_new_auth_user'),
    ('private.hash_invite_value'),
    ('private.is_active_room_member'),
    ('private.is_room_owner'),
    ('private.notify_room_member_change'),
    ('private.profile_display_name'),
    ('private.set_updated_at'),
    ('private.shares_active_room'),
    ('private.validate_post_mention'),
    ('private.validate_post_references'),
    ('private.validate_video_asset_post'),
    ('public.apply_mux_video_event'),
    ('public.backend_operational_health'),
    ('public.claim_deletion_jobs'),
    ('public.consume_rate_limit'),
    ('public.create_book_chat'),
    ('public.create_post'),
    ('public.create_reading_room'),
    ('public.create_reply'),
    ('public.create_room_invite'),
    ('public.delete_book_chat'),
    ('public.delete_reading_room'),
    ('public.delete_video_post'),
    ('public.finish_account_deletion'),
    ('public.finish_deletion_job'),
    ('public.get_deletion_job_asset_ids'),
    ('public.get_my_reading_room_summaries'),
    ('public.join_room_by_invite'),
    ('public.leave_room'),
    ('public.mark_notifications_read'),
    ('public.prepare_account_deletion'),
    ('public.restore_book_chat'),
    ('public.restore_reading_room'),
    ('public.revoke_room_invite'),
    ('public.set_book_chat_status'),
    ('public.transfer_room_ownership'),
    ('public.update_room_member_profile')
),
undocumented_functions as (
  select procedure.oid
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  join documented_function_names as expected
    on expected.function_name = namespace.nspname || '.' || procedure.proname
  where procedure.prokind = 'f'
    and coalesce(obj_description(procedure.oid, 'pg_proc'), '') !~ '[가-힣]'
)
select is(
  count(*),
  0::bigint,
  '모든 애플리케이션 데이터베이스 함수에 한글 책임 설명이 있다'
)
from undocumented_functions;

select * from finish();

rollback;
