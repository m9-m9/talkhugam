import { AppShell } from '../../shared/ui/AppShell'

/** 홈 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function HomePage() {
  return (
    <AppShell>
      <p className="text-ink-subtle text-sm">함께 읽고 남길 책방을 준비하고 있어요.</p>
    </AppShell>
  )
}
