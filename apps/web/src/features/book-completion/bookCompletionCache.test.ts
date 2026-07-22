import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { bookChatKeys, type ReadingBook } from '../../entities/book-chat'
import { bookCompletionKeys, type BookChatCompletion } from '../../entities/book-completion'
import { readingProgressKeys, type ReadingProgress } from '../../entities/reading-progress'

import { removeBookCompletionFromCache, storeBookCompletionInCache } from './bookCompletionCache'

const profileId = '00000000-0000-0000-0000-000000000001'
const bookChatId = '00000000-0000-0000-0000-000000000101'

/** 완독·진행률·책 목록 캐시를 공통 테스트 데이터로 채운 QueryClient를 만든다. */
function createQueryClientWithBookState() {
  const queryClient = new QueryClient()
  queryClient.setQueryData<BookChatCompletion[]>(bookCompletionKeys.byChat(bookChatId), [])
  queryClient.setQueryData<string[]>(bookCompletionKeys.myBookChatIds(profileId), [])
  queryClient.setQueryData<ReadingBook[]>(bookChatKeys.myReading(profileId, []), [
    {
      authors: ['기시미 이치로'],
      bookChatId,
      isCompleted: false,
      roomId: '00000000-0000-0000-0000-000000000201',
      roomName: '금요일 아침 책방',
      thumbnailUrl: null,
      title: '미움받을 용기',
    },
  ])
  queryClient.setQueryData<ReadingProgress[]>(readingProgressKeys.byProfile(profileId), [
    {
      bookChatId,
      currentPage: 87,
      totalPages: 320,
      updatedAt: '2026-07-19T00:00:00.000Z',
    },
  ])
  return queryClient
}

describe('bookCompletionCache', () => {
  it('stores a completion across the book chat, bookshop, profile, and progress caches', () => {
    const queryClient = createQueryClientWithBookState()

    storeBookCompletionInCache(queryClient, {
      bookChatId,
      profileId,
      rating: 4,
      review: '다시 읽고 싶은 책이에요.',
    })

    expect(
      queryClient.getQueryData<BookChatCompletion[]>(bookCompletionKeys.byChat(bookChatId)),
    ).toEqual([
      expect.objectContaining({ isMe: true, rating: 4, review: '다시 읽고 싶은 책이에요.' }),
    ])
    expect(queryClient.getQueryData<string[]>(bookCompletionKeys.myBookChatIds(profileId))).toEqual(
      [bookChatId],
    )
    expect(queryClient.getQueryData<ReadingBook[]>(bookChatKeys.myReading(profileId, []))).toEqual([
      expect.objectContaining({ bookChatId, isCompleted: true }),
    ])
    expect(
      queryClient.getQueryData<ReadingProgress[]>(readingProgressKeys.byProfile(profileId)),
    ).toEqual([expect.objectContaining({ bookChatId, currentPage: 320, totalPages: 320 })])
  })

  it('removes only the personal completion cache state without erasing saved progress', () => {
    const queryClient = createQueryClientWithBookState()
    storeBookCompletionInCache(queryClient, { bookChatId, profileId, rating: null, review: null })

    removeBookCompletionFromCache(queryClient, { bookChatId, profileId })

    expect(
      queryClient.getQueryData<BookChatCompletion[]>(bookCompletionKeys.byChat(bookChatId)),
    ).toEqual([])
    expect(queryClient.getQueryData<string[]>(bookCompletionKeys.myBookChatIds(profileId))).toEqual(
      [],
    )
    expect(queryClient.getQueryData<ReadingBook[]>(bookChatKeys.myReading(profileId, []))).toEqual([
      expect.objectContaining({ bookChatId, isCompleted: false }),
    ])
    expect(
      queryClient.getQueryData<ReadingProgress[]>(readingProgressKeys.byProfile(profileId)),
    ).toEqual([expect.objectContaining({ bookChatId, currentPage: 320, totalPages: 320 })])
  })
})
