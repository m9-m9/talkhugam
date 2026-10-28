import type { Page } from '@playwright/test'

export const roomId = '89544530-dd36-422b-aaff-b6a70180f521'
export const bookChatId = '00000000-0000-4000-8000-000000000002'

/** E2E 실행 페이지에 인증된 Supabase 세션과 사용자 조회 응답을 설정한다. */
export async function authenticatePage(page: Page) {
  const user = {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-17T00:00:00.000Z',
    email: 'e2e@example.com',
    id: '00000000-0000-4000-8000-000000000001',
    user_metadata: {},
  }
  await page.addInitScript((authenticatedUser) => {
    window.localStorage.setItem(
      'sb-aibrendxalzmqsovaqps-auth-token',
      JSON.stringify({
        access_token: 'e2e-access-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        refresh_token: 'e2e-refresh-token',
        token_type: 'bearer',
        user: authenticatedUser,
      }),
    )
  }, user)
  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      body: JSON.stringify(user),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/user_legal_consents?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify([
        { document_type: 'terms', document_version: '2026-10-26.1' },
        { document_type: 'privacy', document_version: '2026-10-26.1' },
      ]),
      contentType: 'application/json',
      status: 200,
    })
  })
}
