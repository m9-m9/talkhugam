import { describe, expect, it } from 'vitest'

import { bookCompletionKeys, parseBookChatCompletions, parseCompletedBooks } from './bookCompletion'

describe('bookCompletionKeys', () => {
  it('keeps a completion roster and my completed books in separate query scopes', () => {
    expect(bookCompletionKeys.byChat('chat-id')).toEqual(['book-completions', 'chat-id'])
    expect(bookCompletionKeys.myBooks('profile-id')).toEqual(['my-completed-books', 'profile-id'])
  })
})

describe('parseCompletedBooks', () => {
  it('maps a personal completion with the book and room it belongs to', () => {
    expect(
      parseCompletedBooks([
        {
          book_chat_id: 'e9b33e51-5b8d-4d33-a2ce-c49b22b6b700',
          book_chats: {
            books: {
              authors: ['기시미 이치로', '고가 후미타케'],
              thumbnail_url: 'https://example.com/cover.jpg',
              title: '미움받을 용기',
            },
            room_id: 'd3b3344d-5279-424a-9ed3-7ac35caa7513',
          },
          completed_at: '2026-07-18T01:00:00+00:00',
          rating: 5,
          review: '다시 읽고 싶은 책이에요.',
        },
      ]),
    ).toEqual([
      {
        authors: ['기시미 이치로', '고가 후미타케'],
        bookChatId: 'e9b33e51-5b8d-4d33-a2ce-c49b22b6b700',
        completedAt: '2026-07-18T01:00:00+00:00',
        rating: 5,
        review: '다시 읽고 싶은 책이에요.',
        roomId: 'd3b3344d-5279-424a-9ed3-7ac35caa7513',
        thumbnailUrl: 'https://example.com/cover.jpg',
        title: '미움받을 용기',
      },
    ])
  })
})

describe('parseBookChatCompletions', () => {
  it('uses the member identity from the current room and marks my completion', () => {
    expect(
      parseBookChatCompletions(
        [
          {
            completed_at: '2026-07-18T01:00:00+00:00',
            profile_id: '0a9c9826-5aa6-41d0-a2f7-e79b5f667b20',
            profiles: { avatar_path: 'profiles/min-gyu.png', display_name: '민규' },
            rating: 4,
            review: null,
            book_chats: {
              room_members: [
                {
                  profile_id: '0a9c9826-5aa6-41d0-a2f7-e79b5f667b20',
                  room_avatar_path: 'rooms/book-club-min-gyu.png',
                  room_display_name: '민규의 독서모임 이름',
                },
              ],
            },
          },
        ],
        '0a9c9826-5aa6-41d0-a2f7-e79b5f667b20',
      ),
    ).toEqual([
      {
        avatarPath: 'rooms/book-club-min-gyu.png',
        completedAt: '2026-07-18T01:00:00+00:00',
        displayName: '민규의 독서모임 이름',
        isMe: true,
        profileId: '0a9c9826-5aa6-41d0-a2f7-e79b5f667b20',
        rating: 4,
        review: null,
      },
    ])
  })
})
