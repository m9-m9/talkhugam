# Database tests

Supabase CLI가 `supabase/tests` 아래의 pgTAP 파일을 실행한다.

- `helpers/*.inc`: 각 테스트가 `\ir`로 불러오는 fixture와 인증 context helper
- `database/*.test.sql`: 스키마·제약조건·RLS·RPC 테스트

각 테스트는 `begin`과 `rollback`으로 격리하고, 실제 사용자 이메일·토큰·운영 데이터를 사용하지 않는다.

```bash
pnpm backend:start
pnpm backend:reset
pnpm backend:test:db
```
