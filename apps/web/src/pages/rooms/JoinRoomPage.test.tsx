import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { JoinRoomPage } from './JoinRoomPage'

const { joinRoomByCode } = vi.hoisted(() => ({ joinRoomByCode: vi.fn() }))

vi.mock('../../entities/reading-room', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../entities/reading-room')>()),
  joinRoomByCode,
}))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-0000-0000-000000000001' }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('JoinRoomPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('joins a reading room with an invite code and returns to rooms', async () => {
    joinRoomByCode.mockResolvedValue({ roomId: 'room-1' })

    renderJoinRoomPage()

    fireEvent.change(screen.getByLabelText('6자리 초대 코드'), { target: { value: 'talk87' } })
    fireEvent.click(screen.getByRole('button', { name: '함께 읽기 시작하기' }))

    await waitFor(() => {
      expect(joinRoomByCode).toHaveBeenCalledWith(
        undefined,
        '00000000-0000-0000-0000-000000000001',
        { code: 'TALK87' },
      )
    })
    expect(await screen.findByText('내 독서방 화면')).toBeInTheDocument()
  })

  it('keeps the invite input available when the code is rejected', async () => {
    joinRoomByCode.mockRejectedValue(new Error('invalid invite'))

    renderJoinRoomPage()

    fireEvent.change(screen.getByLabelText('6자리 초대 코드'), { target: { value: 'TALK87' } })
    fireEvent.click(screen.getByRole('button', { name: '함께 읽기 시작하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '앗, 이 코드로는 못 들어가요. 만료됐거나 잘못 입력된 코드 같아요.',
    )
    expect(screen.getByLabelText('6자리 초대 코드')).toBeEnabled()
  })
})

/** 독서방 참여 화면의 라우터와 서버 상태 Provider를 구성해 렌더링한다. */
function renderJoinRoomPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/rooms/join']}>
        <Routes>
          <Route path="/rooms/join" element={<JoinRoomPage />} />
          <Route path="/rooms" element={<p>내 독서방 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
