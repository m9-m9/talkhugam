import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export function AppBottomNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isActionBookOpen, setIsActionBookOpen] = useState(false)
  const isRoomsActive = location.pathname.startsWith('/rooms')
  const isProfileActive = location.pathname.startsWith('/profile')

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsActionBookOpen(false)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  function handleCreateRoom() {
    setIsActionBookOpen(false)
    void navigate('/rooms/create')
  }

  function handleJoinRoom() {
    setIsActionBookOpen(false)
    void navigate('/rooms/join')
  }

  return (
    <nav aria-label="주요 메뉴" className="app-bottom-navigation bg-surface border-ink/10 border-t">
      {isActionBookOpen ? (
        <button
          aria-label="메뉴 바깥 영역을 눌러 닫기"
          className="talkhugam-action-backdrop"
          onClick={() => setIsActionBookOpen(false)}
          type="button"
        />
      ) : null}
      {isActionBookOpen ? (
        <section
          aria-labelledby="action-book-title"
          className="talkhugam-action-book absolute z-20"
          role="dialog"
        >
          <h2 className="sr-only" id="action-book-title">
            모임 시작 방식 선택
          </h2>
          <div className="talkhugam-action-book__pages flex">
            <svg
              aria-hidden="true"
              className="talkhugam-action-book__shape"
              fill="none"
              preserveAspectRatio="none"
              viewBox="0 0 200 100"
            >
              <path
                d="M7 7C31 1 75 1 100 7V94C75 88 26 88 1 94V13Q1 7 7 7Z"
                fill="var(--color-surface)"
                stroke="var(--color-primary)"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M100 7C125 1 169 1 193 7Q199 7 199 13V94C174 88 125 88 100 94V7Z"
                fill="var(--color-surface)"
                stroke="var(--color-primary)"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <button
              aria-label="새 모임 만들기"
              className="talkhugam-action-book__page talkhugam-action-book__page--left flex flex-1 flex-col items-start gap-6 text-left"
              onClick={handleCreateRoom}
              type="button"
            >
              <span className="text-primary text-sm font-bold">새로운 이야기</span>
              <span>
                <span className="text-ink block text-base font-bold whitespace-nowrap">새 모임 만들기</span>
                <span className="text-ink-subtle mt-2 block text-xs">
                  친구를 초대해 함께 시작해요.
                </span>
              </span>
            </button>
            <button
              aria-label="초대 코드로 참여"
              className="talkhugam-action-book__page talkhugam-action-book__page--right flex flex-1 flex-col items-start gap-6 text-left"
              onClick={handleJoinRoom}
              type="button"
            >
              <span className="text-primary text-sm font-bold">함께 읽기</span>
              <span>
                <span className="text-ink block text-base font-bold whitespace-nowrap">초대 코드로 참여</span>
                <span className="text-ink-subtle mt-2 block text-xs">
                  친구가 보낸 6자리 코드를 입력해요.
                </span>
              </span>
            </button>
          </div>
        </section>
      ) : null}
      <div className="relative z-10 grid h-full grid-cols-3 items-end px-4 pb-4">
        <button
          aria-current={isRoomsActive ? 'page' : undefined}
          className={`min-h-11 text-sm font-medium ${isRoomsActive ? 'text-primary' : 'text-ink-subtle'}`}
          onClick={() => void navigate('/rooms')}
          type="button"
        >
          독서방
        </button>
        <button
          aria-label="Talk후감 메인으로"
          className="flex min-h-11 items-center justify-center"
          onClick={() => void navigate('/rooms')}
          type="button"
        >
          <img alt="" className="size-12" src="/brand/talkhugam-symbol.svg" />
        </button>
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
        aria-expanded={isActionBookOpen}
        aria-label={isActionBookOpen ? '모임 시작 메뉴 닫기' : '모임 시작 메뉴 열기'}
        className="bg-primary text-ink absolute top-0 left-1/2 z-20 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg"
        onClick={() => setIsActionBookOpen((isOpen) => !isOpen)}
        type="button"
      >
        <svg aria-hidden="true" className="size-8" fill="none" viewBox="0 0 24 24">
          <path
            className={`origin-center transition-transform duration-300 ${
              isActionBookOpen ? 'rotate-45' : ''
            }`}
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.8"
          />
        </svg>
      </button>
    </nav>
  )
}
