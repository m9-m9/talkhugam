import { describe, expect, it, vi } from 'vitest'

import {
  bookRatingKeys,
  getBookChatRatings,
  getMyRatedBooks,
  removeBookChatRating,
  upsertBookChatRating,
} from '.'

const bookChatId = '22222222-2222-4222-8222-222222222222'

describe('bookRatingKeys', () => {
  it('keeps a rating roster and my rated books in separate query scopes', () => {
    expect(bookRatingKeys.byChat('chat-id')).toEqual(['book-ratings', 'chat-id'])
    expect(bookRatingKeys.myBooks('profile-id')).toEqual(['my-rated-books', 'profile-id'])
  })
})

describe('book rating queries', () => {
  it('calls the upsert RPC with the validated rating and trimmed review', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })

    await upsertBookChatRating({ rpc } as never, { bookChatId, rating: 4, review: ' 좋아요 ' })

    expect(rpc).toHaveBeenCalledWith('upsert_book_chat_rating', {
      p_book_chat_id: bookChatId,
      p_rating: 4,
      p_review: '좋아요',
    })
  })

  it('calls the remove RPC and throws RPC errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: new Error('fail') })

    await expect(removeBookChatRating({ rpc } as never, bookChatId)).rejects.toThrow('fail')
    expect(rpc).toHaveBeenCalledWith('remove_book_chat_rating', { p_book_chat_id: bookChatId })
  })

  it('reads my rated books ordered by the latest update', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })

    await expect(getMyRatedBooks({ from } as never, bookChatId)).resolves.toEqual([])
    expect(from).toHaveBeenCalledWith('book_chat_ratings')
    expect(order).toHaveBeenCalledWith('updated_at', { ascending: false })
  })

  it('reads the rating roster through the room so every member display name is available', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })

    await expect(getBookChatRatings({ from } as never, bookChatId, bookChatId)).resolves.toEqual([])
    expect(select.mock.calls[0]?.[0]).toContain(
      'book_chats!inner(reading_rooms!inner(room_members(',
    )
    expect(eq).toHaveBeenCalledWith('book_chat_id', bookChatId)
    expect(order).toHaveBeenCalledWith('updated_at', { ascending: true })
  })
})
