import { useLocation, useNavigate } from 'react-router-dom'

export function AppBottomNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const isRoomsActive = location.pathname.startsWith('/rooms')
  const isProfileActive = location.pathname.startsWith('/profile')

  return (
    <nav aria-label="주요 메뉴" className="app-bottom-navigation bg-surface border-ink/10 border-t">
      <div className="grid h-full grid-cols-3 items-end px-6 pb-4">
        <button
          aria-current={isRoomsActive ? 'page' : undefined}
          className={`min-h-11 text-sm font-medium ${isRoomsActive ? 'text-primary' : 'text-ink-subtle'}`}
          onClick={() => void navigate('/rooms')}
          type="button"
        >
          독서방
        </button>
        <div className="flex min-h-11 items-center justify-center" aria-label="Talk후감">
          <img alt="" className="size-10" src="/brand/talkhugam-symbol.svg" />
        </div>
        <button
          aria-current={isProfileActive ? 'page' : undefined}
          className={`min-h-11 text-sm font-medium ${isProfileActive ? 'text-primary' : 'text-ink-subtle'}`}
          onClick={() => void navigate('/profile')}
          type="button"
        >
          내 정보
        </button>
      </div>
      <button
        aria-label="새 독서방 만들기"
        className="bg-primary text-ink absolute top-0 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-3xl font-light shadow-lg"
        onClick={() => void navigate('/rooms/create')}
        type="button"
      >
        <span aria-hidden="true">+</span>
      </button>
    </nav>
  )
}
