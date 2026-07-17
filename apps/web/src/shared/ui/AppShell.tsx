import type { PropsWithChildren } from 'react'

export function AppShell({ children }: PropsWithChildren) {
  return <main className="app-page bg-surface flex min-h-screen items-center px-4">{children}</main>
}
