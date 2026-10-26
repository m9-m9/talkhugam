import { describe, expect, it } from 'vitest'

import {
  bookCompletionKeys,
  parseBookChatCompletions,
  parseBookCompletionInput,
  parseCompletedBooks,
} from './bookCompletion'

const bookChatId = 'e9b33e51-5b8d-4d33-a2ce-c49b22b6b700'
const profileId = '0a9c9826-5aa6-41d0-a2f7-e79b5f667b20'
const roomId = 'd3b3344d-5279-424a-9ed3-7ac35caa7513'

describe('book completion domain', () => {
  it('keeps completion caches scoped to the book chat and profile', () => {
    expect(bookCompletionKeys.byChat(bookChatId)).toEqual(['book-completions', bookChatId])
    expect(bookCompletionKeys.myBooks(profileId)).toEqual(['my-completed-books', profileId])
    expect(bookCompletionKeys.myBookChatIds(profileId)).toEqual([
      'my-completion-book-chat-ids',
      profileId,
    ])
  })

  it('normalizes an optional review and rejects a review longer than one thousand characters', () => {
    expect(
      parseBookCompletionInput({
        bookChatId,
        rating: 5,
        review: ' 오래 기억하고 싶은 문장이 많아요. ',
      }),
    ).toEqual({
      bookChatId,
      rating: 5,
      review: '오래 기억하고 싶은 문장이 많아요.',
    })
    expect(() =>
      parseBookCompletionInput({ bookChatId, rating: null, review: '가'.repeat(1001) }),
    ).toThrow()
  })

  it('maps a member completion with the room-specific identity and the current-user marker', () => {
    expect(
      parseBookChatCompletions(
        [
          {
            book_chats: {
              room_members: [
                {
                  profile_id: profileId,
                  room_avatar_path: 'rooms/member.png',
                  room_display_name: '민규의 독서모임 이름',
                },
              ],
            },
            completed_at: '2026-08-18T01:00:00.000+00:00',
            profile_id: profileId,
            profiles: { avatar_path: 'profiles/member.png', display_name: '민규' },
            rating: 4,
            review: null,
          },
        ],
        profileId,
      ),
    ).toEqual([
      {
        avatarPath: 'rooms/member.png',
        completedAt: '2026-08-18T01:00:00.000+00:00',
        displayName: '민규의 독서모임 이름',
        isMe: true,
        profileId,
        rating: 4,
        review: null,
      },
    ])
  })

  it('maps a completed book without exposing persisted column names', () => {
    expect(
      parseCompletedBooks([
        {
          book_chat_id: bookChatId,
          book_chats: {
            books: {
              authors: ['기시미 이치로'],
              thumbnail_url: 'https://example.com/cover.jpg',
              title: '미움받을 용기',
            },
            room_id: roomId,
          },
          completed_at: '2026-08-18T01:00:00.000+00:00',
          rating: 5,
          review: '다시 읽고 싶은 책이에요.',
        },
      ]),
    ).toEqual([
      {
        authors: ['기시미 이치로'],
        bookChatId,
        completedAt: '2026-08-18T01:00:00.000+00:00',
        rating: 5,
        review: '다시 읽고 싶은 책이에요.',
        roomId,
        thumbnailUrl: 'https://example.com/cover.jpg',
        title: '미움받을 용기',
      },
    ])
  })
})
