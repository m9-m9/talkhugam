type ReadingStatusProps = {
  currentPage?: number | undefined
  isCompleted?: boolean
  totalPages?: number | undefined
}

/** 개인 독서 진행률 또는 완독 상태를 같은 형태로 렌더링한다. */
export function ReadingStatus({
  currentPage,
  isCompleted = false,
  totalPages,
}: ReadingStatusProps) {
  if (isCompleted) {
    return (
      <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
        <span aria-hidden="true">✓</span>
        완독
      </span>
    )
  }

  if (currentPage === undefined || totalPages === undefined || totalPages <= 0) return null

  const percent = Math.round((currentPage / totalPages) * 100)

  return (
    <span className="mt-3 block">
      <span className="text-ink-subtle flex items-center justify-between gap-2 text-xs">
        <span>
          {currentPage} / {totalPages}쪽
        </span>
        <span className="text-primary font-semibold">{percent}%</span>
      </span>
      <span
        aria-label={`독서 진행률 ${percent}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="bg-ink/10 mt-2 block h-1.5 overflow-hidden rounded-full"
        role="progressbar"
      >
        <span className="bg-primary block h-full rounded-full" style={{ width: `${percent}%` }} />
      </span>
    </span>
  )
}
