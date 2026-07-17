import { expect, test, type Page } from '@playwright/test'
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

test('keeps core authenticated pages within the supported viewport', async ({ page }, testInfo) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)

  for (const path of [
    '/rooms',
    '/rooms/create',
    '/rooms/join',
    '/profile',
    '/profile/settings',
    '/notifications',
  ]) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    await expectPageToFitViewport(page, testInfo.project.use.viewport?.width ?? 640)
  }
})

test('has no automated accessibility violations on authenticated account screens', async ({
  page,
}) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)

  for (const path of ['/profile', '/profile/settings', '/notifications']) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    await expectNoAccessibilityViolations(page)
  }
})

test('recovers from an unknown authenticated route by returning to reading rooms', async ({
  page,
}) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.goto('/not-a-real-page')

  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없어요' })).toBeVisible()
  await page.getByRole('button', { name: '독서방으로 돌아가기' }).click()
  await expect(page).toHaveURL('/rooms')
})

test('closes the action book by Escape and outside click while returning focus to its trigger', async ({
  page,
}) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.goto('/rooms')

  const actionMenuButton = page.getByRole('button', { name: '모임 시작 메뉴 열기' })
  await actionMenuButton.click()
  await expect(page.getByRole('dialog', { name: '모임 시작 방식 선택' })).toBeVisible()
  await expect(page.getByRole('button', { name: '새 모임 만들기' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '모임 시작 방식 선택' })).toBeHidden()
  await expect(actionMenuButton).toBeFocused()

  await actionMenuButton.click()
  await page.getByRole('button', { name: '메뉴 바깥 영역을 눌러 닫기' }).click()
  await expect(page.getByRole('dialog', { name: '모임 시작 방식 선택' })).toBeHidden()
  await expect(actionMenuButton).toBeFocused()
})

test('closes the account deletion dialog by Escape and backdrop while restoring trigger focus', async ({
  page,
}) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.goto('/profile/settings')

  const deletionTrigger = page.getByRole('button', { name: '계정 삭제', exact: true })
  await deletionTrigger.click()
  await expect(page.getByRole('dialog', { name: '계정 삭제' })).toBeVisible()
  await expect(page.getByRole('radio', { name: '대화 기록은 남기고 탈퇴' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '계정 삭제' })).toBeHidden()
  await expect(deletionTrigger).toBeFocused()

  await deletionTrigger.click()
  await page.mouse.click(4, 4)
  await expect(page.getByRole('dialog', { name: '계정 삭제' })).toBeHidden()
  await expect(deletionTrigger).toBeFocused()
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

test('shows global navigation outside the book chat and hides it inside', async ({ page }) => {
  await authenticatePage(page)

  await page.goto('/rooms/create')
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeVisible()

  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeHidden()
})

test('opens the video picker directly from the archive empty state', async ({ page }) => {
  await authenticatePage(page)
  await mockVideoMembers(page)
  await mockVideoPosts(page, [])
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/videos`)

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '첫 영상 올리기' }).click()
  const fileChooser = await fileChooserPromise

  expect(fileChooser.isMultiple()).toBe(false)
  await expect(page.getByText('채팅창의 + 버튼에서 첫 영상을 남겨 보세요.')).toBeHidden()
})

test('keeps saved videos in a two-column archive gallery', async ({ page }) => {
  await authenticatePage(page)
  await mockVideoMembers(page)
  await mockVideoPosts(page, [
    createVideoPostRow('4b7227b2-5350-4a61-9114-b2d0c915fd1b', '민규'),
    createVideoPostRow('e45b7500-b6bd-43d6-8438-e5b643c84282', '수진'),
  ])
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/videos`)

  const gallery = page.getByRole('list', { name: '영상 기록' })
  await expect(gallery.getByRole('listitem')).toHaveCount(2)
  expect(
    await gallery.evaluate((element) =>
      window.getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean),
    ),
  ).toHaveLength(2)
})

test('filters saved videos with the custom member selection menu', async ({ page }) => {
  await authenticatePage(page)
  await mockVideoMembers(page)
  await mockVideoPosts(page, [
    createVideoPostRow('4b7227b2-5350-4a61-9114-b2d0c915fd1b', '민규'),
    {
      ...createVideoPostRow('e45b7500-b6bd-43d6-8438-e5b643c84282', '수진'),
      author_member_id: 'b21f0060-cd1d-40db-a6ae-fd2eb3e9f862',
    },
  ])
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/videos`)

  await page.getByRole('button', { name: '멤버 필터: 모든 멤버' }).click()
  await expect(page.getByRole('listbox', { name: '멤버 필터' })).toBeVisible()
  await expect(page.getByText('누구의 영상?')).toBeVisible()
  await page.getByRole('option', { name: '민규' }).click()

  await expect(page.getByRole('list', { name: '영상 기록' }).getByRole('listitem')).toHaveCount(1)
  await expect(page.getByRole('button', { name: '멤버 필터: 민규' })).toBeVisible()
})

test('opens a gallery thumbnail in the immersive video viewer', async ({ page }) => {
  const videoId = '4b7227b2-5350-4a61-9114-b2d0c915fd1b'
  await authenticatePage(page)
  await mockVideoMembers(page)
  await mockVideoPosts(page, [createVideoPostRow(videoId, '민규', 'ready')])
  await page.route('**/functions/v1/mux-playback-token', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        data: {
          expiresAt: 1_784_269_999,
          playbackId: 'playback-id',
          thumbnailToken: 'thumbnail-token',
          token: 'playback-token',
        },
        ok: true,
      }),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/videos`)

  await page.getByRole('button', { name: '민규님의 영상 보기' }).click()

  await expect(page).toHaveURL(`/rooms/${roomId}/books/${bookChatId}/videos/${videoId}`)
  await expect(page.getByRole('heading', { name: '영상 보기' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeHidden()
})

test('returns to the video archive when the requested video no longer exists', async ({ page }) => {
  const missingVideoId = '4b7227b2-5350-4a61-9114-b2d0c915fd1b'
  await authenticatePage(page)
  await mockVideoMembers(page)
  await mockVideoPosts(page, [])
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/videos/${missingVideoId}`)

  await expect(page.getByRole('alert')).toHaveText('이 영상을 찾을 수 없어요.')
  await page.getByRole('button', { name: '영상 기록으로 가기' }).click()

  await expect(page).toHaveURL(`/rooms/${roomId}/books/${bookChatId}/videos`)
})

/** E2E 실행 페이지에 인증된 Supabase 세션과 사용자 조회 응답을 설정한다. */
async function authenticatePage(page: Page) {
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

/** 지정한 영상 게시물 목록을 반환하도록 Supabase posts 요청을 가로챈다. */
async function mockVideoPosts(page: Page, posts: unknown[]) {
  await page.route('**/rest/v1/posts?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify(posts),
      contentType: 'application/json',
      headers: { 'content-range': `0-${Math.max(posts.length - 1, 0)}/${posts.length}` },
      status: 200,
    })
  })
}

/** 현재 사용자가 속한 독서방 멤버 목록을 반환하도록 Supabase 요청을 가로챈다. */
async function mockVideoMembers(page: Page) {
  await page.route('**/rest/v1/room_members?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify([
        {
          id: '8fc963a4-da01-4696-995c-755fe145776f',
          profile_id: '00000000-0000-4000-8000-000000000001',
          room_display_name: '민규',
        },
      ]),
      contentType: 'application/json',
      status: 200,
    })
  })
}

/** E2E 영상 보관함에 사용할 Supabase posts 행을 생성한다. */
function createVideoPostRow(id: string, authorName: string, status = 'failed') {
  return {
    author_member_id: '8fc963a4-da01-4696-995c-755fe145776f',
    author_name_snapshot: authorName,
    body: null,
    created_at: '2026-07-17T06:00:00+00:00',
    id,
    video_assets: { status },
  }
}

/** 인증 화면이 요청하는 프로필·알림·독서방 데이터를 안정적인 fixture로 반환한다. */
async function mockAuthenticatedPageData(page: Page) {
  await page.route('**/rest/v1/rpc/get_my_reading_room_summaries', async (route) => {
    await route.fulfill({
      body: JSON.stringify([]),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/profiles?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify({ bio: '함께 읽고 오래 남겨요.', display_name: '민규', mbti: 'INTP' }),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/book_chat_completions?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify([]),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/notification_preferences?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        mentions_enabled: true,
        replies_enabled: true,
        room_events_enabled: true,
      }),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/notifications?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify([]),
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0' },
      status: 200,
    })
  })
}

/** 현재 페이지의 문서 가로 폭이 지원 viewport 폭을 넘지 않는지 검사한다. */
async function expectPageToFitViewport(page: Page, viewportWidth: number) {
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewportWidth)
}

/** 현재 페이지의 axe-core 자동 접근성 위반이 없는지 검사한다. */
async function expectNoAccessibilityViolations(page: Page) {
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
  expect(accessibilityScanResults.violations).toEqual([])
}
