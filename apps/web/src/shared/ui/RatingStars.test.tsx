import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RatingStars } from './RatingStars'

describe('RatingStars', () => {
  it('draws filled stars for the rating and empty stars for the rest', () => {
    const { container } = render(<RatingStars rating={3} />)

    expect(screen.getByLabelText('별점 3점')).toBeInTheDocument()
    expect(container.querySelectorAll('svg[fill="currentColor"]')).toHaveLength(3)
    expect(container.querySelectorAll('svg[fill="none"]')).toHaveLength(2)
  })
})
