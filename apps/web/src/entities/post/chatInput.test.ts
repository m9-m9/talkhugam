import { describe, expect, it } from 'vitest'

import { shouldSubmitMessage } from './chatInput'

describe('chat input keyboard behavior', () => {
  it('submits a message with Enter', () => {
    expect(shouldSubmitMessage('Enter', false)).toBe(true)
  })

  it('keeps a line break with Shift+Enter', () => {
    expect(shouldSubmitMessage('Enter', true)).toBe(false)
  })
})
