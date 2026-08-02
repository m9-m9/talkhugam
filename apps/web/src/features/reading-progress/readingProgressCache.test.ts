import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { readingProgressKeys } from '../../entities/reading-progress'
import { storeReadingProgressInCache } from './readingProgressCache'

describe('storeReadingProgressInCache', () => {
  it('replaces the same book progress so every subscribed screen receives the new value', () => {
    const queryClient = new QueryClient()
    const profileId = '00000000-0000-0000-0000-000000000001'
    queryClient.setQueryData(readingProgressKeys.byProfile(profileId), [
      {
        bookChatId: '00000000-0000-0000-0000-000000000101',
        currentPage: 10,
        totalPages: 320,
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ])

    storeReadingProgressInCache(queryClient, {
      bookChatId: '00000000-0000-0000-0000-000000000101',
      currentPage: 87,
      profileId,
      totalPages: 320,
    })

    expect(queryClient.getQueryData(readingProgressKeys.byProfile(profileId))).toMatchObject([
      {
        bookChatId: '00000000-0000-0000-0000-000000000101',
        currentPage: 87,
        totalPages: 320,
      },
    ])
  })
})
