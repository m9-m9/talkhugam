import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CreateRoomPage } from './CreateRoomPage'

const { createRoomWithInvite } = vi.hoisted(() => ({ createRoomWithInvite: vi.fn() }))

vi.mock('../../entities/reading-room', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../entities/reading-room')>()),
  createRoomWithInvite,
}))

vi.mock('../../features/auth', () => ({
  useAuthenticatedUser: () => ({ id: '00000000-0000-0000-0000-000000000001' }),
}))

vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('CreateRoomPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows the shareable invite after creating a reading room', async () => {
    createRoomWithInvite.mockResolvedValue({ code: 'TALK87', roomId: 'room-1' })

    renderCreateRoomPage()

    fireEvent.change(screen.getByLabelText('책방 이름'), { target: { value: '금요일 아침 책방' } })
    fireEvent.click(screen.getByRole('button', { name: '책방 만들기' }))

    await waitFor(() => {
      expect(createRoomWithInvite).toHaveBeenCalledWith(
        undefined,
        '00000000-0000-0000-0000-000000000001',
        { description: '', name: '금요일 아침 책방' },
      )
    })
    expect(await screen.findByText('TALK87')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '초대 코드 복사하기' })).toBeInTheDocument()
  })

  it('explains when the room cannot be created', async () => {
    createRoomWithInvite.mockRejectedValue(new Error('room unavailable'))

    renderCreateRoomPage()

    fireEvent.change(screen.getByLabelText('책방 이름'), { target: { value: '금요일 아침 책방' } })
    fireEvent.click(screen.getByRole('button', { name: '책방 만들기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '책방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
  })
})

/** 독서방 생성 화면의 라우터와 서버 상태 Provider를 구성해 렌더링한다. */
function renderCreateRoomPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/rooms/create']}>
        <Routes>
          <Route path="/rooms/create" element={<CreateRoomPage />} />
          <Route path="/rooms" element={<p>내 독서방 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
