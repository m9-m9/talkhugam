import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppHeader } from './AppHeader'

describe('AppHeader', () => {
  it('renders the current page and a right-aligned action', () => {
    render(<AppHeader action={<button type="button">새 책</button>} title="독서방" />)

    expect(screen.getByText('독서방')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '새 책' })).toBeInTheDocument()
  })

  it('provides an icon-only back action when a previous page exists', () => {
    const handleBack = vi.fn()
    render(<AppHeader onBack={handleBack} title="책 검색" />)

    fireEvent.click(screen.getByRole('button', { name: '이전 화면으로' }))

    expect(handleBack).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '이전 화면으로' })).toHaveClass('seed-action-button')
    expect(screen.queryByText('뒤로')).not.toBeInTheDocument()
  })

  it('renders the page title as the primary heading when the screen has no other heading', () => {
    render(<AppHeader title="알림" titleAsHeading />)

    expect(screen.getByRole('heading', { level: 1, name: '알림' })).toBeInTheDocument()
  })
})
