create table public.admin_users (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.feedback_tickets (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  body text not null,
  author_profile_id uuid not null references public.profiles (id) on delete cascade,
  author_email_snapshot text not null,
  status text not null default 'unread',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by_profile_id uuid references public.profiles (id) on delete set null,
  constraint feedback_tickets_category
    check (category in ('issue', 'feature', 'other')),
  constraint feedback_tickets_body_length
    check (char_length(btrim(body)) between 1 and 2000),
  constraint feedback_tickets_author_email_length
    check (char_length(btrim(author_email_snapshot)) between 3 and 320),
  constraint feedback_tickets_status
    check (status in ('unread', 'in_progress', 'completed'))
);

create index feedback_tickets_status_created_at_idx
on public.feedback_tickets (status, created_at desc);

create trigger feedback_tickets_set_updated_at
before update on public.feedback_tickets
for each row execute function private.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.feedback_tickets enable row level security;

revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.feedback_tickets from anon, authenticated;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists(
    select 1
    from public.admin_users
    where profile_id = (select auth.uid())
  );
$$;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;

comment on table public.admin_users is
'Talk후감 운영함 접근을 허용한 프로필 목록. Dashboard의 운영 계정만 직접 관리한다.';
comment on table public.feedback_tickets is
'이용자가 전역 의견 창에서 제출하고 운영자가 Edge Function으로만 조회·상태 변경하는 운영함 기록.';
comment on column public.feedback_tickets.author_email_snapshot is
'운영자가 앱 밖 이메일로 회신할 수 있도록 제출 시점에 보관한 로그인 이메일.';
comment on function public.is_current_user_admin() is
'Returns whether the authenticated profile is allowlisted for the Talk후감 operator inbox; it exposes no ticket data.';
