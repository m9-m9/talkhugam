do $migration$
declare
  documented_count integer := 0;
  routine record;
begin
  for routine in
    with function_descriptions(schema_name, function_name, description) as (
      values
        ('private', 'attach_post_labels', '메시지 생성 과정에서 검증된 라벨을 정렬 순서와 함께 연결한다.'),
        ('private', 'attach_post_mentions', '메시지 생성 과정에서 같은 독서방의 활성 멤버 멘션을 연결한다.'),
        ('private', 'can_access_book', '현재 사용자가 책이 속한 독서방에 접근할 수 있는지 판별한다.'),
        ('private', 'can_access_book_chat', '현재 사용자가 책 대화방이 속한 독서방에 접근할 수 있는지 판별한다.'),
        ('private', 'can_access_post', '현재 사용자가 메시지가 속한 책 대화방에 접근할 수 있는지 판별한다.'),
        ('private', 'current_room_member_id', '현재 사용자의 활성 독서방 멤버 ID를 조회한다.'),
        ('private', 'enqueue_deletion_job', '외부 자산 삭제 작업을 중복 없이 대기열에 등록한다.'),
        ('private', 'enqueue_notification', '알림 수신 대상과 원인을 검증해 앱 내부 알림을 등록한다.'),
        ('private', 'generate_invite_code', '독서방 참여에 사용할 예측하기 어려운 초대 코드를 생성한다.'),
        ('private', 'handle_new_auth_user', '신규 인증 사용자의 기본 프로필을 자동 생성한다.'),
        ('private', 'hash_invite_value', '초대 코드 원문을 저장하지 않도록 단방향 hash로 변환한다.'),
        ('private', 'is_active_room_member', '현재 사용자가 독서방의 활성 멤버인지 판별한다.'),
        ('private', 'is_room_owner', '현재 사용자가 독서방 방장인지 판별한다.'),
        ('private', 'notify_room_member_change', '독서방 멤버 변경을 관련 사용자 알림으로 변환한다.'),
        ('private', 'profile_display_name', '인증 metadata에서 안전한 초기 표시 이름을 결정한다.'),
        ('private', 'set_updated_at', '수정 가능한 record의 updated_at을 현재 시각으로 갱신한다.'),
        ('private', 'shares_active_room', '현재 사용자와 대상 프로필이 활성 독서방을 공유하는지 판별한다.'),
        ('private', 'validate_post_mention', '멘션 대상이 같은 독서방의 활성 멤버인지 검증한다.'),
        ('private', 'validate_post_references', '메시지 작성자와 답글 root가 같은 활성 책 대화방인지 검증한다.'),
        ('private', 'validate_video_asset_post', '영상 자산이 video 유형 메시지에만 연결되는지 검증한다.'),
        ('public', 'apply_mux_video_event', '서명이 검증된 Mux webhook event를 영상 자산 상태에 반영한다.'),
        ('public', 'backend_operational_health', '백엔드 핵심 자원의 운영 상태를 민감값 없이 요약한다.'),
        ('public', 'claim_deletion_jobs', '실행 가능한 외부 자산 삭제 작업을 잠그고 worker에 할당한다.'),
        ('public', 'consume_rate_limit', '요청 식별자의 호출 횟수를 원자적으로 확인하고 사용량을 반영한다.'),
        ('public', 'create_book_chat', '독서방 멤버가 선택한 책으로 새 책 대화방을 생성한다.'),
        ('public', 'create_post', '책 대화방에 텍스트 또는 영상 메시지와 라벨·멘션을 생성한다.'),
        ('public', 'create_reading_room', '현재 사용자를 방장으로 하는 새 독서방을 생성한다.'),
        ('public', 'create_reply', 'Phase 1 깊이 제한을 지키며 메시지 답글을 생성한다.'),
        ('public', 'create_room_invite', '방장이 공유할 수 있는 만료 가능한 독서방 초대를 생성한다.'),
        ('public', 'delete_book_chat', '방장 권한을 확인하고 책 대화방과 관련 자원을 삭제 대기 상태로 전환한다.'),
        ('public', 'delete_reading_room', '방장 권한을 확인하고 독서방과 관련 자원을 삭제 대기 상태로 전환한다.'),
        ('public', 'delete_video_post', '작성자 또는 방장 권한을 확인하고 영상 메시지 삭제를 예약한다.'),
        ('public', 'finish_account_deletion', '외부 자산 정리 후 계정 삭제 작업을 완료 상태로 확정한다.'),
        ('public', 'finish_deletion_job', '외부 자산 삭제 결과와 재시도 정보를 작업 대기열에 반영한다.'),
        ('public', 'get_deletion_job_asset_ids', '삭제 작업에 연결된 Mux upload·asset 식별자를 조회한다.'),
        ('public', 'get_my_reading_room_summaries', '현재 사용자의 독서방을 최근 대화 순서와 요약 정보로 조회한다.'),
        ('public', 'join_room_by_invite', '초대 코드를 검증해 현재 사용자를 독서방 활성 멤버로 참여시킨다.'),
        ('public', 'leave_room', '방장 이전 조건을 검증하고 현재 사용자의 독서방 탈퇴를 처리한다.'),
        ('public', 'mark_notifications_read', '현재 사용자의 지정 알림 또는 기준 시각 이전 알림을 읽음 처리한다.'),
        ('public', 'prepare_account_deletion', '계정 삭제 방식과 소유 자원을 검증해 삭제 작업을 준비한다.'),
        ('public', 'restore_book_chat', '보존 기간 안의 책 대화방과 관련 자원을 복원한다.'),
        ('public', 'restore_reading_room', '보존 기간 안의 독서방과 관련 자원을 복원한다.'),
        ('public', 'revoke_room_invite', '방장 권한을 확인하고 사용 가능한 독서방 초대를 폐기한다.'),
        ('public', 'set_book_chat_status', '독서방 멤버 권한을 확인하고 책 대화방 상태를 변경한다.'),
        ('public', 'transfer_room_ownership', '현재 방장이 활성 멤버에게 독서방 소유권을 이전한다.'),
        ('public', 'update_room_member_profile', '독서방 안에서 사용하는 현재 멤버의 표시 이름과 이미지를 갱신한다.')
    )
    select
      procedure.oid::regprocedure::text as function_identity,
      function_descriptions.description
    from function_descriptions
    join pg_namespace as namespace on namespace.nspname = function_descriptions.schema_name
    join pg_proc as procedure
      on procedure.pronamespace = namespace.oid
      and procedure.proname = function_descriptions.function_name
      and procedure.prokind = 'f'
  loop
    execute format('comment on function %s is %L', routine.function_identity, routine.description);
    documented_count := documented_count + 1;
  end loop;

  if documented_count <> 46 then
    raise exception 'Expected to document 46 database functions, documented %', documented_count;
  end if;
end
$migration$;
