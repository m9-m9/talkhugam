import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const roomId = '89544530-dd36-422b-aaff-b6a70180f521'
const bookChatId = '00000000-0000-4000-8000-000000000002'

test('keeps the app canvas within the supported viewport', async ({ page }, testInfo) => {
  await page.goto('/')

  const expectedCanvasWidth = testInfo.project.name === 'mobile-320' ? 320 : 640
  await expect(page.locator('main')).toHaveCSS('max-width', `${expectedCanvasWidth}px`)
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

test('opens and dismisses the book-chat action bubble', async ({ page }) => {
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)

  await page.getByRole('button', { name: '메시지 추가 메뉴' }).click()
  await expect(page.getByRole('button', { name: '영상 올리기' })).toBeVisible()

  await page.getByRole('textbox', { name: '메시지 입력' }).click()
  await expect(page.getByRole('button', { name: '영상 올리기' })).toBeHidden()
})
