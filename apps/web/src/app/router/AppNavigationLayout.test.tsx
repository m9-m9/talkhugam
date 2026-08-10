import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { AppNavigationLayout } from './AppNavigationLayout'

describe('AppNavigationLayout', () => {
  afterEach(cleanup)

  it.each(['/rooms/create', '/rooms/room-1', '/rooms/room-1/books/new'])(
    'shows the global bottom navigation on %s',
    (initialEntry) => {
      renderLayout(initialEntry)

      expect(screen.getByRole('navigation', { name: '주요 메뉴' })).toBeInTheDocument()
    },
  )

  it.each([
    '/rooms/room-1/books/book-1',
    '/rooms/room-1/books/book-1/videos',
    '/rooms/room-1/books/book-1/videos/video-1',
    '/profile/edit',
    '/profile/settings',
  ])('hides the global bottom navigation on immersive detail path %s', (initialEntry) => {
    renderLayout(initialEntry)

    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '의견 보내기' })).not.toBeInTheDocument()
    expect(screen.getByText('현재 화면')).toBeInTheDocument()
  })
})

function renderLayout(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AppNavigationLayout />}>
          <Route path="*" element={<p>현재 화면</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}
