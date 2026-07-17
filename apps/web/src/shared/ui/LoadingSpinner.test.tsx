import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LoadingSpinner } from './LoadingSpinner'

describe('LoadingSpinner', () => {
  it('announces its loading message and renders the book illustration', () => {
    const { container } = render(<LoadingSpinner label="독서방을 불러오고 있어요." />)

    expect(screen.getByRole('status', { name: '독서방을 불러오고 있어요.' })).toBeInTheDocument()
    expect(container.querySelector('.talkhugam-book-loader')).toBeInTheDocument()
  })
})
