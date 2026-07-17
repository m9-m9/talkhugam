import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { AppBottomNavigation } from './AppBottomNavigation'

function CurrentPath() {
  return <p>{useLocation().pathname}</p>
}

describe('AppBottomNavigation', () => {
  afterEach(cleanup)

  it('opens a two-page action book from the centered plus button', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/rooms']}>
        <AppBottomNavigation />
        <Routes>
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '모임 시작 메뉴 열기' }))

    expect(screen.getByRole('button', { name: '새 모임 만들기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '초대 코드로 참여' })).toBeInTheDocument()
    expect(container.querySelector('path')?.getAttribute('d')).toContain('C31 1 75 1')
  })

  it('navigates to room creation from the left page of the action book', () => {
    render(
      <MemoryRouter initialEntries={['/rooms']}>
        <AppBottomNavigation />
        <Routes>
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '모임 시작 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '새 모임 만들기' }))

    expect(screen.getByText('/rooms/create')).toBeInTheDocument()
  })

  it('navigates to invite-code participation from the right page of the action book', () => {
    render(
      <MemoryRouter initialEntries={['/rooms']}>
        <AppBottomNavigation />
        <Routes>
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '모임 시작 메뉴 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '초대 코드로 참여' }))

    expect(screen.getByText('/rooms/join')).toBeInTheDocument()
  })

  it('navigates to the reading-group main page from the Talk후감 logo', () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AppBottomNavigation />
        <Routes>
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Talk후감 메인으로' }))

    expect(screen.getByText('/rooms')).toBeInTheDocument()
  })

  it('marks the current top-level destination', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/profile']}>
        <AppBottomNavigation />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: '내 정보' })).toHaveAttribute('aria-current', 'page')
    expect(container.querySelector('img')).toHaveAttribute('src', '/brand/talkhugam-symbol.svg')
  })
})
