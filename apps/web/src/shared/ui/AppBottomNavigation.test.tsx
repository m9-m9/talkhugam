import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { AppBottomNavigation } from './AppBottomNavigation'

function CurrentPath() {
  return <p>{useLocation().pathname}</p>
}

describe('AppBottomNavigation', () => {
  afterEach(cleanup)

  it('navigates to the room creation flow from the centered plus button', async () => {
    render(
      <MemoryRouter initialEntries={['/rooms']}>
        <AppBottomNavigation />
        <Routes>
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '새 독서방 만들기' }))

    expect(screen.getByText('/rooms/create')).toBeInTheDocument()
  })

  it('marks the current top-level destination', () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AppBottomNavigation />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: '내 정보' })).toHaveAttribute('aria-current', 'page')
  })
})
