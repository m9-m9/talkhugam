alter table public.notification_preferences
add column if not exists push_enabled boolean not null default true;

grant update (push_enabled) on public.notification_preferences to authenticated;

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint device_tokens_expo_push_token_format
    check (
      char_length(expo_push_token) between 20 and 255
      and expo_push_token ~ '^(Expo|Exponent)PushToken[[][A-Za-z0-9_-]+[]]$'
    ),
  constraint device_tokens_platform
    check (platform in ('ios', 'android'))
);

create index device_tokens_active_profile_idx
on public.device_tokens (profile_id, updated_at desc)
where revoked_at is null;

create trigger device_tokens_set_updated_at
before update on public.device_tokens
for each row execute function private.set_updated_at();

create table public.notification_push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications (id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  attempts smallint not null default 0,
  next_retry_at timestamptz not null default now(),
  last_error_code text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_push_outbox_status
    check (status in ('pending', 'processing', 'sent', 'retry', 'failed')),
  constraint notification_push_outbox_attempts
    check (attempts between 0 and 5),
  constraint notification_push_outbox_sent_state
    check ((status = 'sent') = (sent_at is not null))
);

create index notification_push_outbox_pending_idx
on public.notification_push_outbox (next_retry_at, created_at)
where status in ('pending', 'retry');

alter table public.device_tokens enable row level security;
alter table public.notification_push_outbox enable row level security;

revoke all on table public.device_tokens from public, anon, authenticated;
revoke all on table public.notification_push_outbox from public, anon, authenticated;

create or replace function public.register_device_token(
  p_expo_push_token text,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_token text := btrim(p_expo_push_token);
  v_platform text := lower(btrim(p_platform));
begin
  if v_profile_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if char_length(v_token) not between 20 and 255
    or v_token !~ '^(Expo|Exponent)PushToken[[][A-Za-z0-9_-]+[]]$'
    or v_platform not in ('ios', 'android')
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  insert into public.device_tokens (
    profile_id,
    expo_push_token,
    platform,
    last_seen_at,
    revoked_at
  )
  values (v_profile_id, v_token, v_platform, now(), null)
  on conflict (expo_push_token) do update
  set
    profile_id = excluded.profile_id,
    platform = excluded.platform,
    last_seen_at = excluded.last_seen_at,
    revoked_at = null;
end;
$$;

create or replace function public.revoke_device_token(p_expo_push_token text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_token text := btrim(p_expo_push_token);
begin
  if v_profile_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if char_length(v_token) not between 20 and 255
    or v_token !~ '^(Expo|Exponent)PushToken[[][A-Za-z0-9_-]+[]]$'
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  update public.device_tokens
  set revoked_at = coalesce(revoked_at, now())
  where profile_id = v_profile_id
    and expo_push_token = v_token;
end;
$$;

create or replace function private.enqueue_notification_push_outbox()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_push_enabled boolean;
begin
  if new.type not in ('reply', 'mention', 'invite', 'invite_request') then
    return new;
  end if;

  select push_enabled
  into v_push_enabled
  from public.notification_preferences
  where profile_id = new.recipient_profile_id;

  if not coalesce(v_push_enabled, true) then
    return new;
  end if;

  insert into public.notification_push_outbox (notification_id, recipient_profile_id)
  values (new.id, new.recipient_profile_id)
  on conflict (notification_id) do nothing;

  return new;
end;
$$;

create trigger notifications_enqueue_push_outbox
after insert on public.notifications
for each row execute function private.enqueue_notification_push_outbox();

revoke all on function public.register_device_token(text, text) from public, anon;
revoke all on function public.revoke_device_token(text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;
grant execute on function public.revoke_device_token(text) to authenticated;
revoke all on function private.enqueue_notification_push_outbox() from public, anon, authenticated;

comment on table public.device_tokens is
  'Expo Push token을 회원별 활성·해제 상태로 보관하며 앱 클라이언트에는 직접 노출하지 않는다.';
comment on table public.notification_push_outbox is
  '앱 내부 알림에서 파생한 비동기 푸시 발송 작업만 보관하며 메시지 본문과 토큰은 저장하지 않는다.';
comment on column public.notification_preferences.push_enabled is
  '앱 내부 알림과 별개로 Expo 기기 푸시 발송을 허용하는 전체 수신 설정이다.';
comment on function public.register_device_token(text, text) is
  '현재 인증 회원의 검증된 Expo 기기 토큰만 등록하거나 재활성화한다.';
comment on function public.revoke_device_token(text) is
  '현재 인증 회원이 소유한 Expo 기기 토큰만 해제해 다른 회원 토큰의 상태를 숨긴다.';
comment on function private.enqueue_notification_push_outbox() is
  '답글·멘션·초대 계열 내부 알림에서 전체 푸시 수신 설정을 확인해 중복 없는 worker 작업을 만든다.';
