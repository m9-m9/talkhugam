type RetryStateProps = {
  message: string
  onRetry: () => void
  retryLabel?: string
}

/** 조회 오류를 안내하고 사용자가 같은 요청을 다시 시도하게 한다. */
export function RetryState({ message, onRetry, retryLabel = '다시 시도' }: RetryStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
      <button
        className="border-primary text-primary min-h-11 cursor-pointer rounded-md border px-4 text-sm font-semibold"
        onClick={onRetry}
        type="button"
      >
        {retryLabel}
      </button>
    </div>
  )
}
