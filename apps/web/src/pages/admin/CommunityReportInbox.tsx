import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ActionButton, ToggleButton } from '@seed-design/react'
import { useState } from 'react'

import {
  listAdminContentReports,
  updateAdminContentReport,
  type AdminContentReport,
  type ContentReportStatus,
} from '../../entities/community'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { BottomSheet } from '../../shared/ui/BottomSheet'
import { BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'

const reportStatusFilters: readonly { label: string; value: ContentReportStatus | undefined }[] = [
  { label: '전체', value: undefined },
  { label: '접수', value: 'open' },
  { label: '검토 중', value: 'reviewing' },
  { label: '처리 완료', value: 'resolved' },
  { label: '기각', value: 'dismissed' },
]

/** 운영자가 방·프로필·메시지 신고를 조회하고 조치 이력과 함께 상태를 관리한다. */
export function CommunityReportInbox() {
  const [statusFilter, setStatusFilter] = useState<ContentReportStatus | undefined>(undefined)
  const [selectedReport, setSelectedReport] = useState<AdminContentReport | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const queryClient = useQueryClient()
  const reportQuery = useQuery({
    queryFn: () => listAdminContentReports(createSupabaseClient(), statusFilter),
    queryKey: ['admin-content-reports', statusFilter],
  })
  const statusMutation = useMutation({
    mutationFn: ({ reportId, status }: { reportId: string; status: ContentReportStatus }) =>
      updateAdminContentReport(createSupabaseClient(), reportId, status, resolutionNote),
    onSuccess: async (report) => {
      if (!selectedReport) return
      setSelectedReport({ ...selectedReport, ...report })
      await queryClient.invalidateQueries({ queryKey: ['admin-content-reports'] })
    },
  })

  /** 신고 상태 필터를 적용하고 상세 시트와 메모 입력을 초기화한다. */
  function handleStatusFilterChange(nextStatus: ContentReportStatus | undefined): void {
    setStatusFilter(nextStatus)
    setSelectedReport(null)
    setResolutionNote('')
  }

  /** 선택한 신고의 기존 종결 메모와 조치 이력을 상세 시트에 표시한다. */
  function handleOpenReport(report: AdminContentReport): void {
    setSelectedReport(report)
    setResolutionNote(report.resolutionNote ?? '')
  }

  /** 신고 상세 시트와 메모 입력을 닫아 목록 상태만 유지한다. */
  function handleCloseReport(): void {
    setSelectedReport(null)
    setResolutionNote('')
  }

  /** 선택한 신고 상태를 저장하며 종결·기각은 조치 메모가 있을 때만 허용한다. */
  function handleUpdateStatus(status: ContentReportStatus): void {
    if (!selectedReport || statusMutation.isPending) return
    if ((status === 'resolved' || status === 'dismissed') && !resolutionNote.trim()) return
    statusMutation.mutate({ reportId: selectedReport.id, status })
  }

  return (
    <section
      className="border-border mt-12 border-t pt-8"
      aria-labelledby="content-report-inbox-title"
    >
      <p className="text-primary text-sm font-semibold">Safety inbox</p>
      <h2 className="text-ink mt-1 text-xl font-bold" id="content-report-inbox-title">
        신고 관리
      </h2>
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="신고 상태 필터">
        {reportStatusFilters.map((filter) => (
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
      <div className="mt-6" aria-live="polite">
        {reportQuery.isPending ? <BrandLoadingSpinner label="신고를 불러오고 있어요." /> : null}
        {reportQuery.isError ? (
          <p className="text-danger text-sm">
            신고 운영함을 불러오지 못했어요. 새로고침 후 다시 확인해 주세요.
          </p>
        ) : null}
        {reportQuery.data?.length === 0 ? (
          <p className="text-ink-subtle border-ink/15 rounded-lg border border-dashed p-6 text-center text-sm">
            해당 상태의 신고가 없어요.
          </p>
        ) : null}
        <ul className="space-y-3">
          {reportQuery.data?.map((report) => (
            <li key={report.id}>
              <ActionButton
                className="border-border h-auto w-full justify-start rounded-lg border bg-white p-4 text-left !whitespace-normal"
                onClick={() => handleOpenReport(report)}
                size="large"
                type="button"
                variant="neutralWeak"
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-primary text-xs font-semibold">
                    {formatTargetType(report.targetType)}
                  </span>
                  <span className="text-ink-subtle text-xs">
                    {formatReportStatus(report.status)}
                  </span>
                </div>
                <p className="text-ink mt-3 line-clamp-2 text-sm leading-6">{report.reason}</p>
                <p className="text-ink-subtle mt-3 text-xs">{formatDateTime(report.createdAt)}</p>
              </ActionButton>
            </li>
          ))}
        </ul>
      </div>
      {selectedReport ? (
        <CommunityReportDetail
          onClose={handleCloseReport}
          onNoteChange={setResolutionNote}
          onUpdateStatus={handleUpdateStatus}
          report={selectedReport}
          resolutionNote={resolutionNote}
          isSubmitting={statusMutation.isPending}
          showError={statusMutation.isError}
        />
      ) : null}
    </section>
  )
}

/** 선택된 신고의 대상·사유·기존 이력과 운영자 조치 버튼을 시트로 렌더링한다. */
function CommunityReportDetail({
  isSubmitting,
  onClose,
  onNoteChange,
  onUpdateStatus,
  report,
  resolutionNote,
  showError,
}: {
  isSubmitting: boolean
  onClose(): void
  onNoteChange(value: string): void
  onUpdateStatus(status: ContentReportStatus): void
  report: AdminContentReport
  resolutionNote: string
  showError: boolean
}) {
  return (
    <BottomSheet onClose={onClose} title="신고 상세">
      <section className="pt-5">
        <p className="text-primary text-sm font-semibold">
          {formatTargetType(report.targetType)} · {formatReportStatus(report.status)}
        </p>
        <p className="text-ink mt-3 text-sm leading-6 whitespace-pre-wrap">{report.reason}</p>
        <p className="text-ink-subtle mt-4 text-xs">신고자 ID: {report.reporterProfileId}</p>
        <label
          className="text-ink mt-6 block text-sm font-semibold"
          htmlFor="content-report-resolution-note"
        >
          조치 메모
        </label>
        <textarea
          className="border-border text-ink mt-2 min-h-24 w-full rounded-lg border p-3 text-sm"
          disabled={isSubmitting}
          id="content-report-resolution-note"
          maxLength={500}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="처리 또는 기각 사유를 남겨 주세요."
          value={resolutionNote}
        />
        <p className="text-ink-subtle mt-2 text-xs">처리 완료·기각에는 조치 메모가 필요해요.</p>
        <p className="text-ink mt-6 text-sm font-semibold">상태 변경</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ActionButton
            className="talkhugam-foundation-action--outline"
            disabled={isSubmitting}
            onClick={() => onUpdateStatus('reviewing')}
            size="large"
            type="button"
            variant="neutralOutline"
          >
            검토 중
          </ActionButton>
          <ActionButton
            className="talkhugam-primary-action"
            disabled={isSubmitting || !resolutionNote.trim()}
            onClick={() => onUpdateStatus('resolved')}
            size="large"
            type="button"
            variant="brandSolid"
          >
            처리 완료
          </ActionButton>
          <ActionButton
            className="talkhugam-foundation-action--outline col-span-2"
            disabled={isSubmitting || !resolutionNote.trim()}
            onClick={() => onUpdateStatus('dismissed')}
            size="large"
            type="button"
            variant="neutralOutline"
          >
            기각
          </ActionButton>
        </div>
        {showError ? (
          <p className="text-danger mt-3 text-sm" role="alert">
            신고 상태를 바꾸지 못했어요. 다시 시도해 주세요.
          </p>
        ) : null}
        <section
          className="border-border mt-8 border-t pt-5"
          aria-labelledby="content-report-history"
        >
          <h3 className="text-ink text-sm font-semibold" id="content-report-history">
            조치 이력
          </h3>
          {report.actions.length === 0 ? (
            <p className="text-ink-subtle mt-3 text-sm">아직 조치 이력이 없어요.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {report.actions.map((action) => (
                <li className="text-ink-subtle text-sm" key={action.id}>
                  {formatReportStatus(action.previousStatus)} →{' '}
                  {formatReportStatus(action.nextStatus)} · {formatDateTime(action.createdAt)}
                  {action.resolutionNote ? (
                    <p className="text-ink mt-1 whitespace-pre-wrap">{action.resolutionNote}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>
    </BottomSheet>
  )
}

/** 신고 대상 코드를 운영자가 빠르게 구분할 수 있는 한글 이름으로 변환한다. */
function formatTargetType(targetType: AdminContentReport['targetType']): string {
  if (targetType === 'room') return '오픈 책방'
  if (targetType === 'profile') return '프로필'
  return '자유 채팅'
}

/** 신고 상태 코드를 운영함에서 읽기 쉬운 한글 문구로 반환한다. */
function formatReportStatus(status: ContentReportStatus): string {
  if (status === 'open') return '접수'
  if (status === 'reviewing') return '검토 중'
  if (status === 'resolved') return '처리 완료'
  return '기각'
}

/** ISO 날짜를 신고 운영함에서 읽을 수 있는 한국 시간 문자열로 변환한다. */
function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  )
}
