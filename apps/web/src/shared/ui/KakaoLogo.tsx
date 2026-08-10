type KakaoLogoProps = {
  className?: string
  size?: number
}

/** 카카오 로그인과 공유 흐름에서 같은 공식 말풍선 아이콘을 렌더링한다. */
export function KakaoLogo({ className, size = 20 }: KakaoLogoProps) {
  return (
    <svg aria-hidden="true" className={className} height={size} viewBox="0 0 20 20" width={size}>
      <path
        d="M10 2.5c-4.142 0-7.5 2.67-7.5 5.964 0 2.134 1.414 4.016 3.54 5.074l-.747 2.757 3.213-2.116c.486.064.985.097 1.494.097 4.142 0 7.5-2.67 7.5-5.964S14.142 2.5 10 2.5Z"
        fill="currentColor"
      />
    </svg>
  )
}
