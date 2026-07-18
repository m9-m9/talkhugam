import { describe, expect, it, vi } from 'vitest'

import {
  bookChatKeys,
  getMyArchivedBookChats,
  parseReadingBooks,
  parseBookChats,
  parseBookSearchResponse,
} from './bookChat'

describe('bookChatKeys', () => {
  it('scopes room data to its room id', () => {
    expect(bookChatKeys.room('room-id')).toEqual(['reading-room', 'room-id'])
    expect(bookChatKeys.byRoom('room-id')).toEqual(['book-chats', 'room-id'])
    expect(bookChatKeys.myReading('profile-id', ['chat-a'])).toEqual([
      'my-reading-books',
      'profile-id',
      'chat-a',
    ])
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

describe('parseReadingBooks', () => {
  it('groups a signed-in member reading list by room and marks only personally completed books', () => {
    expect(
      parseReadingBooks(
        [
          {
            books: { authors: ['기시미 이치로'], thumbnail_url: null, title: '미움받을 용기' },
            id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
            name: '미움받을 용기',
            reading_rooms: { name: '금요일 아침 독서방' },
            room_id: '11dd2691-ca0d-4b86-bb2b-9fa7c6cd374f',
          },
          {
            books: { authors: ['양귀자'], thumbnail_url: null, title: '모순' },
            id: '58f62b06-824c-41f1-85ab-5b9db99cd467',
            name: '모순',
            reading_rooms: { name: '토요일 저녁 독서방' },
            room_id: '719dc8f2-2de0-4a91-a7d5-20a6a89cad75',
          },
        ],
        ['58f62b06-824c-41f1-85ab-5b9db99cd467'],
      ),
    ).toEqual([
      {
        authors: ['기시미 이치로'],
        bookChatId: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        isCompleted: false,
        roomId: '11dd2691-ca0d-4b86-bb2b-9fa7c6cd374f',
        roomName: '금요일 아침 독서방',
        thumbnailUrl: null,
        title: '미움받을 용기',
      },
      {
        authors: ['양귀자'],
        bookChatId: '58f62b06-824c-41f1-85ab-5b9db99cd467',
        isCompleted: true,
        roomId: '719dc8f2-2de0-4a91-a7d5-20a6a89cad75',
        roomName: '토요일 저녁 독서방',
        thumbnailUrl: null,
        title: '모순',
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
