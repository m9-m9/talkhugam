import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { BrandSymbol } from './BrandSymbol'

/** 앱 하단 이동 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function AppBottomNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const actionBookRef = useRef<HTMLElement>(null)
  const actionMenuButtonRef = useRef<HTMLButtonElement>(null)
  const firstActionButtonRef = useRef<HTMLButtonElement>(null)
  const [isActionBookOpen, setIsActionBookOpen] = useState(false)
  const isRoomsActive = location.pathname.startsWith('/rooms')
  const isProfileActive = location.pathname.startsWith('/profile')

  useEffect(() => {
    if (!isActionBookOpen) return
    firstActionButtonRef.current?.focus()
  }, [isActionBookOpen])

  useEffect(() => {
    /** Escape 키 요청이나 사용자 동작을 처리한다. */
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !isActionBookOpen) return
      event.preventDefault()
      setIsActionBookOpen(false)
      actionMenuButtonRef.current?.focus()
    }

    /** 외부 포인터 Down 요청이나 사용자 동작을 처리한다. */
    function handleOutsidePointerDown(event: PointerEvent) {
      if (!isActionBookOpen || !(event.target instanceof Node)) return
      if (actionBookRef.current?.contains(event.target)) return
      if (actionMenuButtonRef.current?.contains(event.target)) return
      setIsActionBookOpen(false)
      actionMenuButtonRef.current?.focus()
    }

    /** 메뉴 밖 조작 요소로 키보드 포커스가 이동하면 책자만 닫고 이동한 포커스는 유지한다. */
    function handleOutsideFocus(event: FocusEvent) {
      if (!isActionBookOpen || !(event.target instanceof Node)) return
      if (actionBookRef.current?.contains(event.target)) return
      if (actionMenuButtonRef.current?.contains(event.target)) return
      setIsActionBookOpen(false)
    }

    window.addEventListener('keydown', handleEscape)
    document.addEventListener('pointerdown', handleOutsidePointerDown)
    document.addEventListener('focusin', handleOutsideFocus)
    return () => {
      window.removeEventListener('keydown', handleEscape)
      document.removeEventListener('pointerdown', handleOutsidePointerDown)
      document.removeEventListener('focusin', handleOutsideFocus)
    }
  }, [isActionBookOpen])

  /** 책자 바깥 영역을 눌러 책방 시작 선택지를 닫고 + 버튼에 포커스를 돌린다. */
  function handleCloseActionBook() {
    setIsActionBookOpen(false)
    actionMenuButtonRef.current?.focus()
  }

  /** 책자 배경의 포인터 입력이 배경 버튼으로 포커스를 옮기기 전에 메뉴를 닫는다. */
  function handleActionBackdropPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    handleCloseActionBook()
  }

  /** 중앙 + 버튼으로 책방 시작 선택지의 펼침 상태를 전환한다. */
  function handleToggleActionBook() {
    setIsActionBookOpen((isOpen) => !isOpen)
  }

  /** 새 책방 생성 화면으로 이동한다. */
  function handleCreateRoom() {
    setIsActionBookOpen(false)
    void navigate('/rooms/create')
  }

  /** 초대 코드로 책방에 참여하는 화면으로 이동한다. */
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
          onPointerDown={handleActionBackdropPointerDown}
          type="button"
        />
      ) : null}
      {isActionBookOpen ? (
        <section
          aria-labelledby="action-book-title"
          className="talkhugam-action-book absolute z-20"
          ref={actionBookRef}
          role="dialog"
        >
          <h2 className="sr-only" id="action-book-title">
            책방 시작 방식 선택
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
              aria-label="새 책방 만들기"
              className="talkhugam-action-book__page talkhugam-action-book__page--left flex flex-1 flex-col items-start gap-2 text-left"
              onClick={handleCreateRoom}
              ref={firstActionButtonRef}
              type="button"
            >
              <span className="text-primary text-sm font-bold">새로운 이야기</span>
              <span>
                <span className="text-ink block text-base font-bold whitespace-nowrap">
                  새 책방 만들기
                </span>
                <span className="text-ink-subtle mt-1 block text-xs">
                  친구를 초대해 함께 시작해요.
                </span>
              </span>
            </button>
            <button
              aria-label="초대 코드로 책방 참여"
              className="talkhugam-action-book__page talkhugam-action-book__page--right flex flex-1 flex-col items-start gap-2 text-left"
              onClick={handleJoinRoom}
              type="button"
            >
              <span className="text-primary text-sm font-bold">함께 읽기</span>
              <span>
                <span className="text-ink block text-base font-bold whitespace-nowrap">
                  초대 코드로 참여
                </span>
                <span className="text-ink-subtle mt-1 block text-xs">
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
          책방
        </button>
        <button
          aria-label="Talk후감 메인으로"
          className="flex min-h-11 items-center justify-center"
          onClick={() => void navigate('/rooms')}
          type="button"
        >
          <BrandSymbol alt="" className="size-12" tone="coral" />
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
        aria-label={isActionBookOpen ? '책방 시작 메뉴 닫기' : '책방 시작 메뉴 열기'}
        className="bg-primary text-ink absolute top-0 left-1/2 z-20 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg"
        onClick={handleToggleActionBook}
        ref={actionMenuButtonRef}
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
