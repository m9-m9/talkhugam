# 알라딘 베스트셀러 갱신 운영 안내

Talk후감은 이용자가 홈을 열 때마다 알라딘 API를 호출하지 않는다. `bestseller_books`에 저장한
현재 순위를 화면에 보여 주고, Cron이 매일 오전 7시 5분(KST)에 한 번만 목록을 갱신한다.

## 필요한 비밀값

### 1. 알라딘 TTB Key 발급

1. [알라딘 TTB Key 관리](https://www.aladin.co.kr/ttb/wblog_manage.aspx)에 로그인한다.
2. **TTB Key 발급**을 누른다.
3. URL을 입력하는 칸이 보이면 `https://talkhugam.vercel.app`을 입력한다.
4. 발급된 TTB Key를 복사한다. 이 값은 채팅, 코드, Git에 붙여 넣지 않는다.

### 2. Edge Function Secret 저장

1. [Supabase Dashboard](https://supabase.com/dashboard/project/aibrendxalzmqsovaqps)를 연다.
2. 왼쪽 메뉴 **Edge Functions** → **Secrets** → **Add new secret**을 누른다.
3. 아래 두 개를 각각 저장한다.

| 이름 | 값의 출처 |
| --- | --- |
| `ALADIN_TTB_KEY` | 위에서 발급한 알라딘 TTB Key |
| `BESTSELLER_REFRESH_SECRET` | 터미널에서 `openssl rand -hex 32`로 만든 임의의 긴 문자열 |

`BESTSELLER_REFRESH_SECRET`은 다음 Vault 단계에도 똑같이 사용한다.

### 3. Supabase Vault 저장

1. 같은 Dashboard의 **SQL Editor** → **New query**를 연다.
2. 아래에서 `<BESTSELLER_REFRESH_SECRET>`만 실제 값으로 교체한다.
3. **Run**을 누른다. UUID가 하나 반환되면 성공이다.

```sql
select vault.create_secret(
  '<BESTSELLER_REFRESH_SECRET>',
  'talkhugam_bestseller_refresh_secret',
  'Talk후감 알라딘 베스트셀러 Cron 전용 Authorization 값'
);
```

이미 같은 이름이 있다면 새로 만들지 말고 아래 조회로 존재만 확인한다.

```sql
select id, name, updated_at
from vault.decrypted_secrets
where name = 'talkhugam_bestseller_refresh_secret';
```

## 배포와 확인

저장소 루트에서 실행한다.

```bash
pnpm dlx supabase@latest db push --project-ref aibrendxalzmqsovaqps
pnpm dlx supabase@latest functions deploy bestseller-refresh \
  --project-ref aibrendxalzmqsovaqps \
  --no-verify-jwt
```

그 다음 Dashboard에서 확인한다.

1. **Integrations → Cron**에 `talkhugam-bestseller-refresh`가 활성화되어 있고,
   스케줄이 `5 22 * * *`인지 확인한다. Cron은 UTC 기준이라 한국 시간으로 매일 07:05다.
2. 첫 확인은 **SQL Editor**에서 아래를 실행해 Cron과 같은 Vault 경로로 수동 호출한다.
   반환된 숫자는 비동기 요청 식별자다.

```sql
select private.invoke_bestseller_refresh();
```

3. **Edge Functions → bestseller-refresh → Logs**에서 200 응답을 확인한다. 수동 호출 대신 다음 날
   오전 7시 5분 이후 **Integrations → Cron** 실행 기록에서 성공 여부를 확인해도 된다.
4. 성공한 뒤에는 **Table Editor → bestseller_books**에서 1~10위가 저장됐는지 확인한다.

## 운영 원칙

- 홈 화면은 DB 캐시만 읽으므로 외부 API 장애가 책방 목록에 영향을 주지 않는다.
- API와 화면에는 알라딘 출처를 표시하고, 카드 클릭은 알라딘 상품 페이지를 새 탭으로 연다.
- TTB Key는 알라딘 약관상 공유하지 않는다.

## 공식 참고

- [알라딘 OpenAPI 안내](https://blog.aladin.co.kr/openapi/6695306)
- [Supabase: Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
