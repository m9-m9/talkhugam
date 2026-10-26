type StarIconProps = {
  className?: string
  filled?: boolean
}

/** 별점 선택과 표시에 쓰는 별 모양 아이콘을 채움 여부에 맞춰 렌더링한다. 채운 별은 핵심 콘텐츠 강조로 코랄을 쓴다. */
export function StarIcon({ className = 'size-5', filled = false }: StarIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={filled ? `talkhugam-star--filled ${className}` : className}
      fill={filled ? 'currentColor' : 'none'}
      viewBox="0 0 24 24"
    >
      <path
        d="m12 3.5 2.6 5.3 5.9.86-4.25 4.14 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.66l5.9-.86L12 3.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
