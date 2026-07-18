type CompletionMarkProps = {
  className?: string
  label?: string
}

/** 개인 완독 상태를 브랜드 에셋과 읽기 쉬운 문구로 일관되게 표시한다. */
export function CompletionMark({ className, label = '완독' }: CompletionMarkProps) {
  return (
    <span
      className={`text-primary inline-flex items-center gap-1 text-xs font-semibold ${className ?? ''}`}
    >
      <img alt="" aria-hidden="true" className="size-4" src="/brand/talkhugam-completion.svg" />
      {label}
    </span>
  )
}
