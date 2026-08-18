create table public.content_report_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.content_reports (id) on delete cascade,
  operator_profile_id uuid not null references public.profiles (id) on delete restrict,
  previous_status text not null,
  next_status text not null,
  resolution_note varchar(500),
  created_at timestamptz not null default now(),
  constraint content_report_actions_status_check check (
    previous_status in ('open', 'reviewing', 'resolved', 'dismissed')
    and next_status in ('open', 'reviewing', 'resolved', 'dismissed')
  ),
  constraint content_report_actions_note_not_blank check (
    resolution_note is null or char_length(btrim(resolution_note)) between 1 and 500
  )
);

create index content_report_actions_report_created_at_idx
on public.content_report_actions (report_id, created_at desc, id desc);

alter table public.content_report_actions enable row level security;
revoke all on table public.content_report_actions from public, anon, authenticated;

create or replace function public.list_content_reports(p_status text default null)
returns table (
  id uuid,
  reporter_profile_id uuid,
  target_type text,
  target_id uuid,
  reason text,
  status text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  actions jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_FORBIDDEN';
  end if;

  if p_status is not null and p_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  return query
  select
    report.id,
    report.reporter_profile_id,
    report.target_type,
    report.target_id,
    report.reason::text,
    report.status,
    report.created_at,
    report.resolved_at,
    report.resolved_by,
    report.resolution_note::text,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', action.id,
            'operatorProfileId', action.operator_profile_id,
            'previousStatus', action.previous_status,
            'nextStatus', action.next_status,
            'resolutionNote', action.resolution_note,
            'createdAt', action.created_at
          )
          order by action.created_at asc, action.id asc
        )
        from public.content_report_actions as action
        where action.report_id = report.id
      ),
      '[]'::jsonb
    )
  from public.content_reports as report
  where p_status is null or report.status = p_status
  order by report.created_at desc, report.id desc
  limit 100;
end;
$$;

create or replace function public.update_content_report(
  p_report_id uuid,
  p_status text,
  p_resolution_note text default null
)
returns table (
  id uuid,
  reporter_profile_id uuid,
  target_type text,
  target_id uuid,
  reason text,
  status text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_operator_profile_id uuid := auth.uid();
  v_report public.content_reports%rowtype;
  v_resolution_note text := nullif(btrim(p_resolution_note), '');
begin
  if not public.is_current_user_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_FORBIDDEN';
  end if;

  if p_report_id is null or p_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if v_resolution_note is not null and char_length(v_resolution_note) not between 1 and 500 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if p_status in ('resolved', 'dismissed') and v_resolution_note is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select * into v_report
  from public.content_reports
  where content_reports.id = p_report_id
  for update;

  if v_report.id is null then
    raise exception using errcode = 'P0001', message = 'REPORT_NOT_FOUND';
  end if;

  update public.content_reports
  set
    status = p_status,
    resolved_at = case when p_status in ('resolved', 'dismissed') then now() else null end,
    resolved_by = case when p_status in ('resolved', 'dismissed') then v_operator_profile_id else null end,
    resolution_note = case when p_status in ('resolved', 'dismissed') then v_resolution_note else null end
  where content_reports.id = v_report.id;

  insert into public.content_report_actions (
    report_id, operator_profile_id, previous_status, next_status, resolution_note
  ) values (
    v_report.id, v_operator_profile_id, v_report.status, p_status,
    case when p_status in ('resolved', 'dismissed') then v_resolution_note else null end
  );

  return query
  select
    report.id,
    report.reporter_profile_id,
    report.target_type,
    report.target_id,
    report.reason::text,
    report.status,
    report.created_at,
    report.resolved_at,
    report.resolved_by,
    report.resolution_note::text
  from public.content_reports as report
  where report.id = v_report.id;
end;
$$;

revoke all on function public.list_content_reports(text) from public, anon;
revoke all on function public.update_content_report(uuid, text, text) from public, anon;
grant execute on function public.list_content_reports(text) to authenticated;
grant execute on function public.update_content_report(uuid, text, text) to authenticated;

comment on table public.content_report_actions is '운영자가 신고 상태를 바꾸거나 종결할 때 남기는 변경 전후 상태와 조치 메모 이력이다.';
comment on function public.list_content_reports(text) is '운영자 허용 목록 사용자만 신고 원본과 조치 이력을 최대 100건까지 조회한다.';
comment on function public.update_content_report(uuid, text, text) is '운영자만 신고 상태와 종결 메모를 바꾸고 변경 이력을 원자적으로 남긴다.';
