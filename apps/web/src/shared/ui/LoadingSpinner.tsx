type LoadingSpinnerProps = {
  label: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showLabel?: boolean
  tone?: 'default' | 'inverse'
}

const sizeClasses = {
  xs: 'talkhugam-book-loader--xs',
  sm: 'talkhugam-book-loader--sm',
  md: 'talkhugam-book-loader--md',
  lg: 'talkhugam-book-loader--lg',
} as const

const labelClasses = {
  default: 'text-ink-subtle',
  inverse: 'text-white',
} as const

/** 로딩 스피너 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function LoadingSpinner({
  label,
  showLabel = true,
  size = 'md',
  tone = 'default',
}: LoadingSpinnerProps) {
  return (
    <div aria-label={label} className="flex flex-col items-center gap-3 text-center" role="status">
      <div aria-hidden="true" className={`talkhugam-book-loader ${sizeClasses[size]}`}>
        <div className="talkhugam-book-loader__stage">
          <div className="talkhugam-book-loader__bubbles">
            <div className="talkhugam-book-loader__bubble talkhugam-book-loader__bubble--left" />
            <div className="talkhugam-book-loader__bubble talkhugam-book-loader__bubble--right" />
          </div>
          <div className="talkhugam-book-loader__book">
            <div className="talkhugam-book-loader__cover talkhugam-book-loader__cover--left" />
            <div className="talkhugam-book-loader__cover talkhugam-book-loader__cover--right" />
            <div className="talkhugam-book-loader__spine" />
            <div className="talkhugam-book-loader__page" />
          </div>
        </div>
      </div>
      {showLabel ? <span className={`text-sm ${labelClasses[tone]}`}>{label}</span> : null}
    </div>
  )
}
