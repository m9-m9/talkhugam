import { describe, expect, it } from 'vitest'

import { calculateReadingProgressPercent, parseReadingProgresses } from './readingProgress'

describe('readingProgress', () => {
  it('converts a personal progress row into the UI model', () => {
    expect(
      parseReadingProgresses([
        {
          book_chat_id: '00000000-0000-4000-8000-000000000101',
          current_page: 87,
          total_pages: 320,
          updated_at: '2026-07-19T01:00:00+00:00',
        },
      ]),
    ).toEqual([
      {
        bookChatId: '00000000-0000-4000-8000-000000000101',
        currentPage: 87,
        totalPages: 320,
        updatedAt: '2026-07-19T01:00:00+00:00',
      },
    ])
  })

  it('rounds the page ratio to a percentage', () => {
    expect(calculateReadingProgressPercent(87, 320)).toBe(27)
  })

  it('rejects a current page beyond the total page count', () => {
    expect(() => calculateReadingProgressPercent(321, 320)).toThrow(
      '현재 페이지는 전체 페이지보다 클 수 없어요.',
    )
  })
})
