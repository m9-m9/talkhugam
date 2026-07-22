import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createPost, createReply, parsePostForm, parsePosts } from './post'

const postId = 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e'
const mentionedMemberId = 'b3c8b282-6092-45f8-b15f-523a9dcd0eab'

/** RPC 응답을 반환하는 테스트용 Supabase 클라이언트를 생성한다. */
function createPostClient() {
  const client = createClient('https://example.supabase.co', 'test-publishable-key')
  const rpc = vi.spyOn(client, 'rpc').mockResolvedValue({
    count: null,
    data: postId,
    error: null,
    status: 200,
    statusText: 'OK',
    success: true,
  })
  return { client, rpc }
}

describe('post parser', () => {
  it('trims valid post content', () =>
    expect(parsePostForm({ body: ' 감상 ' })).toEqual({
      body: '감상',
      labels: [],
      mentionedMemberIds: [],
    }))
  it('accepts a page or chapter label without text', () =>
    expect(parsePostForm({ body: '', labels: [{ kind: 'page', value: '87쪽' }] })).toEqual({
      body: '',
      labels: [{ kind: 'page', value: '87쪽' }],
      mentionedMemberIds: [],
    }))
  it('preserves mentioned member identifiers and defaults them to an empty list', () =>
    expect(
      parsePostForm({
        body: '함께 읽어 봐요',
        mentionedMemberIds: [mentionedMemberId],
      }),
    ).toEqual({
      body: '함께 읽어 봐요',
      labels: [],
      mentionedMemberIds: [mentionedMemberId],
    }))
  it('rejects more than six mentioned members', () =>
    expect(() =>
      parsePostForm({
        body: '모두 함께 읽어요',
        mentionedMemberIds: Array.from(
          { length: 7 },
          (_, index) => `b3c8b282-6092-45f8-b15f-523a9dcd0ea${index}`,
        ),
      }),
    ).toThrow())
  it('sends mentioned members to the root post RPC', async () => {
    const { client, rpc } = createPostClient()

    await createPost(client, postId, {
      body: '함께 읽어 봐요',
      labels: [],
      mentionedMemberIds: [mentionedMemberId],
    })

    expect(rpc).toHaveBeenCalledWith(
      'create_post',
      expect.objectContaining({ p_mentioned_member_ids: [mentionedMemberId] }),
    )
  })
  it('sends mentioned members to the reply RPC', async () => {
    const { client, rpc } = createPostClient()

    await createReply(client, postId, {
      body: '답글에서도 불러요',
      labels: [],
      mentionedMemberIds: [mentionedMemberId],
    })

    expect(rpc).toHaveBeenCalledWith(
      'create_reply',
      expect.objectContaining({ p_mentioned_member_ids: [mentionedMemberId] }),
    )
  })
  it('maps Supabase rows to discussion-post domain models', () =>
    expect(
      parsePosts([
        {
          author_member_id: 'b3c8b282-6092-45f8-b15f-523a9dcd0eab',
          author_name_snapshot: '민규',
          body: '감상',
          created_at: '2026-07-17T02:01:30.123+00:00',
          depth: 0,
          id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
          post_labels: [
            { kind: 'chapter', sort_order: 1, value: '3장' },
            { kind: 'page', sort_order: 0, value: '87' },
          ],
          root_post_id: null,
        },
      ]),
    ).toEqual([
      {
        authorMemberId: 'b3c8b282-6092-45f8-b15f-523a9dcd0eab',
        authorName: '민규',
        body: '감상',
        createdAt: '2026-07-17T02:01:30.123+00:00',
        depth: 0,
        id: 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
        labels: [
          { kind: 'page', value: '87' },
          { kind: 'chapter', value: '3장' },
        ],
        rootPostId: null,
      },
    ]))
})
