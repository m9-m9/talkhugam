import { useNavigate } from 'react-router-dom'

type RouteRecoveryKind = 'error' | 'not-found'

/** 잘못된 주소 또는 라우트 렌더링 오류에서 책방 목록으로 복귀하는 화면을 렌더링한다. */
export function RouteRecoveryPage({ kind }: { kind: RouteRecoveryKind }) {
  const navigate = useNavigate()
  const isNotFound = kind === 'not-found'
  const title = isNotFound ? '페이지를 찾을 수 없어요' : '화면을 불러오지 못했어요'
  const description = isNotFound
    ? '주소를 다시 확인하거나 내 책방으로 돌아가 보세요.'
    : '잠시 후 다시 시도하거나 내 책방으로 돌아가 보세요.'

  /** 사용자를 책방 목록으로 이동시켜 다음 행동을 이어갈 수 있게 한다. */
  function handleReturnToRooms() {
    void navigate('/rooms', { replace: true })
  }

  return (
    <main className="app-page bg-surface flex min-h-dvh items-center justify-center px-4 text-center">
      <section aria-labelledby="route-recovery-title" className="max-w-sm">
        <p className="text-primary text-sm font-semibold">Talk후감</p>
        <h1 className="text-ink mt-3 text-xl font-bold" id="route-recovery-title">
          {title}
        </h1>
        <p className="text-ink-subtle mt-3 text-sm">{description}</p>
        <button
          className="bg-primary text-ink hover:bg-primary/90 focus-visible:ring-primary mt-6 min-h-11 cursor-pointer rounded-lg px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          onClick={handleReturnToRooms}
          type="button"
        >
          책방으로 돌아가기
        </button>
      </section>
    </main>
  )
}
