import type { PropsWithChildren } from 'react'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <main className="bg-surface mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      {children}
    </main>
  )
}
