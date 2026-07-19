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

test('sends one manual GA4 page view for each SPA screen transition', async ({ page }) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.route('https://www.googletagmanager.com/**', async (route) => {
    await route.fulfill({ body: '', contentType: 'application/javascript', status: 200 })
  })
  await page.goto('/rooms')

  await expect.poll(() => readGaPageViews(page)).toHaveLength(1)
  await page.getByRole('button', { name: '내 정보' }).click()
  await expect(page).toHaveURL('/profile')
  await expect.poll(() => readGaPageViews(page)).toHaveLength(2)
})

test('loads Clarity once while masking all app text and user content', async ({ page }) => {
  await page.route('https://www.clarity.ms/tag/**', async (route) => {
    await route.fulfill({ body: '', contentType: 'application/javascript', status: 200 })
  })
  await page.goto('/')

  await expect(page.locator('#talkhugam-clarity')).toHaveAttribute(
    'src',
    /https:\/\/www\.clarity\.ms\/tag\/xoernfdaoq/,
  )
  await expect(page.locator('#root')).toHaveAttribute('data-clarity-mask', 'true')
  await expect(page.locator('#talkhugam-clarity')).toHaveCount(1)
})

test('submits feedback from the global launcher without exposing an in-app reply thread', async ({
  page,
}) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.route('**/functions/v1/feedback-submit', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        data: { ticketId: '8fc963a4-da01-4696-995c-755fe145776f' },
        ok: true,
        requestId: 'feedback-e2e',
      }),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.goto('/rooms')

  await page.getByRole('button', { name: '의견 보내기' }).click()
  await page.getByRole('button', { name: '기능 제안' }).click()
  await page.getByRole('textbox', { name: '의견 내용' }).fill('완독 목록을 더 쉽게 보고 싶어요.')
  await page
    .getByRole('dialog', { name: '의견 보내기' })
    .getByRole('button', { name: '의견 보내기', exact: true })
    .click()

  await expect(page.getByText('의견을 받았어요.')).toBeVisible()
  await expect(page.getByText('로그인 이메일로 답변드릴게요.')).toBeVisible()
})

test('blocks a non-operator from the admin route', async ({ page }) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.route('**/functions/v1/admin-feedback', async (route) => {
    await route.fulfill({
      body: JSON.stringify({ code: 'ADMIN_FORBIDDEN', message: '운영자 권한이 필요해요.' }),
      contentType: 'application/json',
      status: 403,
    })
  })
  await page.goto('/admin')

  await expect(page).toHaveURL('/rooms')
  await expect(page.getByRole('heading', { name: '함께 읽는 책방' })).toBeVisible()
})

test('lets an operator change a feedback ticket status', async ({ page }) => {
  const ticket = createAdminFeedbackTicket()
  await authenticatePage(page)
  await page.route('**/functions/v1/admin-feedback', async (route) => {
    const action = readAdminFeedbackAction(route.request().postDataJSON())
    if (action === 'access') {
      await route.fulfill({
        body: JSON.stringify({ data: { isAdmin: true }, ok: true, requestId: 'access-e2e' }),
        contentType: 'application/json',
        status: 200,
      })
      return
    }
    if (action === 'list') {
      await route.fulfill({
        body: JSON.stringify({ data: { tickets: [ticket] }, ok: true, requestId: 'list-e2e' }),
        contentType: 'application/json',
        status: 200,
      })
      return
    }
    await route.fulfill({
      body: JSON.stringify({
        data: { ticket: { ...ticket, status: 'in_progress' } },
        ok: true,
        requestId: 'update-e2e',
      }),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.goto('/admin')

  await page.getByRole('button', { name: /완독 목록을 더 쉽게/ }).click()
  const detailSheet = page.getByRole('dialog', { name: '의견 상세' })
  await detailSheet.getByRole('button', { name: '처리 중', exact: true }).click()
  await expect(detailSheet.getByRole('button', { name: '처리 중', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('keeps core authenticated pages within the supported viewport', async ({ page }, testInfo) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)

  for (const path of [
    '/rooms',
    '/rooms/create',
    '/rooms/join',
    '/profile',
    '/profile/share',
    '/profile/settings',
    '/profile/settings/naver-info',
    '/notifications',
  ]) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    await expectPageToFitViewport(page, testInfo.project.use.viewport?.width ?? 640)
  }
})

test('uses the bottom-navigation token as the global page bottom spacing', async ({ page }) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.goto('/rooms')

  await expect(page.locator('.app-with-bottom-navigation')).toHaveCSS('padding-bottom', '96px')
})

test('has no automated accessibility violations on authenticated account screens', async ({
  page,
}) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)

  for (const path of ['/profile', '/profile/settings', '/notifications']) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('h1')).toBeVisible()
    await expectNoAccessibilityViolations(page)
  }
})

test('keeps room management and archived-room screens within the supported viewport', async ({
  page,
}, testInfo) => {
  await authenticatePage(page)
  await mockRoomManagementPageData(page)

  for (const path of [
    `/rooms/${roomId}/manage`,
    `/rooms/${roomId}/members/00000000-0000-4000-8000-000000000001`,
    '/rooms/archive',
  ]) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    await expectPageToFitViewport(page, testInfo.project.use.viewport?.width ?? 640)
  }
})

test('recovers from an unknown authenticated route by returning to reading rooms', async ({
  page,
}) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.goto('/not-a-real-page')

  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없어요' })).toBeVisible()
  await page.getByRole('button', { name: '책방으로 돌아가기' }).click()
  await expect(page).toHaveURL('/rooms')
})

test('closes the action book by Escape and outside click while returning focus to its trigger', async ({
  page,
}) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.goto('/rooms')

  const actionMenuButton = page.getByRole('button', { name: '책방 시작 메뉴 열기' })
  await actionMenuButton.click()
  await expect(page.getByRole('dialog', { name: '책방 시작 방식 선택' })).toBeVisible()
  await expect(page.getByRole('button', { name: '새 책방 만들기' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '책방 시작 방식 선택' })).toBeHidden()
  await expect(actionMenuButton).toBeFocused()

  await actionMenuButton.click()
  await page.getByRole('button', { name: '메뉴 바깥 영역을 눌러 닫기' }).click()
  await expect(page.getByRole('dialog', { name: '책방 시작 방식 선택' })).toBeHidden()
  await expect(actionMenuButton).toBeFocused()
})

test('aligns the book-chat composer controls on one 44px row', async ({ page }) => {
  await authenticatePage(page)
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)

  const addButton = page.getByRole('button', { name: '메시지 추가 메뉴 열기' })
  const messageInput = page.getByRole('textbox', { name: '메시지 입력' })
  const sendButton = page.getByRole('button', { name: '전송' })
  const [addBox, inputBox, sendBox] = await Promise.all([
    addButton.boundingBox(),
    messageInput.boundingBox(),
    sendButton.boundingBox(),
  ])

  if (!addBox || !inputBox || !sendBox) throw new Error('채팅 입력 영역의 크기를 확인할 수 없어요.')

  expect(Math.round(addBox.height)).toBe(44)
  expect(Math.round(inputBox.height)).toBe(44)
  expect(Math.round(sendBox.height)).toBe(44)
  expect(Math.round(addBox.y)).toBe(Math.round(inputBox.y))
  expect(Math.round(inputBox.y)).toBe(Math.round(sendBox.y))
  expect(Math.round(inputBox.x - (addBox.x + addBox.width))).toBe(8)
  expect(Math.round(sendBox.x - (inputBox.x + inputBox.width))).toBe(8)
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

test('resets a dismissed book-chat label editor while keeping the message draft', async ({
  page,
}) => {
  await authenticatePage(page)
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)

  await page.getByRole('button', { name: '메시지 추가 메뉴 열기' }).click()
  await page.getByRole('button', { name: '페이지 라벨' }).click()
  await page.getByRole('textbox', { name: '페이지 번호' }).fill('87')

  const composer = page.getByRole('textbox', { name: '메시지 입력' })
  await composer.fill('이 문장을 기억할게요')
  await composer.click()
  await expect(page.getByRole('textbox', { name: '페이지 번호' })).toBeHidden()

  await page.getByRole('button', { name: '메시지 추가 메뉴 열기' }).click()
  await expect(page.getByRole('button', { name: '페이지 라벨' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '페이지 번호' })).toBeHidden()
  await expect(composer).toHaveValue('이 문장을 기억할게요')

  await page.getByRole('button', { name: '페이지 라벨' }).click()
  await expect(page.getByRole('textbox', { name: '페이지 번호' })).toHaveValue('')

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
  expect(accessibilityScanResults.violations).toEqual([])

  await page.getByRole('button', { name: '메시지 추가 메뉴 닫기' }).click()
  await expect(page.getByRole('textbox', { name: '페이지 번호' })).toBeHidden()
})

test('opens completion records from the book-chat plus menu and restores focus on close', async ({
  page,
}) => {
  await authenticatePage(page)
  await mockBookCompletionRecords(page)
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)

  const plusButton = page.getByRole('button', { name: '메시지 추가 메뉴 열기' })
  await plusButton.click()
  await page.getByRole('button', { name: '완독 기록' }).click()

  await expect(page.getByRole('dialog', { name: '완독 기록' })).toBeVisible()
  await expect(page.getByRole('button', { name: '완독하기' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '완독 기록' })).toBeHidden()
  await expect(plusButton).toBeFocused()
})
test('selects a member by typing an at-sign in the book-chat composer', async ({ page }) => {
  await authenticatePage(page)
  await mockVideoMembers(page, [
    createVideoMember('8fc963a4-da01-4696-995c-755fe145776f', '민규', true),
    createVideoMember('b21f0060-cd1d-40db-a6ae-fd2eb3e9f862', '민수'),
  ])
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)

  const composer = page.getByRole('textbox', { name: '메시지 입력' })
  await composer.fill('@민')
  await expect(page.getByRole('listbox', { name: '멘션할 멤버' })).toBeVisible()
  await page.getByRole('option', { name: '민수 멘션 추가' }).click()

  await expect(composer).toHaveValue('@민수 ')
  await expect(page.getByRole('listbox', { name: '멘션할 멤버' })).toBeHidden()

  await page.getByRole('button', { name: '메시지 추가 메뉴 열기' }).click()
  await expect(page.getByRole('button', { name: '멤버 멘션' })).toBeHidden()
})

test('shows global navigation outside the book chat and hides it inside', async ({ page }) => {
  await authenticatePage(page)

  await page.goto('/rooms/create')
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeVisible()

  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeHidden()
})

test('opens reading books from the profile hub and edits a personal completion record', async ({
  page,
}) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await mockReadingProgresses(page, [])
  await mockReadingBooks(page, [
    {
      books: {
        authors: ['기시미 이치로'],
        thumbnail_url: null,
        title: '미움받을 용기',
      },
      id: bookChatId,
      name: '미움받을 용기',
      reading_rooms: { name: '금요일 아침 책방' },
      room_id: roomId,
    },
  ])
  await page.route('**/rest/v1/book_chat_completions?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify([
        {
          book_chat_id: bookChatId,
          book_chats: {
            books: {
              authors: ['기시미 이치로'],
              thumbnail_url: null,
              title: '미움받을 용기',
            },
            room_id: roomId,
          },
          completed_at: '2026-07-18T01:00:00+00:00',
          rating: 4,
          review: '다시 읽고 싶은 문장이 많아요.',
        },
      ]),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.goto('/profile')

  await page.getByRole('button', { name: '읽고 있는 책' }).click()

  await expect(page).toHaveURL('/profile/books')
  await expect(page.getByRole('heading', { name: '읽고 있는 책' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '금요일 아침 책방' })).toBeVisible()
  await expect(page.getByText('미움받을 용기')).toBeVisible()
  await expect(page.getByText('완독', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '미움받을 용기 기록 수정' }).click()
  await expect(page.getByRole('dialog', { name: '완독 기록' })).toBeVisible()
  await expect(page.getByRole('button', { name: '4점' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('textbox', { name: '총평 (선택)' })).toHaveValue(
    '다시 읽고 싶은 문장이 많아요.',
  )
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeVisible()
})

test('opens service information from the fifth profile destination', async ({ page }) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.goto('/profile')

  await page.getByRole('button', { name: '서비스 정보' }).click()

  await expect(page).toHaveURL('/contact')
  await expect(page.getByRole('heading', { name: '서비스 정보' })).toBeVisible()
  await expect(page.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/legal/terms')
  await expect(page.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
    'href',
    '/legal/privacy',
  )
})

test('keeps personal reading progress after refresh and lets the user complete then edit it', async ({
  page,
}) => {
  const readingBook = {
    books: {
      authors: ['기시미 이치로'],
      thumbnail_url: null,
      title: '미움받을 용기',
    },
    id: bookChatId,
    name: '미움받을 용기',
    reading_rooms: { name: '금요일 아침 책방' },
    room_id: roomId,
  }
  let progress = {
    book_chat_id: bookChatId,
    current_page: 87,
    total_pages: 320,
    updated_at: '2026-07-19T01:00:00+00:00',
  }
  let completion: null | { rating: number; review: string } = null

  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await mockReadingBooks(page, [readingBook])
  await mockReadingProgresses(page, () => [progress])
  await page.route('**/rest/v1/book_chat_completions?*', async (route) => {
    const body = completion
      ? [
          {
            book_chat_id: bookChatId,
            book_chats: { books: readingBook.books, room_id: roomId },
            completed_at: '2026-07-19T01:00:00+00:00',
            rating: completion.rating,
            review: completion.review,
          },
        ]
      : []
    await route.fulfill({
      body: JSON.stringify(body),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/rpc/upsert_book_chat_reading_progress', async (route) => {
    const request = route.request().postDataJSON() as {
      p_current_page: number
      p_total_pages: number
    }
    progress = {
      book_chat_id: bookChatId,
      current_page: request.p_current_page,
      total_pages: request.p_total_pages,
      updated_at: '2026-07-19T01:01:00+00:00',
    }
    await route.fulfill({ body: 'null', contentType: 'application/json', status: 200 })
  })
  await page.route('**/rest/v1/rpc/upsert_book_chat_completion', async (route) => {
    const request = route.request().postDataJSON() as { p_rating: number; p_review: string }
    completion = { rating: request.p_rating, review: request.p_review }
    progress = {
      ...progress,
      current_page: progress.total_pages,
      updated_at: '2026-07-19T01:02:00+00:00',
    }
    await route.fulfill({ body: 'null', contentType: 'application/json', status: 200 })
  })
  await page.goto('/profile/books')

  await expect(page.getByText('87 / 320쪽')).toBeVisible()
  await page.getByRole('button', { name: '미움받을 용기 진행률 기록하기' }).click()
  await page.getByRole('spinbutton', { name: '현재 읽은 페이지' }).fill('146')
  await page.getByRole('button', { name: '진행률 저장' }).click()
  await expect(page.getByText('146 / 320쪽')).toBeVisible()

  await page.reload()
  await expect(page.getByText('146 / 320쪽')).toBeVisible()
  await page.getByRole('button', { name: '미움받을 용기 완독하기' }).click()
  await page.getByRole('button', { name: '5점' }).click()
  await page.getByRole('textbox', { name: '총평 (선택)' }).fill('다시 읽고 싶은 문장이 많아요.')
  await page.getByRole('button', { name: '완독 기록 저장' }).click()

  await expect(page.getByRole('dialog', { name: '완독 기록' })).toBeHidden()
  await expect(page.locator('article').getByText('완독', { exact: true })).toBeVisible()
  await expect(page.getByText('별점 5점')).toBeVisible()
  await page.getByRole('button', { name: '미움받을 용기 기록 수정' }).click()
  await expect(page.getByRole('textbox', { name: '총평 (선택)' })).toHaveValue(
    '다시 읽고 싶은 문장이 많아요.',
  )
})
test('keeps a chat video preview square within seventy percent and opens the immersive viewer', async ({
  page,
}) => {
  const videoId = '4b7227b2-5350-4a61-9114-b2d0c915fd1b'
  await authenticatePage(page)
  await mockVideoPosts(page, [createVideoPostRow(videoId, '민규', 'ready')])
  await mockMuxThumbnailTokens(page)
  await mockMuxPlaybackAuthorizationFailure(page)
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)

  const preview = page.getByRole('button', { name: '민규님의 영상 보기' })
  await expect(preview).toBeVisible()

  const previewBox = await preview.boundingBox()
  const timelineRowBox = await preview.locator('xpath=ancestor::li').boundingBox()
  expect(previewBox).not.toBeNull()
  expect(timelineRowBox).not.toBeNull()
  if (!previewBox || !timelineRowBox) throw new Error('영상 미리보기의 화면 크기를 읽지 못했어요.')

  expect(previewBox.width / timelineRowBox.width).toBeLessThanOrEqual(0.7)
  expect(Math.abs(previewBox.width - previewBox.height)).toBeLessThanOrEqual(1)

  await preview.click()

  await expect(page).toHaveURL(`/rooms/${roomId}/books/${bookChatId}/videos/${videoId}`)
  await expect(page.getByRole('heading', { name: '영상 보기' })).toBeVisible()
  await expect(page.getByRole('main')).toHaveCSS('padding-left', '0px')
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
  let thumbnailRequestCount = 0
  await authenticatePage(page)
  await mockVideoMembers(page)
  await mockVideoPosts(page, [
    createVideoPostRow('4b7227b2-5350-4a61-9114-b2d0c915fd1b', '민규', 'ready'),
    createVideoPostRow('e45b7500-b6bd-43d6-8438-e5b643c84282', '수진', 'ready'),
  ])
  await mockMuxThumbnailTokens(page, () => {
    thumbnailRequestCount += 1
  })
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/videos`)

  const gallery = page.getByRole('list', { name: '영상 기록' })
  await expect(gallery.getByRole('listitem')).toHaveCount(2)
  expect(
    await gallery.evaluate((element) =>
      window.getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean),
    ),
  ).toHaveLength(2)
  await expect.poll(() => thumbnailRequestCount).toBe(1)
})

test('does not paint an unused grid slot when the video archive has one item', async ({ page }) => {
  await authenticatePage(page)
  await mockVideoMembers(page)
  await mockVideoPosts(page, [createVideoPostRow('4b7227b2-5350-4a61-9114-b2d0c915fd1b', '민규')])
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/videos`)

  const gallery = page.getByRole('list', { name: '영상 기록' })
  await expect(gallery.getByRole('listitem')).toHaveCount(1)
  await expect(gallery).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
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
  await mockMuxThumbnailTokens(page)
  await mockMuxPlaybackAuthorizationFailure(page)
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/videos`)

  await page.getByRole('button', { name: '민규님의 영상 보기' }).click()

  await expect(page).toHaveURL(`/rooms/${roomId}/books/${bookChatId}/videos/${videoId}`)
  await expect(page.getByRole('heading', { name: '영상 보기' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('재생 정보를 불러오지 못했어요.')
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeHidden()
})

test('dismisses the video deletion confirmation without deleting', async ({ page }) => {
  const videoId = '4b7227b2-5350-4a61-9114-b2d0c915fd1b'
  await authenticatePage(page)
  await mockVideoMembers(page)
  await mockVideoPosts(page, [createVideoPostRow(videoId, '민규', 'ready')])
  await mockMuxPlaybackAuthorizationFailure(page)
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/videos/${videoId}`)

  const deleteButton = page.getByRole('button', { name: '삭제', exact: true })
  await deleteButton.click()
  await expect(page.getByRole('dialog', { name: '영상 삭제' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '영상 삭제' })).toBeHidden()
  await expect(deleteButton).toBeFocused()

  await deleteButton.click()
  const backdrop = page.getByRole('dialog', { name: '영상 삭제' }).locator('..')
  await backdrop.click({ position: { x: 1, y: 1 } })
  await expect(page.getByRole('dialog', { name: '영상 삭제' })).toBeHidden()
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
        { document_type: 'terms', document_version: '2026-07-18.2' },
        { document_type: 'privacy', document_version: '2026-07-18.2' },
      ]),
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

/** 현재 사용자가 속한 책방 멤버 목록을 반환하도록 Supabase 요청을 가로챈다. */
async function mockVideoMembers(
  page: Page,
  members = [createVideoMember('8fc963a4-da01-4696-995c-755fe145776f', '민규', true)],
) {
  await page.route('**/rest/v1/room_members?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify(members),
      contentType: 'application/json',
      status: 200,
    })
  })
}

/** E2E 책방 멤버 행을 만든다. */
function createVideoMember(id: string, displayName: string, isCurrentUser = false) {
  return {
    id,
    profile_id: isCurrentUser
      ? '00000000-0000-4000-8000-000000000001'
      : 'b09d779e-6e94-49bc-ae52-39a6caec6206',
    role: 'member',
    room_display_name: displayName,
  }
}

/** 영상 보관함의 일괄 썸네일 권한 요청을 안전한 테스트 응답으로 대체한다. */
async function mockMuxThumbnailTokens(page: Page, onRequest?: () => void) {
  await page.route('**/functions/v1/mux-thumbnail-tokens', async (route) => {
    onRequest?.()
    const thumbnails = readRequestedPostIds(route.request().postDataJSON()).map((postId) => ({
      expiresAt: 1_784_269_999,
      playbackId: `playback-${postId}`,
      postId,
      thumbnailToken: 'thumbnail-token',
    }))
    await route.fulfill({
      body: JSON.stringify({ data: { thumbnails }, ok: true }),
      contentType: 'application/json',
      status: 200,
    })
  })
}

/** 실제 Mux 네트워크를 열지 않도록 재생 권한 조회 실패를 테스트 응답으로 대체한다. */
async function mockMuxPlaybackAuthorizationFailure(page: Page) {
  await page.route('**/functions/v1/mux-playback-token', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        code: 'PLAYBACK_UNAVAILABLE',
        message: '재생 권한을 준비하지 못했어요.',
      }),
      contentType: 'application/json',
      status: 500,
    })
  })
}

/** 일괄 썸네일 요청 본문에서 문자열 영상 식별자 목록만 안전하게 읽는다. */
function readRequestedPostIds(value: unknown): string[] {
  if (value === null || typeof value !== 'object' || !('postIds' in value)) return []
  if (!Array.isArray(value.postIds)) return []
  return value.postIds.filter((postId): postId is string => typeof postId === 'string')
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

/** 인증 화면이 요청하는 프로필·알림·책방 데이터를 안정적인 fixture로 반환한다. */
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
      body: JSON.stringify({
        avatar_path: null,
        bio: '함께 읽고 오래 남겨요.',
        display_name: '민규',
        mbti: 'INTP',
        updated_at: '2026-07-19T00:00:00.000+00:00',
      }),
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

/** 프로필의 전체 읽는 책 화면이 요구하는 책 대화 조인 행을 반환한다. */
async function mockReadingBooks(page: Page, books: unknown[]) {
  await page.route('**/rest/v1/book_chats?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify(books),
      contentType: 'application/json',
      status: 200,
    })
  })
}

/** 현재 사용자에게 보이는 개인 독서 진행률 목록을 안정적인 테스트 응답으로 제공한다. */
async function mockReadingProgresses(page: Page, progresses: unknown[] | (() => unknown[])) {
  await page.route('**/rest/v1/book_chat_reading_progresses?*', async (route) => {
    const body = typeof progresses === 'function' ? progresses() : progresses
    await route.fulfill({
      body: JSON.stringify(body),
      contentType: 'application/json',
      status: 200,
    })
  })
}

/** 책 대화의 완독 시트가 필요한 빈 완독 기록 응답을 브라우저에 제공한다. */
async function mockBookCompletionRecords(page: Page) {
  await page.route('**/rest/v1/book_chat_completions?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify([]),
      contentType: 'application/json',
      status: 200,
    })
  })
}

/** 방 관리와 아카이브 화면의 RLS 허용 응답을 E2E 브라우저에 제공한다. */
async function mockRoomManagementPageData(page: Page) {
  await page.route('**/rest/v1/reading_rooms?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify([
        {
          created_by: '00000000-0000-4000-8000-000000000001',
          description: '함께 읽는 책들',
          id: roomId,
          name: '금요일 아침 책방',
          status: 'active',
        },
      ]),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/room_members?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify([
        {
          id: '10000000-0000-4000-8000-000000000001',
          joined_at: '2026-07-18T00:00:00.000+00:00',
          profile_id: '00000000-0000-4000-8000-000000000001',
          role: 'owner',
          room_avatar_path: null,
          room_display_name: '민규',
          room_id: roomId,
          status: 'active',
        },
      ]),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/rpc/get_my_archived_reading_rooms', async (route) => {
    await route.fulfill({ body: JSON.stringify([]), contentType: 'application/json', status: 200 })
  })
}

/** 현재 페이지의 문서 가로 폭이 지원 viewport 폭을 넘지 않는지 검사한다. */
async function expectPageToFitViewport(page: Page, viewportWidth: number) {
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewportWidth)
}

/** 현재 페이지의 axe-core 자동 접근성 위반을 검사하되, 별도 h1 검증과 중복되는 규칙은 제외한다. */
async function expectNoAccessibilityViolations(page: Page) {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .disableRules(['page-has-heading-one'])
    .analyze()
  expect(accessibilityScanResults.violations).toEqual([])
}

/** 현재 브라우저에서 수집 대기 중인 GA4 화면 조회 이벤트만 읽는다. */
async function readGaPageViews(page: Page): Promise<unknown[]> {
  return page.evaluate(() => {
    const candidate = window as Window & { dataLayer?: unknown[] }
    return (candidate.dataLayer ?? []).filter((entry) => {
      if (entry === null || typeof entry !== 'object') return false
      const args = Array.from(entry as ArrayLike<unknown>)
      return args[0] === 'event' && args[1] === 'page_view'
    })
  })
}

/** 운영함 Edge Function 요청 본문에서 허용된 action 문자열만 읽는다. */
function readAdminFeedbackAction(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object' || !('action' in value)) return undefined
  return typeof value.action === 'string' ? value.action : undefined
}

/** 운영함 브라우저 시나리오에서 사용할 최소 피드백 티켓 fixture를 생성한다. */
function createAdminFeedbackTicket() {
  return {
    authorEmailSnapshot: 'feedback@example.com',
    authorProfileId: '00000000-0000-4000-8000-000000000001',
    body: '완독 목록을 더 쉽게 보고 싶어요.',
    category: 'feature',
    createdAt: '2026-07-18T00:00:00.000Z',
    handledAt: null,
    handledByProfileId: null,
    id: '8fc963a4-da01-4696-995c-755fe145776f',
    status: 'unread',
  }
}
