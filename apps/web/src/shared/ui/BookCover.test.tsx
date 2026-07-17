import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BookCover } from './BookCover'

describe('BookCover', () => {
  it('renders the API thumbnail with an accessible title', () => {
    render(<BookCover alt="미움받을 용기 표지" thumbnailUrl="https://example.com/cover.jpg" />)

    expect(screen.getByRole('img', { name: '미움받을 용기 표지' })).toHaveAttribute(
      'src',
      'https://example.com/cover.jpg',
    )
  })

  it('renders a neutral fallback when the API has no thumbnail', () => {
    const { container } = render(<BookCover alt="미움받을 용기 표지" thumbnailUrl={null} />)

    expect(within(container).queryByRole('img')).not.toBeInTheDocument()
    expect(container).toHaveTextContent('책')
  })
})
