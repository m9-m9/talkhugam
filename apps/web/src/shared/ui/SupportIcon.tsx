type SupportIconProps = {
  className?: string
}

/** 이용자 의견과 문의 진입점에 쓰는 말풍선 형태의 지원 아이콘을 렌더링한다. */
export function SupportIcon({ className }: SupportIconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M5 5.75A3.75 3.75 0 0 1 8.75 2h6.5A3.75 3.75 0 0 1 19 5.75v6.5A3.75 3.75 0 0 1 15.25 16H11l-4.25 3v-3.46A3.74 3.74 0 0 1 5 12.25v-6.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9 9h.01M12 9h.01M15 9h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  )
}
