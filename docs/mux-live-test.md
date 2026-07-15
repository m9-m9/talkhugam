# Mux 실연동 테스트

이 테스트는 실제 Mux Direct Upload와 encoding을 생성하므로 기본값으로 실행되지 않는다.
Mux와 Supabase 프로젝트를 연결한 뒤 TALK-3 검증 때만 명시적으로 활성화한다.

## 사전 조건

- Supabase migration과 Edge Functions가 테스트 프로젝트에 배포되어 있어야 한다.
- `mux-webhook` URL이 외부 HTTPS로 접근 가능하고 Mux webhook에 등록되어 있어야 한다.
- webhook signing secret과 Edge Function의 `MUX_WEBHOOK_SECRET`이 일치해야 한다.
- 테스트 영상은 HTTPS에서 내려받을 수 있는 30초 이하 MP4여야 한다.
- 영상에는 실제 사용자, 대화, 책 표지 등 개인정보나 저작권 자료를 넣지 않는다.
- Mux signed playback key의 ID와 PKCS#8 private key를 Edge Function secret에 등록한다.

## `.env` 준비

실제 값은 Git에 저장하지 않는다.

```dotenv
RUN_MUX_INTEGRATION_TESTS=true
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
TEST_USER_PASSWORD=
TEST_MUX_VIDEO_URL=
TEST_ORIGIN=
DELETION_WORKER_SECRET=
```

Edge Function용 Mux key는 `supabase/functions/.env.local` 또는 연결된 Supabase secret에만
저장한다. `.env.example`에는 key 이름과 비어 있는 placeholder만 유지한다.

## 실행

```bash
pnpm backend:test:mux
```

테스트는 다음 순서로 동작한다.

1. 격리된 테스트 사용자, 독서방, 책 채팅을 만든다.
2. 인증된 사용자로 `mux-create-upload`를 호출한다.
3. 테스트 영상을 반환된 Direct Upload URL에 업로드한다.
4. webhook이 `video_assets`를 `ready`로 바꿀 때까지 최대 180초 기다린다.
5. 영상 길이가 0초 초과 30초 이하인지 확인한다.
6. `mux-playback-token`을 호출하고 signed HLS manifest를 요청한다.
7. 독서방 삭제 RPC와 deletion worker로 Mux asset 삭제를 요청한다.
8. 테스트 Auth 사용자를 삭제한다.

## 실패 후 확인

테스트가 cleanup 전에 중단되면 다음 항목을 수동으로 확인한다.

- Mux dashboard에 `Mux 통합 테스트` asset이 남았는지 확인하고 삭제
- `video_assets`의 `status`, `error_code`, `duration_seconds` 확인
- `mux_events`에서 webhook의 처리 상태와 중복 event ID 확인
- `deletion_jobs`에서 재시도 또는 실패 작업 확인
- 로그에는 upload URL, playback token, 원본 영상 URL이 출력되지 않았는지 확인

실제 upload→ready→signed playback과 cleanup이 모두 통과한 실행 일시, Git commit, Mux asset ID는
노션 TALK-3에 기록한다. secret이나 signed URL은 기록하지 않는다.
