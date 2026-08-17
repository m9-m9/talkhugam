import type { ReactNode } from 'react'
import { ActionButton } from '@seed-design/react'

type AppHeaderProps = {
  action?: ReactNode
  onBack?: () => void
  title: string
  titleAsHeading?: boolean
}

/** 앱 헤더 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function AppHeader({ action, onBack, title, titleAsHeading = false }: AppHeaderProps) {
  const titleClassName = 'text-ink text-base font-semibold'

  return (
    <header className="border-border -mx-4 flex min-h-16 items-center gap-2 border-b px-4">
      {onBack ? (
        <ActionButton
          aria-label="이전 화면으로"
          className="text-ink -ml-3 min-h-11 min-w-11 p-0"
          onClick={onBack}
          size="small"
          type="button"
          variant="ghost"
        >
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" className="size-5">
            <path
              d="m14.5 5-7 7 7 7"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
        </ActionButton>
      ) : null}
      {titleAsHeading ? (
        <h1 className={titleClassName}>{title}</h1>
      ) : (
        <p className={titleClassName}>{title}</p>
      )}
      {action ? <div className="ml-auto flex items-center">{action}</div> : null}
    </header>
  )
}
