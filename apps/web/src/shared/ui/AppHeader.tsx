import type { ReactNode } from 'react'

type AppHeaderProps = {
  action?: ReactNode
  onBack?: () => void
  title: string
}

export function AppHeader({ action, onBack, title }: AppHeaderProps) {
  return (
    <header className="border-ink/10 -mx-6 flex min-h-16 items-center gap-2 border-b px-6">
      {onBack ? (
        <button
          aria-label="이전 화면으로"
          className="text-ink -ml-3 flex min-h-11 min-w-11 items-center justify-center"
          onClick={onBack}
          type="button"
        >
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" className="size-5">
            <path
              d="m14.5 5-7 7 7 7"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
        </button>
      ) : null}
      <p className="text-ink text-base font-bold">{title}</p>
      {action ? <div className="ml-auto flex items-center">{action}</div> : null}
    </header>
  )
}
