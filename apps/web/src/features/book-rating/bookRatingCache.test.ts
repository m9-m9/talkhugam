import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { bookRatingKeys, type BookChatRating } from '../../entities/book-rating'

import { removeBookRatingFromCache, storeBookRatingInCache } from './bookRatingCache'

const profileId = '11111111-1111-4111-8111-111111111111'
const bookChatId = '22222222-2222-4222-8222-222222222222'

describe('bookRatingCache', () => {
  it('stores my rating in the book chat rating cache, replacing an earlier one', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData<BookChatRating[]>(bookRatingKeys.byChat(bookChatId), [
      {
        avatarPath: null,
        displayName: '나',
        isMe: true,
        profileId,
        rating: 2,
        review: null,
        updatedAt: '2026-07-18T01:00:00+00:00',
      },
    ])

    storeBookRatingInCache(queryClient, { bookChatId, profileId, rating: 4, review: '좋아요' })

    expect(queryClient.getQueryData<BookChatRating[]>(bookRatingKeys.byChat(bookChatId))).toEqual([
      expect.objectContaining({ isMe: true, profileId, rating: 4, review: '좋아요' }),
    ])
  })

  it('removes only my rating from the cache', () => {
    const queryClient = new QueryClient()
    storeBookRatingInCache(queryClient, { bookChatId, profileId, rating: 4, review: null })

    removeBookRatingFromCache(queryClient, { bookChatId, profileId })

    expect(queryClient.getQueryData<BookChatRating[]>(bookRatingKeys.byChat(bookChatId))).toEqual(
      [],
    )
  })
})
