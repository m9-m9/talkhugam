# 인증 운영 계약

## Phase 1 공급자

| 공급자 | 구현 방식 | 백엔드 callback | 사용자 매핑 |
| --- | --- | --- | --- |
| Kakao | Supabase Auth 기본 OAuth provider | Supabase Auth callback | Kakao 비즈앱의 필수 이메일 동의 후 공급자 identity가 `auth.users`에 연결됨 |
| Google | Supabase Auth 기본 OAuth provider | Supabase Auth callback | 공급자 identity가 `auth.users`에 연결됨 |
| Naver | Talk후감 Edge Function bridge | `naver-oauth-callback` | 네이버 subject의 HMAC 결과를 내부 전용 이메일로 사용 |

Phase 1에서는 서로 다른 공급자 계정을 자동 병합하지 않는다. 이메일이나 이름만으로 동일인을
판단하면 다른 사람의 계정을 잘못 연결할 수 있기 때문이다. 계정 연결 기능이 필요해지면 로그인된
사용자가 두 공급자를 모두 다시 인증하는 별도 티켓으로 구현한다.

## Naver 로그인 흐름

1. 브라우저가 `naver-oauth-start?return_to=...`로 이동한다.
2. 서버가 `return_to`를 정확 일치 allowlist로 검사한다.
3. 서버가 10분짜리 state를 만들고 HMAC 서명한 HttpOnly, SameSite=Lax cookie를 설정한다.
4. Naver 동의 화면에서 callback으로 돌아오면 state, 서명, 만료를 모두 검사한다.
5. token 요청의 client secret은 URL이 아닌 POST form 본문으로 전송한다.
6. Naver subject는 HMAC 처리해 `@oauth.talkhugam.invalid` 내부 이메일로 변환한다.
7. Supabase Admin API가 사용자를 준비하고 일회성 magic link를 생성한다.
8. 브라우저는 Supabase action link를 거쳐 허용된 `return_to`로 돌아간다.

네이버 이메일, 전화번호, 생일, 성별은 Phase 1 로그인에 필요하지 않으므로 요청·저장하지 않는다.
카카오는 Supabase Auth provider가 처리한다. Kakao 비즈앱에서 카카오계정 이메일을 필수 동의로 설정하고,
Supabase Auth의 Kakao provider에 REST API key와 Client Secret을 등록한다.
로그에는 state, code, access token, subject, 내부 이메일을 남기지 않는다.

## 환경변수

공통 공개 설정과 secret을 실제 운영 값으로 채우는 작업은 프로젝트 연결 시 수행한다.

| key | 보관 위치 | 회전 시 영향 |
| --- | --- | --- |
| `NAVER_CLIENT_ID` | Edge Function secret | Naver 앱 설정과 함께 변경 |
| `NAVER_CLIENT_SECRET` | Edge Function secret | token 교환이 중단되므로 동시 교체 필요 |
| `NAVER_REDIRECT_URI` | Edge Function secret/config | Naver 개발자센터 callback과 정확히 일치해야 함 |
| `NAVER_STATE_SECRET` | Edge Function secret | 진행 중인 10분 이내 로그인만 무효화 |
| `NAVER_IDENTITY_SECRET` | 장기 보관 secret | 변경하면 기존 Naver 사용자를 찾지 못하므로 임의 회전 금지 |
| `AUTH_RATE_LIMIT_SECRET` | Edge Function secret | 기존 rate-limit bucket 지문이 초기화됨 |
| `ALLOWED_AUTH_REDIRECTS` | Edge Function config | comma-separated exact URL allowlist |

`NAVER_IDENTITY_SECRET`은 암호 유출 대응이나 명시적 migration 없이 바꾸지 않는다. 회전이 필요하면
이전 key로 만든 내부 identity를 새 key로 이전하는 계획을 먼저 작성한다.

## 실제 연결 체크리스트

- [ ] Supabase 프로젝트의 Kakao provider REST API key/client secret 등록
- [ ] Supabase 프로젝트의 Google provider client ID/secret 등록
- [ ] Kakao 비즈앱의 카카오계정 이메일을 필수 동의로 설정
- [ ] Kakao 개발자 콘솔에 Supabase Auth Kakao callback URL을 등록
- [ ] Google callback URL을 개발자 콘솔에 등록
- [ ] Naver 애플리케이션 callback URL과 `NAVER_REDIRECT_URI` 일치
- [ ] Naver 제공 정보는 식별자와 표시 이름에 필요한 최소 항목만 동의 요청
- [ ] 운영 `ALLOWED_AUTH_REDIRECTS`에 배포 도메인 callback만 등록
- [ ] 필요한 Naver·공통 secret을 로컬 파일이나 Git이 아닌 Supabase secret에 등록
- [ ] 신규 사용자별 `auth.users`, `profiles`, `notification_preferences` 생성 확인
- [ ] 기존 사용자 재로그인 시 새 계정이 생기지 않는지 확인
- [ ] 변조 state, 만료 state, 허용되지 않은 `return_to`, 공급자 거부 흐름 확인
- [ ] 계정 삭제 후 같은 공급자로 다시 로그인할 때 신규 계정으로 생성되는지 확인

## 운영 배포 전 실제 검증

Kakao, Google, Naver 개발자 애플리케이션 값과 Supabase 프로젝트가 준비된 뒤 실제 모바일 브라우저에서
동의 → callback → session 감지 → 온보딩 분기를 검증한다. 이 문서의 체크리스트는 자동화된 단위·E2E
테스트를 대체하지 않으며, 실제 공급자 설정을 바꾸거나 배포 도메인이 달라질 때마다 다시 확인한다.
