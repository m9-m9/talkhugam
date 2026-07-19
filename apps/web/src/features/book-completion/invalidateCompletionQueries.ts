import type { QueryClient } from '@tanstack/react-query'

import { bookChatKeys } from '../../entities/book-chat'
import { bookCompletionKeys } from '../../entities/book-completion'
import { readingProgressKeys } from '../../entities/reading-progress'

/** 완독 저장·취소 뒤 개인 책 목록과 진행률을 백그라운드에서 최신화한다. */
export function invalidateCompletionQueries(
  queryClient: QueryClient,
  bookChatId: string,
  profileId: string,
) {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: bookCompletionKeys.byChat(bookChatId) }),
    queryClient.invalidateQueries({ queryKey: bookCompletionKeys.myBooks(profileId) }),
    queryClient.invalidateQueries({ queryKey: bookCompletionKeys.myBookChatIds(profileId) }),
    queryClient.invalidateQueries({ queryKey: bookChatKeys.myReading(profileId, []) }),
    queryClient.invalidateQueries({ queryKey: readingProgressKeys.byProfile(profileId) }),
  ]).catch(() => undefined)
}
