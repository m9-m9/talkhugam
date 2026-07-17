import type { PropsWithChildren } from 'react'

/** 앱 공통 화면 틀 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function AppShell({ children }: PropsWithChildren) {
  return <main className="app-page bg-surface flex min-h-screen items-center px-4">{children}</main>
}
