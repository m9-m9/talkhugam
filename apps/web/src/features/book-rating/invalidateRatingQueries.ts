import type { QueryClient } from '@tanstack/react-query'

import { bookRatingKeys } from '../../entities/book-rating'

/** 별점 저장·취소 뒤 책 대화방 별점 현황과 내 별점 도서를 백그라운드에서 최신화한다. */
export function invalidateRatingQueries(
  queryClient: QueryClient,
  bookChatId: string,
  profileId: string,
) {
  void Promise.all([
    queryClient.invalidateQueries({
      queryKey: bookRatingKeys.byChat(bookChatId),
      refetchType: 'inactive',
    }),
    queryClient.invalidateQueries({ queryKey: bookRatingKeys.myBooks(profileId) }),
  ]).catch(() => undefined)
}
