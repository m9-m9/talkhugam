import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BrandSymbol } from './BrandSymbol'

describe('BrandSymbol', () => {
  afterEach(cleanup)

  it('uses the coral outline asset on a bright surface', () => {
    render(<BrandSymbol tone="coral" />)

    expect(screen.getByRole('img', { name: 'Talk후감' })).toHaveAttribute(
      'src',
      '/brand/talkhugam-symbol.svg',
    )
  })

  it('uses the inverse asset inside a coral or dark surface', () => {
    render(<BrandSymbol tone="inverse" />)

    expect(screen.getByRole('img', { name: 'Talk후감' })).toHaveAttribute(
      'src',
      '/brand/talkhugam-symbol-inverse.svg',
    )
  })
})
