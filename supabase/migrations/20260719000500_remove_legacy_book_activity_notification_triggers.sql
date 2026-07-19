-- 새 책 활동 알림 함수가 영상·완독 알림을 직접 등록하므로, 이전 트리거는 중복 알림을 만든다.
drop trigger if exists book_chat_completions_notify_review on public.book_chat_completions;
drop trigger if exists video_assets_notify_ready on public.video_assets;

drop function if exists private.notify_completion_review();
drop function if exists private.notify_ready_video();
drop function if exists private.enqueue_book_activity_notifications(uuid, uuid, uuid, public.notification_type);
