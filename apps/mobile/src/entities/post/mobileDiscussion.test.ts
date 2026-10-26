import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  createMobileDiscussionPost,
  createMobileDiscussionReply,
  getMobileDiscussionMembers,
  getMobileDiscussionPosts,
} from './mobileDiscussion'

const bookChatId = '00000000-0000-4000-8000-000000000001'
const roomId = '00000000-0000-4000-8000-000000000010'
const rootPostId = '00000000-0000-4000-8000-000000000002'
const memberId = '00000000-0000-4000-8000-000000000003'
const clientId = '00000000-0000-4000-8000-000000000004'

/** RPC 결과를 검증하는 테스트용 Supabase 클라이언트를 생성한다. */
function createDiscussionClient() {
  const client = createClient('https://example.supabase.co', 'test-publishable-key')
  const rpc = vi.spyOn(client, 'rpc').mockResolvedValue({
    count: null,
    data: rootPostId,
    error: null,
    status: 200,
    statusText: 'OK',
    success: true,
  })
  return { client, rpc }
}

describe('mobile discussion repository', () => {
  it('reads only visible text posts in chronological order', async () => {
    const client = createClient('https://example.supabase.co', 'test-publishable-key')
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const eqRoom = vi.fn().mockReturnValue({ order })
    const isDeleted = vi.fn().mockReturnValue({ eq: eqRoom })
    const eqType = vi.fn().mockReturnValue({ is: isDeleted })
    const eqBookChat = vi.fn().mockReturnValue({ eq: eqType })
    const select = vi.fn().mockReturnValue({ eq: eqBookChat })
    vi.spyOn(client, 'from').mockReturnValue({ select } as never)

    await getMobileDiscussionPosts(client, roomId, bookChatId)

    expect(eqBookChat).toHaveBeenCalledWith('book_chat_id', bookChatId)
    expect(eqType).toHaveBeenCalledWith('type', 'text')
    expect(isDeleted).toHaveBeenCalledWith('deleted_at', null)
    expect(eqRoom).toHaveBeenCalledWith('book_chats.room_id', roomId)
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('keeps one submission client id when creating a root text post', async () => {
    const { client, rpc } = createDiscussionClient()

    await createMobileDiscussionPost(client, bookChatId, clientId, {
      body: '같이 이야기해요',
      labels: [{ kind: 'custom', value: '87쪽' }],
      mentionedMemberIds: [memberId],
    })

    expect(rpc).toHaveBeenCalledWith('create_post', {
      p_body: '같이 이야기해요',
      p_book_chat_id: bookChatId,
      p_client_id: clientId,
      p_labels: [{ kind: 'custom', value: '87쪽' }],
      p_mentioned_member_ids: [memberId],
      p_type: 'text',
    })
  })

  it('sends a reply through the one-level reply RPC with the stable client id', async () => {
    const { client, rpc } = createDiscussionClient()

    await createMobileDiscussionReply(client, rootPostId, clientId, {
      body: '저도 같은 생각이에요',
      labels: [],
      mentionedMemberIds: [memberId],
    })

    expect(rpc).toHaveBeenCalledWith('create_reply', {
      p_body: '저도 같은 생각이에요',
      p_client_id: clientId,
      p_mentioned_member_ids: [memberId],
      p_root_post_id: rootPostId,
    })
  })

  it('uses an opaque whitespace-safe token for members with the same display name', async () => {
    const client = createClient('https://example.supabase.co', 'test-publishable-key')
    const order = vi.fn().mockResolvedValue({
      data: [
        { id: memberId, room_display_name: '민지' },
        { id: '00000000-0000-4000-8000-000000000005', room_display_name: '민지' },
      ],
      error: null,
    })
    const eqStatus = vi.fn().mockReturnValue({ order })
    const eqRoom = vi.fn().mockReturnValue({ eq: eqStatus })
    const select = vi.fn().mockReturnValue({ eq: eqRoom })
    vi.spyOn(client, 'from').mockReturnValue({ select } as never)

    await expect(getMobileDiscussionMembers(client, bookChatId)).resolves.toEqual([
      { displayName: '민지', id: memberId, mentionToken: `member-${memberId}` },
      {
        displayName: '민지',
        id: '00000000-0000-4000-8000-000000000005',
        mentionToken: 'member-00000000-0000-4000-8000-000000000005',
      },
    ])
  })
})
