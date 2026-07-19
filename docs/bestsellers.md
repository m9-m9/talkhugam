# 베스트셀러 연동

책방 메인 상단의 **이번 주 베스트셀러**는 알라딘 Open API의 `ItemList` 베스트셀러 목록을 사용합니다. 브라우저는 알라딘 키를 받지 않고, Supabase Edge Function `book-bestsellers`만 호출합니다.

키가 아직 없으면 앱 오류가 아니라 베스트셀러 영역을 숨긴 상태로 동작합니다. 책방 목록과 책 검색은 계속 사용할 수 있습니다.

## 운영 환경에 키 넣기

1. [알라딘 Open API 안내](https://blog.aladin.co.kr/openapi/popup/6695306)에서 TTB 키를 발급받습니다.
2. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인한 뒤 Talk후감 프로젝트를 엽니다.
3. 왼쪽 메뉴에서 **Edge Functions**를 선택하고, 상단의 **Secrets**를 엽니다.
4. **Add new secret**을 누르고 아래처럼 입력한 뒤 저장합니다.

| 입력 필드 | 입력할 값 |
| --- | --- |
| Name | `ALADIN_TTB_KEY` |
| Value | 알라딘에서 발급받은 TTB 키 |

5. 키가 저장된 뒤 `book-bestsellers` 함수를 배포합니다.

```bash
pnpm dlx supabase@latest functions deploy book-bestsellers --project-ref <Supabase 프로젝트 ref> --no-verify-jwt
```

`<Supabase 프로젝트 ref>`에는 Dashboard 주소의 `/project/` 뒤에 있는 영문·숫자 값을 넣습니다. 키 값은 채팅, Git, `.env.example`에 쓰지 않습니다.

## 로컬 환경에서 확인하기

1. 저장소의 `supabase/functions/.env.local` 파일을 만듭니다. 파일이 없다면 `supabase/functions/.env.example`을 복사합니다.
2. 아래 한 줄의 빈 값에만 실제 키를 입력합니다. 이 파일은 Git에 올리지 않습니다.

```dotenv
ALADIN_TTB_KEY=발급받은_실제_TTB_키
```

3. 터미널에서 Edge Function과 웹 앱을 각각 실행합니다.

```bash
pnpm backend:functions:serve
pnpm dev:web
```

4. `http://localhost:5173`에 로그인해 책방 화면을 엽니다. 상단에 **이번 주 베스트셀러**와 최대 여섯 권의 카드가 보이면 완료입니다.

## 동작 범위

- 알라딘에는 베스트셀러 목록 요청만 전달합니다. 로그인 이메일, 사용자 ID, 대화·피드백 본문, 초대 코드, 영상 URL은 보내지 않습니다.
- 목록은 10분 동안 브라우저 캐시에 유지하고, Edge Function은 사용자당 분당 30회로 제한합니다.
- 알라딘 요청 실패 시 책방의 핵심 화면을 막지 않고 베스트셀러 영역만 숨깁니다.
