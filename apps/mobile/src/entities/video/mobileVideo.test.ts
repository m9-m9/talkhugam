import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { getMobileVideoPosts } from './mobileVideo'

const roomId = '00000000-0000-4000-8000-000000000001'
const bookChatId = '00000000-0000-4000-8000-000000000002'

describe('mobile video repository', () => {
  it('reads only non-deleted video posts from the requested room and book chat', async () => {
    const client = createClient('https://example.supabase.co', 'test-publishable-key')
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const eqRoom = vi.fn().mockReturnValue({ order })
    const isDeleted = vi.fn().mockReturnValue({ eq: eqRoom })
    const eqType = vi.fn().mockReturnValue({ is: isDeleted })
    const eqBookChat = vi.fn().mockReturnValue({ eq: eqType })
    const select = vi.fn().mockReturnValue({ eq: eqBookChat })
    vi.spyOn(client, 'from').mockReturnValue({ select } as never)

    await getMobileVideoPosts(client, roomId, bookChatId)

    expect(eqBookChat).toHaveBeenCalledWith('book_chat_id', bookChatId)
    expect(eqType).toHaveBeenCalledWith('type', 'video')
    expect(isDeleted).toHaveBeenCalledWith('deleted_at', null)
    expect(eqRoom).toHaveBeenCalledWith('book_chats.room_id', roomId)
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})
