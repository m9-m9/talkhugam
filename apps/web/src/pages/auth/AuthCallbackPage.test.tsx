import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthCallbackPage } from './AuthCallbackPage'

const {
  getBookBestsellers,
  getHasRequiredLegalConsent,
  getOnboardingCompletedAt,
  getReadingRooms,
  getUser,
} = vi.hoisted(() => ({
  getBookBestsellers: vi.fn(),
  getHasRequiredLegalConsent: vi.fn(),
  getOnboardingCompletedAt: vi.fn(),
  getReadingRooms: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock('../../entities/bestseller', () => ({
  bookBestsellerKeys: { current: ['book-bestsellers', 'current'] },
  getBookBestsellers,
}))
vi.mock('../../entities/legal', () => ({ getHasRequiredLegalConsent }))
vi.mock('../../entities/profile', () => ({ getOnboardingCompletedAt }))
vi.mock('../../entities/reading-room', () => ({
  getReadingRooms,
  readingRoomKeys: { all: ['reading-rooms'] },
}))
vi.mock('../../shared/api/supabaseClient', () => ({
  createSupabaseClient: () => ({ auth: { getUser } }),
}))

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getBookBestsellers.mockResolvedValue({ isConfigured: false, items: [] })
    getReadingRooms.mockResolvedValue([])
  })
  afterEach(cleanup)

  it('shows the provider error without requesting a user again', async () => {
    renderCallback('/auth/callback?auth_error=provider_failed')

    expect(
      await screen.findByText('로그인이 취소되었거나 만료되었어요. 다시 시도해 주세요.'),
    ).toBeInTheDocument()
    expect(getUser).not.toHaveBeenCalled()
  })

  it('uses the room-landing loader while the login session is being checked', () => {
    getUser.mockReturnValue(new Promise(() => undefined))

    renderCallback('/auth/callback')

    const status = screen.getByRole('status', { name: '책방 정보를 불러오고 있어요.' })
    expect(status.querySelector('.talkhugam-book-loader')).toBeInTheDocument()
  })

  it('sends a completed profile to the room list', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    getOnboardingCompletedAt.mockResolvedValue('2026-07-17T00:00:00.000Z')
    getHasRequiredLegalConsent.mockResolvedValue(true)

    renderCallback('/auth/callback')

    expect(await screen.findByText('독서방 목록')).toBeInTheDocument()
  })

  it('prepares the room landing data behind one book loader before navigating', async () => {
    const roomsResponse = createDeferred<[]>()
    const bestsellerResponse = createDeferred<{ isConfigured: false; items: [] }>()
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    getOnboardingCompletedAt.mockResolvedValue('2026-07-17T00:00:00.000Z')
    getHasRequiredLegalConsent.mockResolvedValue(true)
    getReadingRooms.mockReturnValue(roomsResponse.promise)
    getBookBestsellers.mockReturnValue(bestsellerResponse.promise)

    renderCallback('/auth/callback')

    expect(
      await screen.findByRole('status', { name: '책방 정보를 불러오고 있어요.' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('독서방 목록')).not.toBeInTheDocument()

    roomsResponse.resolve([])
    bestsellerResponse.resolve({ isConfigured: false, items: [] })

    expect(await screen.findByText('독서방 목록')).toBeInTheDocument()
    expect(getReadingRooms).toHaveBeenCalledTimes(1)
    expect(getBookBestsellers).toHaveBeenCalledTimes(1)
  })

  it('sends a user without current policy consent to the consent screen', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    getOnboardingCompletedAt.mockResolvedValue('2026-07-17T00:00:00.000Z')
    getHasRequiredLegalConsent.mockResolvedValue(false)

    renderCallback('/auth/callback')

    expect(await screen.findByText('서비스 이용 동의')).toBeInTheDocument()
  })

  it('로그인 직후 프로필 조회가 한 번 실패하면 다시 조회해 메인으로 이동한다', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    getOnboardingCompletedAt
      .mockRejectedValueOnce(new Error('일시적인 조회 실패'))
      .mockResolvedValueOnce('2026-07-17T00:00:00.000Z')
    getHasRequiredLegalConsent.mockResolvedValue(true)

    renderCallback('/auth/callback')

    expect(await screen.findByText('독서방 목록')).toBeInTheDocument()
    expect(getOnboardingCompletedAt).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

/** 인증 callback 테스트에 필요한 Query와 라우터 경계를 렌더링한다. */
function renderCallback(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/legal-consent" element={<p>서비스 이용 동의</p>} />
          <Route path="/rooms" element={<p>독서방 목록</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** 테스트에서 외부 응답 완료 시점을 직접 제어할 수 있는 Promise를 만든다. */
function createDeferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((complete) => {
    resolve = complete
  })

  return { promise, resolve }
}
