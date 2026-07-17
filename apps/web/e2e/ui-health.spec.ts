import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const roomId = '89544530-dd36-422b-aaff-b6a70180f521'
const bookChatId = '00000000-0000-4000-8000-000000000002'

test('keeps the app canvas within the supported viewport', async ({ page }, testInfo) => {
  await page.goto('/')

  const expectedCanvasWidth = Math.min(testInfo.project.use.viewport?.width ?? 640, 640)
  await expect(page.locator('main')).toHaveCSS('max-width', '640px')
  expect(
    await page.locator('main').evaluate((element) => element.getBoundingClientRect().width),
  ).toBe(expectedCanvasWidth)
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    testInfo.project.use.viewport?.width,
  )
})

test('has no automated accessibility violations on the sign-in screen', async ({ page }) => {
  await page.goto('/')

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze()

  expect(accessibilityScanResults.violations).toEqual([])
})

test('preserves a book-chat label draft while the action bubble is dismissed', async ({ page }) => {
  await authenticatePage(page)
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)

  await page.getByRole('button', { name: '메시지 추가 메뉴 열기' }).click()
  await page.getByRole('button', { name: '페이지 라벨' }).click()
  await page.getByRole('textbox', { name: '페이지 번호' }).fill('87')

  await page.getByRole('textbox', { name: '메시지 입력' }).click()
  await expect(page.getByRole('textbox', { name: '페이지 번호' })).toBeHidden()

  await page.getByRole('button', { name: '메시지 추가 메뉴 열기' }).click()
  await expect(page.getByRole('textbox', { name: '페이지 번호' })).toHaveValue('87')

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
  expect(accessibilityScanResults.violations).toEqual([])

  await page.getByRole('button', { name: '메시지 추가 메뉴 닫기' }).click()
  await expect(page.getByRole('textbox', { name: '페이지 번호' })).toBeHidden()
})

async function authenticatePage(page: import('@playwright/test').Page) {
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
      'sb-gvuwtaxvoinelqdvrher-auth-token',
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
}
