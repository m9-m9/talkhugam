import { describe, expect, it } from 'vitest'

import {
  canTransitionFeedbackStatus,
  formatFeedbackStatus,
  parseFeedbackSubmission,
} from './feedback'

describe('parseFeedbackSubmission', () => {
  it('trims a valid feature suggestion before it is submitted', () => {
    expect(
      parseFeedbackSubmission({ category: 'feature', body: '  영상에 자막을 넣고 싶어요.  ' }),
    ).toEqual({ category: 'feature', body: '영상에 자막을 넣고 싶어요.' })
  })

  it('rejects an empty feedback message', () => {
    expect(() => parseFeedbackSubmission({ category: 'issue', body: '   ' })).toThrow()
  })
})

describe('canTransitionFeedbackStatus', () => {
  it('allows an unread ticket to be marked as in progress', () => {
    expect(canTransitionFeedbackStatus('unread', 'in_progress')).toBe(true)
  })

  it('allows an operator to reopen a completed ticket', () => {
    expect(canTransitionFeedbackStatus('completed', 'in_progress')).toBe(true)
  })
})

describe('formatFeedbackStatus', () => {
  it('returns the Korean label used by the operator inbox', () => {
    expect(formatFeedbackStatus('completed')).toBe('완료')
  })
})
