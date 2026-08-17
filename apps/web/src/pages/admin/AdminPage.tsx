import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ActionButton, ToggleButton } from '@seed-design/react'

import {
  formatFeedbackCategory,
  formatFeedbackStatus,
  getAdminFeedbackTickets,
  updateAdminFeedbackStatus,
  type AdminFeedbackTicket,
  type FeedbackStatus,
} from '../../entities/feedback'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { BottomSheet } from '../../shared/ui/BottomSheet'
import { BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'

const statusFilters: readonly { label: string; value: FeedbackStatus | undefined }[] = [
  { label: '전체', value: undefined },
  { label: '미확인', value: 'unread' },
  { label: '처리 중', value: 'in_progress' },
  { label: '완료', value: 'completed' },
]

/** 운영자가 피드백을 읽고 처리 상태만 변경하는 작은 운영함 화면을 렌더링한다. */
export function AdminPage() {
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | undefined>(undefined)
  const [selectedTicket, setSelectedTicket] = useState<AdminFeedbackTicket | null>(null)
  const queryClient = useQueryClient()
  const feedbackQuery = useQuery({
    queryFn: () => getAdminFeedbackTickets(createSupabaseClient(), statusFilter),
    queryKey: ['admin-feedback', statusFilter],
  })
  const statusMutation = useMutation({
    mutationFn: ({ status, ticketId }: { status: FeedbackStatus; ticketId: string }) =>
      updateAdminFeedbackStatus(createSupabaseClient(), ticketId, status),
    onSuccess: async (ticket) => {
      setSelectedTicket(ticket)
      await queryClient.invalidateQueries({ queryKey: ['admin-feedback'] })
    },
  })

  /** 선택한 상태 필터를 적용하고 현재 상세 시트는 닫는다. */
  function handleStatusFilterChange(nextStatus: FeedbackStatus | undefined) {
    setStatusFilter(nextStatus)
    setSelectedTicket(null)
  }

  /** 티켓을 선택해 이메일 회신 정보와 상태 변경 선택지를 담은 상세 시트를 연다. */
  function handleOpenTicket(ticket: AdminFeedbackTicket) {
    setSelectedTicket(ticket)
  }

  /** 상세 시트를 닫되 목록의 현재 필터와 서버 상태는 유지한다. */
  function handleCloseTicket() {
    setSelectedTicket(null)
  }

  /** 선택한 티켓을 운영자가 지정한 처리 상태로 변경한다. */
  function handleUpdateStatus(status: FeedbackStatus) {
    if (!selectedTicket) return
    statusMutation.mutate({ status, ticketId: selectedTicket.id })
  }

  return (
    <main className="app-page bg-surface px-4 pb-12">
      <header className="border-border -mx-4 border-b px-4 py-4">
        <p className="text-primary text-sm font-semibold">Operator inbox</p>
        <h1 className="text-ink mt-1 text-xl font-bold">이용자 의견</h1>
      </header>
      <section className="pt-6" aria-label="피드백 상태 필터">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statusFilters.map((filter) => (
            <ToggleButton
              className="talkhugam-foundation-toggle shrink-0"
              key={filter.label}
              onClick={() => handleStatusFilterChange(filter.value)}
              pressed={statusFilter === filter.value}
              variant="neutralWeak"
            >
              {filter.label}
            </ToggleButton>
          ))}
        </div>
      </section>
      <section className="pt-6" aria-live="polite">
        {feedbackQuery.isPending ? <BrandLoadingSpinner label="의견을 불러오고 있어요." /> : null}
        {feedbackQuery.isError ? (
          <p className="text-danger text-sm">
            운영함을 불러오지 못했어요. 새로고침 후 다시 확인해 주세요.
          </p>
        ) : null}
        {feedbackQuery.data?.length === 0 ? (
          <p className="text-ink-subtle border-ink/15 rounded-lg border border-dashed p-6 text-center text-sm">
            해당 상태의 의견이 없어요.
          </p>
        ) : null}
        <ul className="space-y-3">
          {feedbackQuery.data?.map((ticket) => (
            <li key={ticket.id}>
              <ActionButton
                className="border-border h-auto w-full justify-start rounded-lg border bg-white p-4 text-left !whitespace-normal"
                onClick={() => handleOpenTicket(ticket)}
                size="large"
                type="button"
                variant="neutralWeak"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-primary text-xs font-semibold">
                    {formatFeedbackCategory(ticket.category)}
                  </span>
                  <span className="text-ink-subtle text-xs">
                    {formatFeedbackStatus(ticket.status)}
                  </span>
                </div>
                <p className="text-ink mt-3 line-clamp-2 text-sm leading-6">{ticket.body}</p>
                <p className="text-ink-subtle mt-3 text-xs">{formatDateTime(ticket.createdAt)}</p>
              </ActionButton>
            </li>
          ))}
        </ul>
      </section>
      {selectedTicket ? (
        <BottomSheet onClose={handleCloseTicket} title="의견 상세">
          <section className="pt-5">
            <p className="text-primary text-sm font-semibold">
              {formatFeedbackCategory(selectedTicket.category)}
            </p>
            <p className="text-ink mt-3 text-sm leading-6 whitespace-pre-wrap">
              {selectedTicket.body}
            </p>
            <div className="border-border mt-6 border-t pt-4 text-sm">
              <p className="text-ink-subtle">답변 이메일</p>
              <a
                className="text-primary mt-1 inline-flex min-h-11 items-center font-semibold"
                href={`mailto:${selectedTicket.authorEmailSnapshot}`}
              >
                {selectedTicket.authorEmailSnapshot}
              </a>
            </div>
            <p className="text-ink mt-6 text-sm font-semibold">처리 상태</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {statusFilters.slice(1).map((filter) => (
                <ToggleButton
                  className="talkhugam-foundation-toggle w-full"
                  disabled={statusMutation.isPending}
                  key={filter.label}
                  onClick={() => filter.value && handleUpdateStatus(filter.value)}
                  pressed={selectedTicket.status === filter.value}
                  variant="neutralWeak"
                >
                  {filter.label}
                </ToggleButton>
              ))}
            </div>
            {statusMutation.isError ? (
              <p className="text-danger mt-3 text-sm" role="alert">
                상태를 바꾸지 못했어요. 다시 시도해 주세요.
              </p>
            ) : null}
          </section>
        </BottomSheet>
      ) : null}
    </main>
  )
}

/** ISO 날짜를 운영함 목록에서 빠르게 읽을 수 있는 한국 시간 문자열로 변환한다. */
function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  )
}
