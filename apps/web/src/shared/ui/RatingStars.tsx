import { StarIcon } from './StarIcon'

type RatingStarsProps = {
  label?: string
  rating: number
}

const STAR_VALUES = [1, 2, 3, 4, 5]

/** 읽기 전용 별 5개로 별점을 채움·빈 별 구분과 함께 표시한다. */
export function RatingStars({ label, rating }: RatingStarsProps) {
  return (
    <span
      aria-label={`별점 ${rating}점`}
      className="text-ink inline-flex items-center gap-0.5"
      role="img"
    >
      {STAR_VALUES.map((value) => (
        <StarIcon className="size-4" filled={value <= rating} key={value} />
      ))}
      {label ? <span className="text-ink-subtle ml-1 text-xs">{label}</span> : null}
    </span>
  )
}
