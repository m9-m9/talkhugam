import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LoadingSpinner } from './LoadingSpinner'

describe('LoadingSpinner', () => {
  it('announces its loading message and renders the brand spinner by default', () => {
    const { container } = render(<LoadingSpinner label="독서방을 불러오고 있어요." />)

    expect(screen.getByRole('status', { name: '독서방을 불러오고 있어요.' })).toBeInTheDocument()
    expect(container.querySelector('.talkhugam-brand-spinner')).toBeInTheDocument()
    expect(container.querySelector('.talkhugam-book-loader')).not.toBeInTheDocument()
  })

  it('renders the book loader only when the longer reading-room or video wait needs it', () => {
    const { container } = render(<LoadingSpinner label="영상을 준비하고 있어요." variant="book" />)

    expect(container.querySelector('.talkhugam-book-loader')).toBeInTheDocument()
    expect(container.querySelector('.talkhugam-brand-spinner')).not.toBeInTheDocument()
  })
})
