import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CompletionMark } from './CompletionMark'

describe('CompletionMark', () => {
  it('uses the brand completion asset with an accessible completion label', () => {
    render(<CompletionMark />)

    expect(screen.getByText('완독')).toBeInTheDocument()
    expect(document.querySelector('img')).toHaveAttribute('src', '/brand/talkhugam-completion.svg')
  })
})
