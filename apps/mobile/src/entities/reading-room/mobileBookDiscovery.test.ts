import { describe, expect, it, vi } from 'vitest'

import {
  createMobileBookChat,
  getMobileBookBestsellers,
  searchMobileBooks,
} from './mobileBookDiscovery'

const roomId = '00000000-0000-4000-8000-000000000001'
const bookChatId = '00000000-0000-4000-8000-000000000002'

const book = {
  authors: ['기시미 이치로'],
  externalUrl: 'https://example.com/book',
  isbn10: null,
  isbn13: '9781234567890',
  publishedAt: '2014-11-17',
  publisher: '인플루엔셜',
  source: 'kakao' as const,
  thumbnailUrl: 'https://example.com/cover.jpg',
  title: '미움받을 용기',
}

/** 호출 인수를 기록하는 인증된 Supabase 함수 클라이언트를 구성한다. */
function createFunctionClient(response: unknown) {
  const invoke = vi.fn().mockResolvedValue({ data: response, error: null })
  return { client: { functions: { invoke } }, invoke }
}

describe('mobileBookDiscovery', () => {
  it('uses the authenticated book-search Edge Function and returns only validated books', async () => {
    const { client, invoke } = createFunctionClient({
      data: { items: [book] },
      ok: true,
      requestId: 'request-1',
    })

    await expect(searchMobileBooks(client as never, '미움')).resolves.toEqual([book])
    expect(invoke).toHaveBeenCalledWith('book-search', { body: { query: '미움', size: 10 } })
  })

  it('uses the authenticated bestseller Edge Function and maps its response to selectable books', async () => {
    const { client, invoke } = createFunctionClient({
      data: {
        isConfigured: true,
        items: [
          {
            authors: ['기시미 이치로'],
            externalUrl: 'https://example.com/book',
            id: '9781234567890',
            isbn13: '9781234567890',
            publisher: '인플루엔셜',
            thumbnailUrl: 'https://example.com/cover.jpg',
            title: '미움받을 용기',
          },
        ],
      },
      ok: true,
      requestId: 'request-2',
    })

    await expect(getMobileBookBestsellers(client as never)).resolves.toEqual([
      { ...book, publishedAt: null, source: 'aladin' },
    ])
    expect(invoke).toHaveBeenCalledWith('book-bestsellers')
  })

  it('rejects a malformed book conversation id returned by the create RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ book_chat_id: 'not-a-uuid' }], error: null })

    await expect(createMobileBookChat({ rpc } as never, roomId, book)).rejects.toThrow()
    expect(rpc).toHaveBeenCalledWith('create_book_chat', expect.objectContaining({ p_room_id: roomId }))
  })

  it('rejects an invalid room id before calling the create RPC', async () => {
    const rpc = vi.fn()

    await expect(createMobileBookChat({ rpc } as never, 'not-a-uuid', book)).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns the validated new book conversation id', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ book_chat_id: bookChatId }], error: null })

    await expect(createMobileBookChat({ rpc } as never, roomId, book)).resolves.toBe(bookChatId)
  })
})
