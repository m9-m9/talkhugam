import { describe, expect, it } from 'vitest'

import { bookChatKeys, parseBookChats, parsePostForm, parsePosts, postKeys } from './index'

const bookChatId = 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e'
const roomId = '11dd2691-ca0d-4b86-bb2b-9fa7c6cd374f'
const memberId = 'b3c8b282-6092-45f8-b15f-523a9dcd0eab'

describe('book discussion domain', () => {
  it('returns query keys scoped to the book chat and reading room', () => {
    expect(bookChatKeys.byRoom(roomId)).toEqual(['book-chats', roomId])
    expect(bookChatKeys.detail(roomId, bookChatId)).toEqual(['book-chat', roomId, bookChatId])
    expect(postKeys.byBookChat(roomId, bookChatId)).toEqual(['posts', roomId, bookChatId])
  })

  it('maps a book chat row while its related book is unavailable', () => {
    expect(
      parseBookChats([
        {
          books: null,
          id: bookChatId,
          name: '새로 만든 책',
        },
      ]),
    ).toEqual([
      {
        authors: [],
        id: bookChatId,
        name: '새로 만든 책',
        thumbnailUrl: null,
        title: '새로 만든 책',
      },
    ])
  })

  it('normalizes a post form and preserves member mentions', () => {
    expect(
      parsePostForm({
        body: ' 함께 읽어요 ',
        mentionedMemberIds: [memberId],
      }),
    ).toEqual({
      body: '함께 읽어요',
      labels: [],
      mentionedMemberIds: [memberId],
    })
  })

  it('maps labels by their persisted order without exposing database field names', () => {
    expect(
      parsePosts([
        {
          author_member_id: memberId,
          author_name_snapshot: '민규',
          body: '감상',
          created_at: '2026-07-17T02:01:30.123+00:00',
          depth: 0,
          id: bookChatId,
          post_labels: [
            { kind: 'chapter', sort_order: 1, value: '3장' },
            { kind: 'page', sort_order: 0, value: '87' },
          ],
          root_post_id: null,
        },
      ]),
    ).toEqual([
      {
        authorMemberId: memberId,
        authorName: '민규',
        body: '감상',
        createdAt: '2026-07-17T02:01:30.123+00:00',
        depth: 0,
        id: bookChatId,
        labels: [
          { kind: 'page', value: '87' },
          { kind: 'chapter', value: '3장' },
        ],
        rootPostId: null,
      },
    ])
  })
})
