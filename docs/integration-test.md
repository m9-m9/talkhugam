# 격리 Supabase 통합 테스트

이 테스트는 실제 Supabase Auth, RLS, RPC, Edge Function이 함께 동작하는지를 확인합니다.
개발자의 로컬 Docker나 운영 Talk후감 프로젝트를 사용하지 않습니다.

## 무엇을 검사하나요

- Google·Kakao·Naver 사용자 정보가 프로필과 알림 설정으로 연결되는지
- 책방 6명 정원, 초대 코드 참여, 책 대화, 답글, 멘션 알림이 유지되는지
- 계정 삭제 시 공동 기록 보존과 개인 기록 삭제 정책이 적용되는지

Mux 실제 업로드·재생 테스트는 영상 자산과 비용을 만들기 때문에 이 워크플로에 넣지 않습니다.
필요할 때만 `pnpm backend:test:mux`로 별도 실행합니다.

## 처음 한 번 준비하기

### 1. Supabase에 테스트 전용 프로젝트 만들기

1. [Supabase Dashboard](https://supabase.com/dashboard/projects)에 로그인합니다.
2. `New project`를 누릅니다.
3. 이름을 예를 들어 `talkhugam-integration`으로 입력합니다.
4. **현재 운영 중인 Talk후감 프로젝트와 다른 프로젝트인지** 확인하고 만듭니다.
5. 테스트 프로젝트의 `Connect` 또는 `Project Settings → API`에서 아래 세 값을 확인합니다.
   - Project URL
   - Publishable key
   - Secret key

테스트 프로젝트에는 `main`의 migration과 `account-delete` Edge Function이 배포돼 있어야 합니다.
새 프로젝트를 만든 뒤 저장소 루트에서 아래 명령을 실행합니다. `<테스트 프로젝트 ref>`는 Dashboard URL의 `/project/` 뒤에 있는 문자열입니다.

```bash
pnpm dlx supabase@latest link --project-ref <테스트 프로젝트 ref>
pnpm dlx supabase@latest db push
pnpm dlx supabase@latest functions deploy account-delete --no-verify-jwt
```

### 2. GitHub integration 환경 만들기

1. [talkhugam 저장소 Settings](https://github.com/m9-m9/talkhugam/settings)로 이동합니다.
2. 왼쪽 `Environments`를 누릅니다.
3. `New environment`를 누르고 이름을 정확히 `integration`으로 입력합니다.
4. `Environment secrets`에서 아래 Secret을 각각 추가합니다.

| Secret 이름 | 어디서 가져오나요 |
| --- | --- |
| `SUPABASE_URL` | 테스트 전용 Supabase 프로젝트의 `Project Settings → API → Project URL` |
| `SUPABASE_PUBLISHABLE_KEY` | 같은 화면의 `Publishable key` |
| `SUPABASE_SECRET_KEY` | 같은 화면의 `Secret key` |
| `TEST_USER_PASSWORD` | 테스트 전용으로 새로 만든 8자 이상 비밀번호 |

값은 채팅·이슈·커밋에 붙여 넣지 않습니다. 운영 프로젝트의 URL 또는 key를 넣으면 안 됩니다.

## 실행 방법

1. [GitHub Actions](https://github.com/m9-m9/talkhugam/actions)로 이동합니다.
2. 왼쪽에서 `격리 Supabase 통합 테스트`를 선택합니다.
3. 오른쪽 `Run workflow`를 누릅니다.
4. 확인 항목에서 `네, 분리된 integration 프로젝트입니다`를 선택합니다.
5. `Run workflow`를 한 번 더 누릅니다.
6. `Supabase Auth와 데이터 흐름 검사`가 초록색으로 끝나는지 확인합니다.

실패하면 Actions 실행 화면의 `Supabase 통합 테스트` 단계를 열어 오류를 확인합니다. 테스트가 만든 사용자와 데이터는 마지막에 자동 삭제하도록 작성되어 있습니다.
