import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ReadingStatus } from './ReadingStatus'

describe('ReadingStatus', () => {
  it('shows a personal page progress with an accessible progress bar', () => {
    render(<ReadingStatus currentPage={142} totalPages={320} />)

    expect(screen.getByText('142 / 320쪽')).toBeInTheDocument()
    expect(screen.getByText('44%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '독서 진행률 44%' })).toHaveAttribute(
      'aria-valuenow',
      '44',
    )
  })

  it('replaces the progress with a completion badge when the book is completed', () => {
    const { container } = render(<ReadingStatus currentPage={142} isCompleted totalPages={320} />)

    expect(screen.getByText('완독')).toBeInTheDocument()
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
  })
})
