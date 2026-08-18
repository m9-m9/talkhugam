import { describe, expect, it, vi } from 'vitest'

import {
  getMobileBookChats,
  getMobileDiscussionBookChat,
  getMobileReadingRoomDetail,
} from './mobileRoomDetail'

const roomId = '00000000-0000-4000-8000-000000000001'
const bookChatId = '00000000-0000-4000-8000-000000000002'

describe('getMobileReadingRoomDetail', () => {
  it('returns null when the RLS-filtered room query has no member-visible row', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })

    await expect(getMobileReadingRoomDetail({ from } as never, roomId)).resolves.toBeNull()
  })

  it('propagates a protected room query error instead of presenting it as an unavailable room', async () => {
    const queryError = new Error('network unavailable')
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: queryError })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })

    await expect(getMobileReadingRoomDetail({ from } as never, roomId)).rejects.toBe(queryError)
  })
})

describe('getMobileBookChats', () => {
  it('reads only active book chats from the selected member-visible room', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const status = vi.fn().mockReturnValue({ order })
    const room = vi.fn().mockReturnValue({ eq: status })
    const select = vi.fn().mockReturnValue({ eq: room })
    const from = vi.fn().mockReturnValue({ select })

    await getMobileBookChats({ from } as never, roomId)

    expect(from).toHaveBeenCalledWith('book_chats')
    expect(room).toHaveBeenCalledWith('room_id', roomId)
    expect(status).toHaveBeenCalledWith('status', 'reading')
  })
})

describe('getMobileDiscussionBookChat', () => {
  it('scopes a book conversation to the route room before rendering its discussion', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eqRoom = vi.fn().mockReturnValue({ maybeSingle })
    const eqBookChat = vi.fn().mockReturnValue({ eq: eqRoom })
    const select = vi.fn().mockReturnValue({ eq: eqBookChat })
    const from = vi.fn().mockReturnValue({ select })

    await expect(
      getMobileDiscussionBookChat({ from } as never, roomId, bookChatId),
    ).resolves.toBeNull()

    expect(from).toHaveBeenCalledWith('book_chats')
    expect(eqBookChat).toHaveBeenCalledWith('id', bookChatId)
    expect(eqRoom).toHaveBeenCalledWith('room_id', roomId)
  })
})
