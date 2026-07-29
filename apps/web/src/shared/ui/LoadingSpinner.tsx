type LoadingIndicatorProps = {
  label: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showLabel?: boolean
  tone?: 'default' | 'inverse'
}

const bookSizeClasses = {
  xs: 'talkhugam-book-loader--xs',
  sm: 'talkhugam-book-loader--sm',
  md: 'talkhugam-book-loader--md',
  lg: 'talkhugam-book-loader--lg',
} as const

const brandSizeClasses = {
  xs: 'talkhugam-brand-spinner--xs',
  sm: 'talkhugam-brand-spinner--sm',
  md: 'talkhugam-brand-spinner--md',
  lg: 'talkhugam-brand-spinner--lg',
} as const

const labelClasses = {
  default: 'text-ink-subtle',
  inverse: 'text-white',
} as const

/** 일반적인 짧은 대기 상태에 사용할 브랜드 스피너를 렌더링한다. */
export function BrandLoadingSpinner(props: LoadingIndicatorProps) {
  return <LoadingIndicator {...props} indicator="brand" />
}

/** 책방, 책, 영상처럼 독서 맥락을 보여 줄 긴 대기 상태에 사용할 책 로더를 렌더링한다. */
export function BookLoadingIndicator(props: LoadingIndicatorProps) {
  return <LoadingIndicator {...props} indicator="book" />
}

/** 선택된 로더의 공통 접근성 레이블과 보조 문구를 렌더링한다. */
function LoadingIndicator({
  label,
  showLabel = true,
  size = 'md',
  tone = 'default',
  indicator,
}: LoadingIndicatorProps & { indicator: 'brand' | 'book' }) {
  return (
    <div aria-label={label} className="flex flex-col items-center gap-3 text-center" role="status">
      {indicator === 'book' ? (
        <div aria-hidden="true" className={`talkhugam-book-loader ${bookSizeClasses[size]}`}>
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
      ) : (
        <div aria-hidden="true" className={`talkhugam-brand-spinner ${brandSizeClasses[size]}`} />
      )}
      {showLabel ? <span className={`text-sm ${labelClasses[tone]}`}>{label}</span> : null}
    </div>
  )
}
