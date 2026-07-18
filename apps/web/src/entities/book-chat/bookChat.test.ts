import { describe, expect, it, vi } from 'vitest'

import {
  bookChatKeys,
  getMyArchivedBookChats,
  parseBookChats,
  parseBookSearchResponse,
} from './bookChat'

describe('bookChatKeys', () => {
  it('scopes room data to its room id', () => {
    expect(bookChatKeys.room('room-id')).toEqual(['reading-room', 'room-id'])
    expect(bookChatKeys.byRoom('room-id')).toEqual(['book-chats', 'room-id'])
  })
})

describe('parseBookChats', () => {
  it('keeps a created chat visible with its chat name when its book relation is temporarily unavailable', () => {
    expect(
      parseBookChats([
        {
          books: { authors: ['정민규'], thumbnail_url: null, title: '함께 읽는 책' },
          id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
          name: '함께 읽는 책',
        },
        { books: null, id: '11dd2691-ca0d-4b86-bb2b-9fa7c6cd374f', name: '새로 만든 책' },
      ]),
    ).toEqual([
      {
        authors: ['정민규'],
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        name: '함께 읽는 책',
        thumbnailUrl: null,
        title: '함께 읽는 책',
      },
      {
        authors: [],
        id: '11dd2691-ca0d-4b86-bb2b-9fa7c6cd374f',
        name: '새로 만든 책',
        thumbnailUrl: null,
        title: '새로 만든 책',
      },
    ])
  })
})

describe('getMyArchivedBookChats', () => {
  it('asks for only the signed-in member archived book chats with book details', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const status = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq: status })
    const from = vi.fn().mockReturnValue({ select })
    const client = {
      from,
    }

    const profileId = 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e'
    await getMyArchivedBookChats(client as never, profileId)

    expect(from).toHaveBeenCalledWith('book_chats')
    expect(status).toHaveBeenCalledWith('status', 'archived')
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
