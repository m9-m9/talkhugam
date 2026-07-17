import { describe, expect, it } from 'vitest'

import { bookChatKeys, parseBookChats, parseBookSearchResponse } from './bookChat'

describe('bookChatKeys', () => {
  it('scopes room data to its room id', () => {
    expect(bookChatKeys.room('room-id')).toEqual(['reading-room', 'room-id'])
    expect(bookChatKeys.byRoom('room-id')).toEqual(['book-chats', 'room-id'])
  })
})

describe('parseBookChats', () => {
  it('maps book-chat rows and omits incomplete book relations', () => {
    expect(
      parseBookChats([
        {
          books: { authors: ['정민규'], thumbnail_url: null, title: '함께 읽는 책' },
          id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
          name: '함께 읽는 책',
        },
        {
          books: null,
          id: '11dd2691-ca0d-4b86-bb2b-9fa7c6cd374f',
          name: '삭제된 책',
        },
      ]),
    ).toEqual([
      {
        authors: ['정민규'],
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        name: '함께 읽는 책',
        thumbnailUrl: null,
        title: '함께 읽는 책',
      },
    ])
  })
})

describe('parseBookSearchResponse', () => {
  it('accepts only successful validated search results', () => {
    expect(
      parseBookSearchResponse({
        data: {
          items: [
            {
              authors: ['정민규'],
              externalUrl: 'https://example.com/book',
              isbn10: null,
              isbn13: '9781234567890',
              publishedAt: '2026-01-01',
              publisher: 'Talk출판사',
              source: 'kakao',
              thumbnailUrl: null,
              title: '함께 읽는 책',
            },
          ],
        },
        ok: true,
        requestId: 'request-id',
      }),
    ).toHaveLength(1)
  })
})
