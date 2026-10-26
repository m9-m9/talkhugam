import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CommunityReportInbox } from './CommunityReportInbox'

const { listAdminContentReports, updateAdminContentReport } = vi.hoisted(() => ({
  listAdminContentReports: vi.fn(),
  updateAdminContentReport: vi.fn(),
}))

vi.mock('../../entities/community', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../entities/community')>()),
  listAdminContentReports,
  updateAdminContentReport,
}))
vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))

describe('CommunityReportInbox', () => {
  it('운영자가 신고 상세에서 메모와 함께 종결 처리한다', async () => {
    const report = {
      actions: [],
      createdAt: '2026-08-18T12:00:00.000Z',
      id: '55555555-5555-4555-8555-555555555555',
      reason: '확인이 필요해요',
      reporterProfileId: '33333333-3333-4333-8333-333333333333',
      resolutionNote: null,
      resolvedAt: null,
      resolvedBy: null,
      status: 'open' as const,
      targetId: '22222222-2222-4222-8222-222222222222',
      targetType: 'room' as const,
    }
    listAdminContentReports.mockResolvedValue([report])
    updateAdminContentReport.mockResolvedValue({
      ...report,
      resolutionNote: '검토 완료',
      status: 'resolved',
    })
    renderInbox()

    fireEvent.click(await screen.findByRole('button', { name: /확인이 필요해요/ }))
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('조치 메모'), {
      target: { value: '검토 완료' },
    })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '처리 완료' }))

    await waitFor(() =>
      expect(updateAdminContentReport).toHaveBeenCalledWith(
        undefined,
        report.id,
        'resolved',
        '검토 완료',
      ),
    )
  })
})

/** 신고 운영함 서버 상태를 격리한 QueryClient와 함께 렌더링한다. */
function renderInbox(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CommunityReportInbox />
    </QueryClientProvider>,
  )
}
