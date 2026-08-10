import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const roomId = '89544530-dd36-422b-aaff-b6a70180f521'
const bookChatId = '00000000-0000-4000-8000-000000000002'
const emojiBaseDataFixture = [
  { emoji: '😀', group: 0, label: '웃는 얼굴', subgroup: 0, tags: ['smile'], version: 0 },
  { emoji: '😃', group: 0, label: '큰 눈 웃는 얼굴', subgroup: 0, tags: ['smile'], version: 0 },
  { emoji: '😄', group: 0, label: '눈웃음 얼굴', subgroup: 0, tags: ['smile'], version: 0 },
  { emoji: '😁', group: 0, label: '활짝 웃는 얼굴', subgroup: 0, tags: ['smile'], version: 0 },
  { emoji: '😆', group: 0, label: '눈 감고 웃는 얼굴', subgroup: 0, tags: ['smile'], version: 0 },
  { emoji: '❤️', group: 0, label: '빨간 하트', subgroup: 0, tags: ['heart'], version: 0 },
  { emoji: '👍', group: 1, label: '엄지척', subgroup: 1, tags: ['thumb'], version: 0 },
  { emoji: '👏', group: 1, label: '박수', subgroup: 1, tags: ['clap'], version: 0 },
  { emoji: '👋', group: 1, label: '손 흔들기', subgroup: 1, tags: ['wave'], version: 0 },
  { emoji: '🙌', group: 1, label: '만세', subgroup: 1, tags: ['hooray'], version: 0 },
  { emoji: '🐵', group: 2, label: '원숭이 얼굴', subgroup: 2, tags: ['animal'], version: 0 },
  { emoji: '🐶', group: 2, label: '강아지 얼굴', subgroup: 2, tags: ['animal'], version: 0 },
  { emoji: '🍇', group: 3, label: '포도', subgroup: 3, tags: ['food'], version: 0 },
  { emoji: '🍎', group: 3, label: '사과', subgroup: 3, tags: ['food'], version: 0 },
  { emoji: '🌐', group: 4, label: '자오선이 있는 지구', subgroup: 4, tags: ['travel'], version: 0 },
  { emoji: '🌍', group: 4, label: '지구', subgroup: 4, tags: ['travel'], version: 0 },
  { emoji: '🗺️', group: 4, label: '지도', subgroup: 4, tags: ['map'], version: 0 },
  { emoji: '🔥', group: 4, label: '불꽃', subgroup: 4, tags: ['fire'], version: 0 },
  { emoji: '🌊', group: 4, label: '파도', subgroup: 4, tags: ['wave'], version: 0 },
  { emoji: '🎃', group: 5, label: '호박', subgroup: 5, tags: ['activity'], version: 0 },
  { emoji: '🎉', group: 5, label: '축하', subgroup: 5, tags: ['party'], version: 0 },
  { emoji: '👓', group: 6, label: '안경', subgroup: 6, tags: ['object'], version: 0 },
  { emoji: '💯', group: 6, label: '백점', subgroup: 6, tags: ['hundred'], version: 0 },
  { emoji: '🏧', group: 7, label: 'ATM', subgroup: 7, tags: ['symbol'], version: 0 },
  { emoji: '🚮', group: 7, label: '쓰레기통', subgroup: 7, tags: ['symbol'], version: 0 },
  { emoji: '🔣', group: 7, label: '기호', subgroup: 7, tags: ['symbol'], version: 0 },
  { emoji: '✨', group: 7, label: '반짝임', subgroup: 7, tags: ['sparkle'], version: 0 },
  { emoji: '🏁', group: 8, label: '깃발', subgroup: 8, tags: ['flag'], version: 0 },
  { emoji: '🚩', group: 8, label: '삼각 깃발', subgroup: 8, tags: ['flag'], version: 0 },
  { emoji: '😊', group: 0, label: '미소 짓는 얼굴', subgroup: 0, tags: ['smile'], version: 0 },
  { emoji: '😮', group: 0, label: '놀란 얼굴', subgroup: 0, tags: ['wow'], version: 0 },
  { emoji: '😂', group: 0, label: '웃겨요', subgroup: 0, tags: ['laugh'], version: 0 },
  { emoji: '😍', group: 0, label: '좋아해요', subgroup: 0, tags: ['love'], version: 0 },
  { emoji: '😭', group: 0, label: '울어요', subgroup: 0, tags: ['cry'], version: 0 },
  { emoji: '🤔', group: 0, label: '생각해요', subgroup: 0, tags: ['think'], version: 0 },
  { emoji: '👀', group: 0, label: '눈', subgroup: 0, tags: ['eyes'], version: 0 },
]
const emojiBaseMessagesFixture = {
  groups: [
    { key: 'smileys-emotion', message: '스마일리 및 감정', order: 0 },
    { key: 'people-body', message: '사람 및 몸', order: 1 },
    { key: 'animals-nature', message: '동물 및 자연', order: 2 },
    { key: 'food-drink', message: '음식 및 음료', order: 3 },
    { key: 'travel-places', message: '여행 및 장소', order: 4 },
    { key: 'activities', message: '활동', order: 5 },
    { key: 'objects', message: '사물', order: 6 },
    { key: 'symbols', message: '기호', order: 7 },
    { key: 'flags', message: '깃발', order: 8 },
  ],
  skinTones: [
    { key: 'light', message: '밝은 피부톤' },
    { key: 'medium-light', message: '중간 밝은 피부톤' },
    { key: 'medium', message: '중간 피부톤' },
    { key: 'medium-dark', message: '중간 어두운 피부톤' },
    { key: 'dark', message: '어두운 피부톤' },
  ],
  subgroups: [
    { key: 'face-smiling', message: '얼굴', order: 0 },
    { key: 'hand-fingers-open', message: '손', order: 1 },
    { key: 'animal-mammal', message: '동물', order: 2 },
    { key: 'food-fruit', message: '음식', order: 3 },
    { key: 'place-map', message: '장소', order: 4 },
    { key: 'event', message: '행사', order: 5 },
    { key: 'clothing', message: '물건', order: 6 },
    { key: 'alphanum', message: '기호', order: 7 },
    { key: 'flag', message: '깃발', order: 8 },
  ],
}

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
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()
    await expectPageToFitViewport(page, testInfo.project.use.viewport?.width ?? 640)
  }
})

test('renders profile edit controls with the current profile values', async ({
  page,
}, testInfo) => {
  let avatarUploadRequestCount = 0
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  page.on('request', (request) => {
    if (request.url().includes('/storage/v1/object/avatars/')) avatarUploadRequestCount += 1
  })
  await page.goto('/profile/edit')

  await expect(page.getByRole('heading', { name: '프로필 편집' })).toBeVisible()
  await expect(page.getByLabel('이름')).toHaveValue('민규')
  await expect(page.getByLabel('한 줄 소개')).toHaveValue('함께 읽고 오래 남겨요.')
  await page.getByLabel('프로필 사진 선택').setInputFiles({
    buffer: Buffer.from('profile-image'),
    mimeType: 'image/png',
    name: 'profile.png',
  })
  await expect(page.getByRole('button', { name: '사진 선택됨' })).toBeVisible()
  await expect(page.getByRole('button', { name: '저장하기' })).toBeEnabled()
  expect(avatarUploadRequestCount).toBe(0)
  await expect(page.getByLabel('이름').locator('xpath=..')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  )
  await page.screenshot({
    path: `artifacts/seed-comparison/9-profile-edit-after-${testInfo.project.name}.png`,
  })
})

test('uses SEED commands on the profile share card', async ({ page }, testInfo) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.goto('/profile/share')

  await expect(page.getByRole('heading', { name: '공유 카드' })).toBeVisible()
  await expect(page.getByRole('button', { name: '공유하기' })).toHaveClass(/seed-action-button/)
  const feedbackLauncherBox = await page.getByRole('button', { name: '의견 보내기' }).boundingBox()
  if (!feedbackLauncherBox) throw new Error('의견 보내기 버튼 위치를 읽지 못했어요.')
  expect(feedbackLauncherBox.x).toBeGreaterThanOrEqual(
    (testInfo.project.use.viewport?.width ?? 320) - 64,
  )
  await page.screenshot({
    path: `artifacts/seed-comparison/17-profile-share-after-${testInfo.project.name}.png`,
  })
})

test('uses SEED menu rows on the profile hub', async ({ page }, testInfo) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.goto('/profile')

  await expect(page.getByRole('heading', { name: '민규' })).toBeVisible()
  await expect(page.getByRole('button', { name: '내 정보 수정' })).toHaveClass(/seed-action-button/)
  await page.screenshot({
    path: `artifacts/seed-comparison/18-profile-hub-after-${testInfo.project.name}.png`,
  })
})

test('renders account settings controls with current preferences', async ({ page }, testInfo) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.goto('/profile/settings')

  await expect(page.getByRole('heading', { name: '계정 설정' })).toBeVisible()
  await expect(page.getByText('e2e@example.com')).toBeVisible()
  await page.screenshot({
    path: `artifacts/seed-comparison/10-account-settings-after-${testInfo.project.name}.png`,
  })
  await expect(page.getByText('e2e@example.com').locator('xpath=ancestor::dl')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  )
  await expect(page.getByRole('switch', { name: '멘션 알림' })).toBeChecked()
})

test('renders room settings with SEED form controls', async ({ page }, testInfo) => {
  await authenticatePage(page)
  await mockRoomManagementPageData(page)
  await page.goto(`/rooms/${roomId}/manage/settings`)

  await expect(page.getByRole('heading', { name: '책방을 소개해 주세요' })).toBeVisible()
  await page.screenshot({
    path: `artifacts/seed-comparison/12-room-settings-after-${testInfo.project.name}.png`,
  })
  await expect(page.getByLabel('책방 이름').locator('xpath=..')).toHaveClass(/seed-text-input/)
  await expect(page.getByLabel('책방 이름').locator('xpath=..')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  )
  await expect(page.getByRole('button', { name: '저장하기' })).toHaveClass(/seed-action-button/)
})

test('renders room creation with white SEED information fields', async ({ page }, testInfo) => {
  await authenticatePage(page)
  await page.goto('/rooms/create')

  await expect(page.getByRole('heading', { name: '책방 만들기' })).toBeVisible()
  await expect(page.getByLabel('책방 이름').locator('xpath=..')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  )
  await page.screenshot({
    path: `artifacts/seed-comparison/19-create-room-after-${testInfo.project.name}.png`,
  })
})

test('shares a newly created room from the completion screen', async ({ page }, testInfo) => {
  await authenticatePage(page)
  await page.context().grantPermissions(['clipboard-write'])
  await mockAuthenticatedPageData(page)
  await page.route('**/rest/v1/rpc/create_reading_room', async (route) => {
    await route.fulfill({
      body: JSON.stringify([{ room_id: '00000000-0000-4000-8000-000000000101' }]),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/rpc/create_room_invite', async (route) => {
    await route.fulfill({
      body: JSON.stringify([
        {
          code: 'TALK87',
          expires_at: '2026-08-02T00:00:00+00:00',
          token: 'a'.repeat(64),
        },
      ]),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.goto('/rooms/create')

  await page.getByLabel('책방 이름').fill('금요일 아침 책방')
  await page.getByRole('button', { name: '책방 만들기' }).click()

  await expect(page.getByRole('heading', { name: '책방 만들기 완료' })).toBeVisible()
  await expect(page.getByText('TALK87')).toBeVisible()
  await expect(page.getByRole('button', { name: '카카오톡으로 초대 보내기' })).toBeVisible()
  await expect(page.getByRole('button', { name: '인스타그램으로 초대 보내기' })).toBeVisible()
  await expect(page.getByRole('button', { name: '페이스북으로 초대 보내기' })).toBeVisible()
  await page.getByRole('button', { name: '초대 코드 복사하기' }).click()
  await expect(page.getByText('초대 코드를 복사했어요.')).toBeVisible()
  await page.screenshot({
    path: `artifacts/invite-sharing/room-created-${testInfo.project.name}.png`,
    fullPage: true,
  })
})

test('renders invite-code entry with a white SEED information field', async ({
  page,
}, testInfo) => {
  await authenticatePage(page)
  await page.goto('/rooms/join')

  await expect(page.getByRole('heading', { name: '책방 초대장을 받았어요' })).toBeVisible()
  await expect(page.getByLabel('6자리 초대 코드').locator('xpath=..')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  )
  await page.screenshot({
    path: `artifacts/seed-comparison/20-join-room-after-${testInfo.project.name}.png`,
  })
})

test('captures the remaining SEED information screens together', async ({ page }, testInfo) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await mockRoomManagementPageData(page)

  await page.goto('/rooms/archive')
  await expect(page.getByText('아직 보관한 책방이 없어요')).toBeVisible()
  await page.screenshot({
    path: `artifacts/seed-comparison/21-archived-rooms-after-${testInfo.project.name}.png`,
  })

  await page.goto(`/rooms/${roomId}/members/00000000-0000-4000-8000-000000000001`)
  await expect(page.getByRole('heading', { name: '민규' })).toBeVisible()
  await page.screenshot({
    path: `artifacts/seed-comparison/22-member-profile-after-${testInfo.project.name}.png`,
  })

  await page.goto('/notifications')
  await expect(page.getByText('아직 새로운 알림이 없어요')).toBeVisible()
  await page.screenshot({
    path: `artifacts/seed-comparison/23-notifications-after-${testInfo.project.name}.png`,
  })

  await page.goto('/contact')
  await expect(page.getByRole('heading', { name: '서비스 정보' })).toBeVisible()
  await page.screenshot({
    path: `artifacts/seed-comparison/24-contact-after-${testInfo.project.name}.png`,
  })
})

test('uses the bottom-navigation token as the global page bottom spacing', async ({ page }) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.goto('/rooms')

  await expect(page.locator('.app-with-bottom-navigation')).toHaveCSS('padding-bottom', '72px')
})

test('slides the highlighted bestseller card instead of replacing the page content', async ({
  page,
}, testInfo) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await mockBestsellers(page)
  await page.goto('/rooms')

  const track = page.getByTestId('bestseller-track')
  await expect(track).toHaveCSS('transition-duration', '0.5s')
  await expect(track).toHaveAttribute('style', 'transform: translateX(0%);')
  await expect(page.locator('[aria-label="다른 추천 도서"] .line-clamp-2').first()).toHaveCSS(
    'white-space',
    'normal',
  )
  await page.screenshot({
    path: `artifacts/seed-comparison/main-bestseller-after-${testInfo.project.name}.png`,
  })

  await page.getByRole('button', { name: '다음 추천 보기' }).click()

  await expect(track).toHaveAttribute('style', 'transform: translateX(-100%);')
  await expectPageToFitViewport(page, testInfo.project.use.viewport?.width ?? 640)
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

test('uses SEED commands and a confirmation dialog in room management', async ({
  page,
}, testInfo) => {
  await authenticatePage(page)
  await mockRoomManagementPageData(page)
  await page.goto(`/rooms/${roomId}/manage`)

  await expect(page.getByRole('button', { name: '초대 코드 만들기' })).toHaveClass(
    /seed-action-button/,
  )
  await page.getByRole('button', { name: '방 보관하고 나가기' }).click()
  await expect(page.getByRole('dialog', { name: '이 방을 보관할까요?' })).toBeVisible()
  await page.waitForTimeout(300)
  await expect(page.getByRole('button', { name: '취소' }).locator('..')).toHaveCSS('gap', '8px')
  await page.screenshot({
    path: `artifacts/seed-comparison/13-room-management-after-${testInfo.project.name}.png`,
  })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '이 방을 보관할까요?' })).toBeHidden()
})

test('reveals room invite sharing inline without opening a bottom sheet', async ({
  page,
}, testInfo) => {
  await authenticatePage(page)
  await mockRoomManagementPageData(page)
  await page.route('**/rest/v1/rpc/create_room_invite', async (route) => {
    await route.fulfill({
      body: JSON.stringify([
        {
          code: 'TALK87',
          expires_at: '2026-08-02T00:00:00+00:00',
          invite_id: '00000000-0000-4000-8000-000000000011',
          token: 'a'.repeat(64),
        },
      ]),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.goto(`/rooms/${roomId}/manage`)
  await page.getByRole('button', { name: '초대 코드 만들기' }).click()
  await expect(page.getByRole('dialog', { name: '책방 초대하기' })).toHaveCount(0)
  await page.getByRole('button', { name: '친구에게 공유하기' }).click()

  const shareOptions = page.getByRole('region', { name: '초대 공유 옵션' })
  await expect(shareOptions).toBeVisible()
  await expect(shareOptions.getByRole('button', { name: '카카오톡으로 초대 보내기' })).toBeVisible()
  await page.waitForTimeout(400)

  const viewportWidth = testInfo.project.use.viewport?.width ?? 640
  const optionsBox = await shareOptions.boundingBox()

  expect(optionsBox).not.toBeNull()
  expect(Math.round(optionsBox!.width)).toBeLessThanOrEqual(Math.min(viewportWidth, 640))
})

test('renders room detail command controls with SEED components', async ({ page }, testInfo) => {
  await authenticatePage(page)
  await page.route('**/rest/v1/reading_rooms?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify({ description: '함께 읽는 책들', id: roomId, name: '금요일 아침 책방' }),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/book_chats?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify([
        {
          books: { authors: ['기시미 이치로'], thumbnail_url: null, title: '미움받을 용기' },
          id: bookChatId,
          name: '미움받을 용기',
        },
      ]),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/book_chat_completions?*', async (route) => {
    await route.fulfill({ body: JSON.stringify([]), contentType: 'application/json', status: 200 })
  })
  await page.route('**/rest/v1/book_chat_reading_progresses?*', async (route) => {
    await route.fulfill({ body: JSON.stringify([]), contentType: 'application/json', status: 200 })
  })
  await page.goto(`/rooms/${roomId}`)

  await expect(page.getByRole('heading', { name: '금요일 아침 책방' })).toBeVisible()
  await expect(page.getByText('미움받을 용기', { exact: true })).toHaveCSS('white-space', 'normal')
  await page.screenshot({
    path: `artifacts/seed-comparison/14-room-detail-after-${testInfo.project.name}.png`,
  })
  await expect(page.getByRole('button', { name: '전체 책갈피' })).toHaveClass(/seed-action-button/)
})

test('renders book-chat management deletion controls with SEED components', async ({
  page,
}, testInfo) => {
  let progress = {
    book_chat_id: bookChatId,
    current_page: 0,
    total_pages: 1,
    updated_at: '2026-08-02T00:00:00+00:00',
  }
  await authenticatePage(page)
  await page.route('**/rest/v1/book_chats?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        books: { thumbnail_url: null, title: '미움받을 용기' },
        id: bookChatId,
        name: '미움받을 용기',
        room_id: roomId,
        status: 'reading',
      }),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/book_chat_completions?*', async (route) => {
    await route.fulfill({ body: JSON.stringify([]), contentType: 'application/json', status: 200 })
  })
  await mockReadingProgresses(page, () => [progress])
  await page.route('**/rest/v1/rpc/upsert_book_chat_reading_progress', async (route) => {
    const request = route.request().postDataJSON() as {
      p_current_page: number
      p_total_pages: number
    }
    progress = {
      book_chat_id: bookChatId,
      current_page: request.p_current_page,
      total_pages: request.p_total_pages,
      updated_at: '2026-08-02T00:01:00+00:00',
    }
    await route.fulfill({ body: 'null', contentType: 'application/json', status: 200 })
  })
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/manage`)

  await expect(page.getByRole('heading', { name: '미움받을 용기' })).toBeVisible()
  const currentPageInput = page.getByRole('textbox', { name: '현재 페이지' })
  const totalPagesInput = page.getByRole('textbox', { name: '전체 페이지' })
  await expect(currentPageInput).toHaveAttribute('inputmode', 'numeric')
  await expect(currentPageInput).toHaveAttribute('type', 'text')
  await expect(page.locator('label[for="reading-current-page"]')).toHaveCSS('white-space', 'nowrap')
  await expect(page.locator('label[for="reading-total-pages"]')).toHaveCSS('white-space', 'nowrap')
  const currentPageInputBox = await currentPageInput.boundingBox()
  const totalPagesInputBox = await totalPagesInput.boundingBox()
  expect(currentPageInputBox).not.toBeNull()
  expect(totalPagesInputBox).not.toBeNull()
  expect(Math.round(currentPageInputBox!.width)).toBe(Math.round(totalPagesInputBox!.width))
  await expect(page.getByRole('button', { name: '진행률 저장' })).toBeDisabled()
  await currentPageInput.fill('87')
  await totalPagesInput.fill('320')
  await expect(page.getByRole('button', { name: '진행률 저장' })).toBeEnabled()
  const submitBox = await page.locator('.talkhugam-reading-progress-submit').boundingBox()
  expect(submitBox).not.toBeNull()
  expect(submitBox!.y).toBeGreaterThan(currentPageInputBox!.y + currentPageInputBox!.height + 20)
  await page.getByRole('button', { name: '진행률 저장' }).click()
  await expect(page.getByRole('progressbar', { name: '독서 진행률 27%' })).toBeVisible()
  await page.screenshot({
    path: `artifacts/seed-comparison/15-reading-progress-after-${testInfo.project.name}.png`,
  })
  await page.getByRole('button', { name: '삭제 요청' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({
    path: `artifacts/seed-comparison/15-book-chat-management-after-${testInfo.project.name}.png`,
  })
  await expect(page.getByLabel('삭제할 책 이름').locator('xpath=..')).toHaveClass(/seed-text-input/)
})

test('shows my completed-book rating and review before opening the edit sheet', async ({
  page,
}) => {
  await authenticatePage(page)
  await page.route('**/rest/v1/book_chats?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        books: { thumbnail_url: null, title: '미움받을 용기' },
        id: bookChatId,
        name: '미움받을 용기',
        room_id: roomId,
        status: 'reading',
      }),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/book_chat_completions?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify([
        {
          book_chats: {
            room_members: [
              {
                profile_id: '00000000-0000-4000-8000-000000000001',
                room_avatar_path: null,
                room_display_name: '민규',
              },
            ],
          },
          completed_at: '2026-08-02T00:00:00+00:00',
          profile_id: '00000000-0000-4000-8000-000000000001',
          profiles: { avatar_path: null, display_name: '민규' },
          rating: 4,
          review: '다시 읽고 싶은 문장이 많아요.',
        },
      ]),
      contentType: 'application/json',
      status: 200,
    })
  })
  await mockReadingProgresses(page, () => [])
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/manage`)

  await expect(page.getByRole('heading', { name: '내 완독 기록' })).toBeVisible()
  await expect(page.getByText('별점 4점')).toBeVisible()
  await expect(page.getByText('다시 읽고 싶은 문장이 많아요.')).toBeVisible()
  await page.getByRole('button', { name: '완독 기록 수정' }).click()
  await expect(page.getByRole('dialog', { name: '완독 기록' })).toBeVisible()
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
  const roomsNavigationButton = page.getByRole('button', { name: '책방', exact: true })
  const profileNavigationButton = page.getByRole('button', { name: '내 정보', exact: true })
  const navigationBox = await page.getByRole('navigation', { name: '주요 메뉴' }).boundingBox()
  const actionButtonBox = await actionMenuButton.boundingBox()
  const roomsNavigationButtonBox = await roomsNavigationButton.boundingBox()
  const profileNavigationButtonBox = await profileNavigationButton.boundingBox()

  expect(navigationBox).not.toBeNull()
  expect(actionButtonBox).not.toBeNull()
  expect(roomsNavigationButtonBox).not.toBeNull()
  expect(profileNavigationButtonBox).not.toBeNull()
  expect(
    Math.abs(actionButtonBox!.y + actionButtonBox!.height / 2 - navigationBox!.y),
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(
      roomsNavigationButtonBox!.x +
        roomsNavigationButtonBox!.width / 2 -
        (navigationBox!.x + navigationBox!.width * 0.25),
    ),
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(
      profileNavigationButtonBox!.x +
        profileNavigationButtonBox!.width / 2 -
        (navigationBox!.x + navigationBox!.width * 0.75),
    ),
  ).toBeLessThanOrEqual(1)

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
  expect(
    await messageInput.evaluate((element) => window.getComputedStyle(element).scrollbarWidth),
  ).toBe('none')
})

test('keeps the chat input readable and aligns my discussion records to the right', async ({
  page,
}, testInfo) => {
  const currentMemberId = '8fc963a4-da01-4696-995c-755fe145776f'
  await authenticatePage(page)
  await mockEmojiPickerData(page)
  await mockVideoMembers(page, [
    createVideoMember(currentMemberId, '민규', true),
    createVideoMember('b21f0060-cd1d-40db-a6ae-fd2eb3e9f862', '수진'),
  ])
  await page.route('**/rest/v1/posts?*', async (route) => {
    const type = new URL(route.request().url()).searchParams.get('type')
    const posts =
      type === 'eq.video'
        ? [
            {
              author_member_id: currentMemberId,
              author_name_snapshot: '민규',
              body: null,
              created_at: '2026-07-18T00:02:00.000+00:00',
              id: 'e45b7500-b6bd-43d6-8438-e5b643c84282',
              video_assets: { status: 'failed' },
            },
          ]
        : [
            {
              author_member_id: currentMemberId,
              author_name_snapshot: '민규',
              body: '@수진 같이 읽고 싶어요.',
              created_at: '2026-07-18T00:00:00.000+00:00',
              depth: 0,
              id: '4b7227b2-5350-4a61-9114-b2d0c915fd1b',
              post_labels: [],
              root_post_id: null,
            },
            {
              author_member_id: 'b21f0060-cd1d-40db-a6ae-fd2eb3e9f862',
              author_name_snapshot: '수진',
              body: '저도 좋아요.',
              created_at: '2026-07-18T00:01:00.000+00:00',
              depth: 0,
              id: 'c4cf2891-1d05-44f4-b9bf-2c2b4d302456',
              post_labels: [],
              root_post_id: null,
            },
          ]
    await route.fulfill({
      body: JSON.stringify(posts),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)

  const composer = page.getByRole('textbox', { name: '메시지 입력' })
  await expect(composer).toHaveCSS('font-size', '16px')
  await expect(page.getByText('@수진', { exact: true })).toHaveClass(/text-primary/)
  await expect(page.getByText('같이 읽고 싶어요.').locator('xpath=ancestor::li[1]')).toHaveClass(
    /justify-end/,
  )
  await expect(page.getByText('저도 좋아요.').locator('xpath=ancestor::li[1]')).toHaveClass(
    /justify-start/,
  )
  await page.getByRole('tab', { name: '책갈피' }).click()
  await expect(
    page.getByText('영상 처리를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'),
  ).toBeVisible()
  await expectPageToFitViewport(page, testInfo.project.use.viewport?.width ?? 640)
})

test('opens compact book-chat reply and reaction controls from a message', async ({
  page,
}, testInfo) => {
  const currentMemberId = '8fc963a4-da01-4696-995c-755fe145776f'
  const postId = '4b7227b2-5350-4a61-9114-b2d0c915fd1b'
  const reactions = [
    {
      created_at: '2026-07-18T00:00:30.000+00:00',
      emoji: '❤️',
      member_id: currentMemberId,
      post_id: postId,
    },
  ]
  let replyRequestCount = 0

  await authenticatePage(page)
  await mockEmojiPickerData(page)
  await mockVideoMembers(page, [
    createVideoMember(currentMemberId, '민규', true),
    createVideoMember('b21f0060-cd1d-40db-a6ae-fd2eb3e9f862', '서연'),
  ])
  await page.route('**/rest/v1/posts?*', async (route) => {
    const type = new URL(route.request().url()).searchParams.get('type')
    const posts =
      type === 'eq.video'
        ? []
        : [
            {
              author_member_id: 'b21f0060-cd1d-40db-a6ae-fd2eb3e9f862',
              author_name_snapshot: '서연',
              body: '아침은 이미 잔뜩 먹었고 커피도 마셨어요.',
              created_at: '2026-07-18T00:00:00.000+00:00',
              depth: 0,
              id: postId,
              post_labels: [],
              root_post_id: null,
            },
            {
              author_member_id: currentMemberId,
              author_name_snapshot: '민규',
              body: 'ㅋㅋ',
              created_at: '2026-07-18T00:00:30.000+00:00',
              depth: 1,
              id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
              post_labels: [],
              root_post_id: postId,
            },
          ]
    await route.fulfill({
      body: JSON.stringify(posts),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/post_reactions?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify(reactions),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/rpc/toggle_post_reaction', async (route) => {
    const request = route.request().postDataJSON() as { p_emoji: string; p_post_id: string }
    reactions.push({
      created_at: '2026-07-18T00:01:00.000+00:00',
      emoji: request.p_emoji,
      member_id: currentMemberId,
      post_id: request.p_post_id,
    })
    await route.fulfill({ body: 'null', contentType: 'application/json', status: 200 })
  })
  await page.route('**/rest/v1/rpc/create_reply', async (route) => {
    replyRequestCount += 1
    await route.fulfill({
      body: JSON.stringify('f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e'),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)

  const rootMessage = page.getByText('아침은 이미 잔뜩 먹었고 커피도 마셨어요.')
  await rootMessage.hover()
  await expect(page.getByRole('button', { name: '서연에게 답글' })).toBeVisible()
  await expect(page.getByRole('button', { name: '❤️ 반응 1개, 내가 남김' })).toBeVisible()
  await expect(page.getByRole('button', { name: '이모지 반응 열기' })).toBeVisible()
  const rootMessageBox = await page.getByLabel('서연의 메시지').boundingBox()
  const quickActionBox = await page.getByLabel('메시지 빠른 액션').boundingBox()
  if (!rootMessageBox || !quickActionBox) {
    throw new Error('메시지 말풍선과 빠른 액션의 위치를 확인할 수 없어요.')
  }
  expect(Math.round(quickActionBox.x)).toBeGreaterThanOrEqual(Math.round(rootMessageBox.x))
  await expect(page.getByRole('button', { name: '👍 반응 남기기' })).toBeVisible()
  await expect(page.getByRole('button', { name: '👎 반응 남기기' })).toBeVisible()
  await expect(page.getByRole('button', { name: '😢 반응 남기기' })).toBeVisible()
  const quickEmojiBox = await page.getByRole('button', { name: '👍 반응 남기기' }).boundingBox()
  if (!quickEmojiBox) throw new Error('빠른 이모지 버튼 크기를 확인할 수 없어요.')
  expect(Math.round(quickEmojiBox.width)).toBe(44)
  expect(Math.round(quickEmojiBox.height)).toBe(44)
  await page.getByRole('button', { name: '이모지 반응 열기' }).click()
  const reactionPackage = page.getByRole('group', { name: 'Talk후감 이모티콘 패키지' })
  await expect(reactionPackage).toBeVisible()
  await expect(page.getByRole('searchbox', { name: '이모지 검색' })).toBeVisible()
  const categoryTabs = page.getByRole('tablist', { name: '이모지 카테고리' })
  await expect(categoryTabs).toBeVisible()
  await expect(page.getByRole('tab', { name: '스마일리 및 감정' })).toHaveText('😀')
  await expect(page.getByRole('tab', { name: '여행 및 장소' })).toHaveText('🌐')
  await expect(page.getByRole('tab', { name: '활동' })).toHaveText('🎃')
  await expect(page.getByRole('tab', { name: '기호' })).toHaveText('🏧')
  await expect(page.getByRole('tab', { name: '깃발' })).toHaveText('🏁')
  await expect(page.getByRole('tab', { name: '스마일리 및 감정' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByText('Category')).toBeHidden()
  const reactionPackageBox = await reactionPackage.boundingBox()
  if (!reactionPackageBox) throw new Error('이모티콘 패키지 위치를 확인할 수 없어요.')
  const viewportWidth = testInfo.project.use.viewport?.width ?? 640
  expect(Math.round(reactionPackageBox.height)).toBeGreaterThanOrEqual(400)
  expect(Math.round(reactionPackageBox.y)).toBeGreaterThanOrEqual(0)
  expect(Math.round(reactionPackageBox.x + reactionPackageBox.width)).toBeLessThanOrEqual(
    viewportWidth,
  )
  expect(await categoryTabs.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
    true,
  )
  await page.getByRole('tab', { name: '여행 및 장소' }).click()
  await expect(page.getByRole('tab', { name: '여행 및 장소' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('gridcell', { name: '🌐 반응 남기기' })).toBeVisible()
  await page.getByRole('tab', { name: '스마일리 및 감정' }).click()
  await expect(page.getByRole('gridcell', { name: '😀 반응 남기기' })).toBeVisible()
  await categoryTabs.evaluate((element) => {
    element.scrollLeft = element.scrollWidth
  })
  await expect.poll(() => categoryTabs.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  await categoryTabs.evaluate((element) => {
    element.scrollLeft = 0
  })
  await page.screenshot({
    path: `artifacts/seed-comparison/22-book-chat-reaction-picker-open-${testInfo.project.name}.png`,
  })
  await page.getByRole('gridcell', { name: '😀 반응 남기기' }).click()
  await expect(page.getByRole('button', { name: '😀 반응 1개, 내가 남김' })).toBeVisible()
  await rootMessage.hover()
  await page.getByRole('button', { name: '이모지 반응 열기' }).click()
  await page.getByRole('searchbox', { name: '이모지 검색' }).fill('불꽃')
  await expect(page.getByRole('gridcell', { name: '🔥 반응 남기기' })).toBeVisible()
  await page.getByRole('gridcell', { name: '🔥 반응 남기기' }).click()
  await expect(page.getByRole('button', { name: '🔥 반응 1개, 내가 남김' })).toBeVisible()
  await rootMessage.hover()
  await page.getByRole('button', { name: '서연에게 답글' }).click()

  await expect(page.getByText('서연에게 답글')).toBeVisible()
  await expect(page.getByRole('textbox', { name: '메시지 입력' })).toHaveAttribute(
    'placeholder',
    '답글을 입력하세요.',
  )
  await page.getByRole('textbox', { name: '메시지 입력' }).fill('저도 그 문장 좋았어요.')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect.poll(() => replyRequestCount).toBe(1)
  const shortReplyBox = await page.getByText('ㅋㅋ').locator('xpath=ancestor::div[1]').boundingBox()
  if (!shortReplyBox) throw new Error('짧은 답글 말풍선의 크기를 확인할 수 없어요.')
  expect(Math.round(shortReplyBox.width)).toBeGreaterThanOrEqual(144)
  await page.screenshot({
    path: `artifacts/seed-comparison/22-book-chat-reply-actions-after-${testInfo.project.name}.png`,
  })
  await expectPageToFitViewport(page, testInfo.project.use.viewport?.width ?? 640)
})

test('keeps room invitation controls out of the simplified book-chat plus menu', async ({
  page,
}) => {
  await authenticatePage(page)
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)

  await page.getByRole('button', { name: '메시지 추가 메뉴 열기' }).click()
  await expect(page.getByRole('button', { name: '라벨 등록' })).toBeVisible()
  await expect(page.getByRole('button', { name: '영상 기록' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '초대 요청' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '책방 초대하기' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '완독 기록' })).toHaveCount(0)
})

test('closes the account deletion dialog by Escape and backdrop while restoring trigger focus', async ({
  page,
}, testInfo) => {
  await authenticatePage(page)
  await mockAuthenticatedPageData(page)
  await page.goto('/profile/settings')

  const deletionTrigger = page.getByRole('button', { name: '계정 삭제', exact: true })
  await deletionTrigger.click()
  await expect(page.getByRole('dialog', { name: '계정 삭제' })).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({
    path: `artifacts/seed-comparison/11-account-deletion-after-${testInfo.project.name}.png`,
  })
  await expect(page.getByRole('button', { name: '대화 기록은 남기고 탈퇴' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '계정 삭제' })).toBeHidden()
  await expect(deletionTrigger).toBeFocused()

  await deletionTrigger.click()
  await page.locator('.seed-dialog__backdrop').click({ position: { x: 4, y: 4 } })
  await expect(page.getByRole('dialog', { name: '계정 삭제' })).toBeHidden()
  await expect(deletionTrigger).toBeFocused()
})

test('resets a dismissed book-chat label editor while keeping the message draft', async ({
  page,
}, testInfo) => {
  await authenticatePage(page)
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)

  await page.getByRole('button', { name: '메시지 추가 메뉴 열기' }).click()
  await expectDialogToFitViewport(page, '메시지 추가', testInfo.project.use.viewport?.height ?? 900)
  await expect(page.getByRole('button', { name: '라벨 등록' })).toHaveClass(
    /talkhugam-action-sheet-choice/,
  )
  await page.screenshot({
    path: `artifacts/seed-comparison/8-book-discussion-action-menu-after-${testInfo.project.name}.png`,
  })
  await page.getByRole('button', { name: '라벨 등록' }).click()
  await page.getByRole('button', { name: '페이지 라벨' }).click()
  await page.getByRole('textbox', { name: '페이지 번호' }).fill('87')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('textbox', { name: '페이지 번호' })).toBeHidden()

  const composer = page.getByRole('textbox', { name: '메시지 입력' })
  await composer.fill('이 문장을 기억할게요')

  await page.getByRole('button', { name: '메시지 추가 메뉴 열기' }).click()
  await expect(page.getByRole('button', { name: '라벨 등록' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '페이지 번호' })).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '메시지 추가' })).toBeHidden()
  await expect(composer).toHaveValue('이 문장을 기억할게요')

  await page.getByRole('button', { name: '메시지 추가 메뉴 열기' }).click()
  await page.getByRole('button', { name: '라벨 등록' }).click()
  await page.getByRole('button', { name: '페이지 라벨' }).click()
  await expect(page.getByRole('textbox', { name: '페이지 번호' })).toHaveValue('')

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
  expect(accessibilityScanResults.violations).toEqual([])

  await page.keyboard.press('Escape')
  await expect(page.getByRole('textbox', { name: '페이지 번호' })).toBeHidden()
})

test('opens the current book bookmark screen from the bookmark tab CTA', async ({
  page,
}, testInfo) => {
  const bookTitle = '미움받을 용기(200만 부 기념 스페셜 에디션)'
  await authenticatePage(page)
  await mockBookDiscussionHeader(page, bookTitle)
  await mockVideoPosts(page, [])
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)

  await page.getByRole('tab', { name: '책갈피' }).click()
  await expect(page.getByText(`금요일 아침 책방 - ${bookTitle}`)).toBeVisible()
  await expect(page.getByText(`금요일 아침 책방 - ${bookTitle}`)).toHaveCSS('white-space', 'nowrap')
  await expect(page.getByRole('heading', { name: bookTitle })).toHaveCount(0)
  await expect(page.getByText('영감을 받은 특별한 구절에 책갈피를 꽂아보아요.')).toBeVisible()
  await expect(page.getByRole('heading', { name: '함께 읽은 순간' })).toHaveCount(0)
  await expect(page.getByText('영상으로 남긴 책갈피를 모아 봐요.')).toHaveCount(0)
  await expect(page.getByText('아직 남긴 책갈피가 없어요.')).toBeVisible()
  await expect(page.getByText('마음에 든 문장을 짧은 영상으로 남겨 보세요.')).toBeVisible()
  await expectPageToFitViewport(page, testInfo.project.use.viewport?.width ?? 640)
  await page.screenshot({
    path: `artifacts/seed-comparison/5-book-chat-bookmark-tab-after-${testInfo.project.name}.png`,
  })
  await page.getByRole('button', { name: '책갈피 남기기' }).click()

  await expect(page).toHaveURL(`/rooms/${roomId}/books/${bookChatId}/videos`)
  await expect(page.getByRole('heading', { name: '책갈피를 어떻게 남길까요?' })).toBeVisible()
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
  await expect(page.locator('nav[aria-label="주요 메뉴"]')).toBeVisible()

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
  await expect(page.getByText('완독 기록을 남겼어요.')).toBeVisible()
  await page.getByRole('button', { name: '미움받을 용기 기록 수정' }).click()
  await expect(page.getByRole('dialog', { name: '완독 기록' })).toBeVisible()
  await expect(page.getByRole('button', { name: '4점' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('textbox', { name: '총평 (선택)' })).toHaveValue(
    '다시 읽고 싶은 문장이 많아요.',
  )
  await expect(page.locator('nav[aria-label="주요 메뉴"]')).toBeVisible()
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
  await page.getByRole('textbox', { name: '현재 읽은 페이지' }).fill('146')
  await page.getByRole('button', { name: '진행률 저장' }).click()
  await expect(page.getByText('146 / 320쪽')).toBeVisible()

  await page.reload()
  await expect(page.getByText('146 / 320쪽')).toBeVisible()
  await page.getByRole('button', { name: '미움받을 용기 완독하기' }).click()
  await page.getByRole('button', { name: '5점' }).click()
  await page.getByRole('textbox', { name: '총평 (선택)' }).fill('다시 읽고 싶은 문장이 많아요.')
  await page.getByRole('button', { name: '완독 기록 저장' }).click()

  await expect(page.getByRole('dialog', { name: '완독 기록' })).toBeHidden()
  await expect(page.getByText('완독 기록을 남겼어요.')).toBeVisible()
  await expect(page.getByText('별점 5점')).toBeVisible()
  await page.getByRole('button', { name: '미움받을 용기 기록 수정' }).click()
  await expect(page.getByRole('textbox', { name: '총평 (선택)' })).toHaveValue(
    '다시 읽고 싶은 문장이 많아요.',
  )
})
test('keeps a bookmark video preview rectangular and plays it in place', async ({ page }) => {
  const videoId = '4b7227b2-5350-4a61-9114-b2d0c915fd1b'
  await authenticatePage(page)
  await mockVideoPosts(page, [createVideoPostRow(videoId, '민규', 'ready')])
  await mockMuxThumbnailTokens(page)
  await mockMuxPlaybackAuthorizationSuccess(page)
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)
  await page.getByRole('tab', { name: '책갈피' }).click()

  const preview = page.getByRole('button', { name: '민규님의 영상 보기' })
  await expect(preview).toBeVisible()

  const previewBox = await preview.boundingBox()
  const bookmarkCardBox = await preview.locator('xpath=ancestor::article[1]').boundingBox()
  expect(previewBox).not.toBeNull()
  expect(bookmarkCardBox).not.toBeNull()
  if (!previewBox || !bookmarkCardBox) throw new Error('영상 미리보기의 화면 크기를 읽지 못했어요.')

  expect(previewBox.width / bookmarkCardBox.width).toBeLessThanOrEqual(1)
  expect(previewBox.width / previewBox.height).toBeGreaterThan(2.8)
  expect(previewBox.width / previewBox.height).toBeLessThan(3.2)

  await preview.click()

  await expect(page).toHaveURL(`/rooms/${roomId}/books/${bookChatId}`)
  await expect(page.locator('mux-player')).toBeVisible()
  await expect(page.locator('mux-player')).toHaveAttribute('autoplay')
  const inlinePlayerBox = await page.locator('mux-player').boundingBox()
  expect(inlinePlayerBox).not.toBeNull()
  if (!inlinePlayerBox) throw new Error('책갈피 인라인 재생기의 화면 크기를 읽지 못했어요.')
  expect(Math.round(inlinePlayerBox.width)).toBeLessThanOrEqual(Math.round(bookmarkCardBox.width))
  expect(inlinePlayerBox.width / inlinePlayerBox.height).toBeGreaterThan(2.8)
  expect(inlinePlayerBox.width / inlinePlayerBox.height).toBeLessThan(3.2)
})

test('opens the upload picker from the bookmark creation screen', async ({ page }, testInfo) => {
  await authenticatePage(page)
  await mockVideoMembers(page)
  await mockVideoPosts(page, [])
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/videos`)

  await expect(page.getByRole('heading', { name: '책갈피를 어떻게 남길까요?' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: '촬영해서 남기기 지금 장면을 바로 찍어요' }),
  ).toHaveClass(/seed-action-button/)
  await expect(
    page.getByRole('button', { name: '갤러리에서 올리기 이미 찍은 영상을 붙여요' }),
  ).toHaveClass(/seed-action-button/)
  await expect(page.getByRole('button', { name: '책갈피 남기기' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '전체' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '멤버 필터: 모든 멤버' })).toHaveCount(0)
  await expect(page.getByRole('list', { name: '책갈피' })).toHaveCount(0)
  await page.getByRole('textbox', { name: '마음에 든 문장' }).fill('다시 펼치고 싶은 문장')
  await expectPageToFitViewport(page, testInfo.project.use.viewport?.width ?? 640)
  await page.screenshot({
    path: `artifacts/seed-comparison/6-bookmark-composer-after-${testInfo.project.name}.png`,
  })

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '갤러리에서 올리기 이미 찍은 영상을 붙여요' }).click()
  const fileChooser = await fileChooserPromise

  expect(fileChooser.isMultiple()).toBe(false)
})

test('keeps the bookmark creation screen focused on capture and upload choices', async ({
  page,
}, testInfo) => {
  await authenticatePage(page)
  await mockVideoMembers(page)
  await mockVideoPosts(page, [createVideoPostRow('4b7227b2-5350-4a61-9114-b2d0c915fd1b', '민규')])
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/videos`)

  await expect(page.getByRole('heading', { name: '책갈피를 어떻게 남길까요?' })).toBeVisible()
  await expect(
    page.getByText('마음에 든 문장을 적고, 촬영하거나 갤러리에서 영상을 붙여요.'),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '촬영해서 남기기 지금 장면을 바로 찍어요' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '갤러리에서 올리기 이미 찍은 영상을 붙여요' }),
  ).toBeVisible()
  await expect(page.getByText('민규님의 책갈피')).toHaveCount(0)
  await expectPageToFitViewport(page, testInfo.project.use.viewport?.width ?? 640)
  await page.screenshot({
    path: `artifacts/seed-comparison/5-bookmark-create-after-${testInfo.project.name}.png`,
  })
})

test('shows an inline retry state when bookmark playback cannot be prepared', async ({ page }) => {
  const videoId = '4b7227b2-5350-4a61-9114-b2d0c915fd1b'
  await authenticatePage(page)
  await mockVideoMembers(page)
  await mockVideoPosts(page, [createVideoPostRow(videoId, '민규', 'ready')])
  await mockMuxThumbnailTokens(page)
  await mockMuxPlaybackAuthorizationFailure(page)
  await page.goto(`/rooms/${roomId}/books/${bookChatId}`)
  await page.getByRole('tab', { name: '책갈피' }).click()

  await page.getByRole('button', { name: '민규님의 영상 보기' }).click()

  await expect(page).toHaveURL(`/rooms/${roomId}/books/${bookChatId}`)
  await expect(page.getByText('영상을 재생하지 못했어요.')).toBeVisible()
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '영상 보기' })).toHaveCount(0)
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

test('returns to the bookmark archive when the requested video no longer exists', async ({
  page,
}) => {
  const missingVideoId = '4b7227b2-5350-4a61-9114-b2d0c915fd1b'
  await authenticatePage(page)
  await mockVideoMembers(page)
  await mockVideoPosts(page, [])
  await page.goto(`/rooms/${roomId}/books/${bookChatId}/videos/${missingVideoId}`)

  await expect(page.getByRole('alert')).toHaveText('이 영상을 찾을 수 없어요.')
  await page.getByRole('button', { name: '책갈피로 가기' }).click()

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

/** Frimousse 이모지 피커가 외부 CDN 없이 테스트 fixture를 읽도록 응답한다. */
async function mockEmojiPickerData(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem('frimousse/data/ko')
    window.sessionStorage.removeItem('frimousse/metadata')
  })
  await page.route(
    /https:\/\/cdn\.jsdelivr\.net\/npm\/emojibase-data[^/]*\/ko\/data\.json/,
    async (route) => {
      if (route.request().method() === 'HEAD') {
        await route.fulfill({ headers: { etag: 'emoji-fixture' }, status: 200 })
        return
      }
      await route.fulfill({
        body: JSON.stringify(emojiBaseDataFixture),
        contentType: 'application/json',
        headers: { etag: 'emoji-fixture' },
        status: 200,
      })
    },
  )
  await page.route(
    /https:\/\/cdn\.jsdelivr\.net\/npm\/emojibase-data[^/]*\/ko\/messages\.json/,
    async (route) => {
      if (route.request().method() === 'HEAD') {
        await route.fulfill({ headers: { etag: 'emoji-fixture' }, status: 200 })
        return
      }
      await route.fulfill({
        body: JSON.stringify(emojiBaseMessagesFixture),
        contentType: 'application/json',
        headers: { etag: 'emoji-fixture' },
        status: 200,
      })
    },
  )
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

/** 실제 Mux 권한 발급 대신 인라인 재생 검증용 성공 응답을 반환한다. */
async function mockMuxPlaybackAuthorizationSuccess(page: Page) {
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
  await page.route('**/rest/v1/post_reactions?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify([]),
      contentType: 'application/json',
      status: 200,
    })
  })
}

/** 베스트셀러 캐러셀 전환을 검증할 수 있도록 최소 두 권의 추천 도서를 반환한다. */
async function mockBestsellers(page: Page) {
  await page.route('**/functions/v1/book-bestsellers', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        data: {
          isConfigured: true,
          items: [
            {
              authors: ['기시미 이치로'],
              externalUrl: null,
              id: 'best-1',
              isbn13: '9788996991342',
              publisher: '인플루엔셜',
              thumbnailUrl: null,
              title: '미움받을 용기',
            },
            {
              authors: ['헤르만 헤세'],
              externalUrl: null,
              id: 'best-2',
              isbn13: '9788937460441',
              publisher: '민음사',
              thumbnailUrl: null,
              title: '싯다르타',
            },
          ],
        },
        ok: true,
        requestId: 'bestsellers-e2e',
      }),
      contentType: 'application/json',
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

/** 책 대화 화면 상단 헤더에 필요한 책방명과 책 제목 응답을 제공한다. */
async function mockBookDiscussionHeader(page: Page, bookTitle: string) {
  await page.route('**/rest/v1/reading_rooms?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        description: '함께 읽는 책들',
        id: roomId,
        name: '금요일 아침 책방',
      }),
      contentType: 'application/json',
      status: 200,
    })
  })
  await page.route('**/rest/v1/book_chats?*', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        books: { thumbnail_url: null, title: bookTitle },
        id: bookChatId,
        name: bookTitle,
        room_id: roomId,
        status: 'reading',
      }),
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

/** 열린 SEED 시트가 현재 viewport 안에서 스크롤 가능한 전체 높이를 확보했는지 검사한다. */
async function expectDialogToFitViewport(page: Page, name: string, viewportHeight: number) {
  await page.waitForTimeout(350)
  const dialogBox = await page.getByRole('dialog', { name }).boundingBox()
  if (!dialogBox) throw new Error(`${name} 시트의 위치를 읽지 못했어요.`)

  expect(Math.ceil(dialogBox.y + dialogBox.height)).toBeLessThanOrEqual(viewportHeight)
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
