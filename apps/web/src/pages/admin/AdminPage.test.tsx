import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AdminPage } from './AdminPage'

const { getAdminFeedbackTickets, updateAdminFeedbackStatus } = vi.hoisted(() => ({
  getAdminFeedbackTickets: vi.fn(),
  updateAdminFeedbackStatus: vi.fn(),
}))

vi.mock('../../entities/feedback', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../entities/feedback')>()),
  getAdminFeedbackTickets,
  updateAdminFeedbackStatus,
}))
vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('AdminPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lets an operator change a ticket status from the detail sheet', async () => {
    const ticket = {
      authorEmailSnapshot: 'reader@example.com',
      authorProfileId: '123e4567-e89b-42d3-a456-426614174000',
      body: '영상 필터를 더 보고 싶어요.',
      category: 'feature' as const,
      createdAt: '2026-07-18T12:00:00.000Z',
      handledAt: null,
      handledByProfileId: null,
      id: '123e4567-e89b-42d3-a456-426614174001',
      status: 'unread' as const,
    }
    getAdminFeedbackTickets.mockResolvedValue([ticket])
    updateAdminFeedbackStatus.mockResolvedValue({ ...ticket, status: 'completed' })

    renderAdminPage()

    fireEvent.click(await screen.findByRole('button', { name: /영상 필터를 더 보고 싶어요/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '완료' }))

    await waitFor(() => {
      expect(updateAdminFeedbackStatus).toHaveBeenCalledWith(undefined, ticket.id, 'completed')
    })
  })
})

/** 운영함 서버 상태를 격리한 상태로 관리자 화면을 렌더링한다. */
function renderAdminPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminPage />
    </QueryClientProvider>,
  )
}
