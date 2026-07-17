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

  it('moves focus into the action book and returns it to the trigger after Escape', async () => {
    render(
      <MemoryRouter initialEntries={['/rooms']}>
        <AppBottomNavigation />
      </MemoryRouter>,
    )

    const trigger = screen.getByRole('button', { name: '모임 시작 메뉴 열기' })
    fireEvent.click(trigger)

    await expect(screen.getByRole('button', { name: '새 모임 만들기' })).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })

    await expect(trigger).toHaveFocus()
    expect(screen.queryByRole('button', { name: '새 모임 만들기' })).not.toBeInTheDocument()
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

  it('closes the action book when the user taps outside it', () => {
    render(
      <MemoryRouter initialEntries={['/rooms']}>
        <AppBottomNavigation />
      </MemoryRouter>,
    )

    const trigger = screen.getByRole('button', { name: '모임 시작 메뉴 열기' })
    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('button', { name: '새 모임 만들기' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes the action book when keyboard focus moves to another navigation control', () => {
    render(
      <MemoryRouter initialEntries={['/rooms']}>
        <AppBottomNavigation />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '모임 시작 메뉴 열기' }))
    const profileButton = screen.getByRole('button', { name: '내 정보' })
    profileButton.focus()
    fireEvent.focusIn(profileButton)

    expect(screen.queryByRole('button', { name: '새 모임 만들기' })).not.toBeInTheDocument()
    expect(profileButton).toHaveFocus()
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
