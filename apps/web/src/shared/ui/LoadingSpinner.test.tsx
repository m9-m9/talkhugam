import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BookLoadingIndicator, BrandLoadingSpinner } from './LoadingSpinner'

describe('loading indicators', () => {
  it('renders the explicitly requested brand spinner', () => {
    const { container } = render(<BrandLoadingSpinner label="독서방을 불러오고 있어요." />)

    expect(screen.getByRole('status', { name: '독서방을 불러오고 있어요.' })).toBeInTheDocument()
    expect(container.querySelector('.talkhugam-brand-spinner')).toBeInTheDocument()
    expect(container.querySelector('.talkhugam-book-loader')).not.toBeInTheDocument()
  })

  it('renders the explicitly requested book loader', () => {
    const { container } = render(<BookLoadingIndicator label="영상을 준비하고 있어요." />)

    expect(container.querySelector('.talkhugam-book-loader')).toBeInTheDocument()
    expect(container.querySelector('.talkhugam-brand-spinner')).not.toBeInTheDocument()
  })
})
