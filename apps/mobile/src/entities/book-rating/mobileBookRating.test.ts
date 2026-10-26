import { describe, expect, it, vi } from 'vitest'

import {
  getMobileBookChatRatings,
  removeMobileBookChatRating,
  upsertMobileBookChatRating,
} from './mobileBookRating'

const bookChatId = '5b0f1c9e-6a4d-4c1e-8f3a-2d7e9a1b4c02'
const profileId = '8c2e4a6b-1d3f-4b5a-9c7e-0f1a2b3c4d03'

describe('getMobileBookChatRatings', () => {
  it('scopes the roster to the active book chat and maps it with the current profile id', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })

    await expect(
      getMobileBookChatRatings({ from } as never, bookChatId, profileId),
    ).resolves.toEqual([])

    expect(from).toHaveBeenCalledWith('book_chat_ratings')
    expect(select.mock.calls[0]?.[0]).toContain(
      'book_chats!inner(reading_rooms!inner(room_members(',
    )
    expect(eq).toHaveBeenCalledWith('book_chat_id', bookChatId)
    expect(order).toHaveBeenCalledWith('updated_at', { ascending: true })
  })
})

describe('upsertMobileBookChatRating', () => {
  it('passes only validated rating values through the restricted server RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })

    await upsertMobileBookChatRating({ rpc } as never, {
      bookChatId,
      rating: 5,
      review: ' 오래 남는 문장이 많았어요. ',
    })

    expect(rpc).toHaveBeenCalledWith('upsert_book_chat_rating', {
      p_book_chat_id: bookChatId,
      p_rating: 5,
      p_review: '오래 남는 문장이 많았어요.',
    })
  })
})

describe('removeMobileBookChatRating', () => {
  it('calls only the current-user rating removal RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })

    await removeMobileBookChatRating({ rpc } as never, bookChatId)

    expect(rpc).toHaveBeenCalledWith('remove_book_chat_rating', { p_book_chat_id: bookChatId })
  })
})
