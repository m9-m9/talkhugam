import { describe, expect, it, vi } from 'vitest'

import {
  getMobileBookChatCompletions,
  removeMobileBookChatCompletion,
  upsertMobileBookChatCompletion,
} from './mobileBookCompletion'

const bookChatId = '00000000-0000-4000-8000-000000000002'
const profileId = '00000000-0000-4000-8000-000000000003'

describe('getMobileBookChatCompletions', () => {
  it('scopes the roster to the active book chat and maps it with the current profile id', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })

    await expect(
      getMobileBookChatCompletions({ from } as never, bookChatId, profileId),
    ).resolves.toEqual([])

    expect(from).toHaveBeenCalledWith('book_chat_completions')
    expect(eq).toHaveBeenCalledWith('book_chat_id', bookChatId)
  })
})

describe('upsertMobileBookChatCompletion', () => {
  it('passes only validated completion values through the restricted server RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })

    await upsertMobileBookChatCompletion({ rpc } as never, {
      bookChatId,
      rating: 5,
      review: ' 끝까지 읽고 남은 생각이에요. ',
    })

    expect(rpc).toHaveBeenCalledWith('upsert_book_chat_completion', {
      p_book_chat_id: bookChatId,
      p_rating: 5,
      p_review: '끝까지 읽고 남은 생각이에요.',
    })
  })
})

describe('removeMobileBookChatCompletion', () => {
  it('calls only the current-user completion removal RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })

    await removeMobileBookChatCompletion({ rpc } as never, bookChatId)

    expect(rpc).toHaveBeenCalledWith('remove_book_chat_completion', { p_book_chat_id: bookChatId })
  })
})
