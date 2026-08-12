import type { QueryClient } from '@tanstack/react-query'

import { readingProgressKeys, type ReadingProgress } from '../../entities/reading-progress'

type ReadingProgressCacheInput = {
  bookChatId: string
  currentPage: number
  profileId: string
  totalPages: number
}

/** 저장한 개인 진행률을 책방과 내 정보 화면이 함께 쓰는 캐시에 즉시 반영한다. */
export function storeReadingProgressInCache(
  queryClient: QueryClient,
  input: ReadingProgressCacheInput,
) {
  const progress = createReadingProgress(input)
  queryClient.setQueryData<ReadingProgress[]>(
    readingProgressKeys.byProfile(input.profileId),
    (progresses = []) => [
      ...progresses.filter((item) => item.bookChatId !== input.bookChatId),
      progress,
    ],
  )
}

/** 진행률 변경 뒤 비활성 화면의 서버 상태만 조용히 새로고침한다. */
export function invalidateReadingProgressQueries(queryClient: QueryClient, profileId: string) {
  void queryClient
    .invalidateQueries({
      queryKey: readingProgressKeys.byProfile(profileId),
      refetchType: 'inactive',
    })
    .catch(() => undefined)
}

/** 입력값으로 화면에서 사용할 개인 독서 진행률 모델을 생성한다. */
function createReadingProgress(input: ReadingProgressCacheInput): ReadingProgress {
  return {
    bookChatId: input.bookChatId,
    currentPage: input.currentPage,
    totalPages: input.totalPages,
    updatedAt: new Date().toISOString(),
  }
}
