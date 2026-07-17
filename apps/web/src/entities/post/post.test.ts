import { describe, expect, it } from 'vitest'
import { parsePostForm, parsePosts } from './post'
describe('post parser', () => {
  it('trims valid post content', () =>
    expect(parsePostForm({ body: ' 감상 ' })).toEqual({ body: '감상', labels: [] }))
  it('accepts a page or chapter label without text', () =>
    expect(parsePostForm({ body: '', labels: [{ kind: 'page', value: '87쪽' }] })).toEqual({
      body: '',
      labels: [{ kind: 'page', value: '87쪽' }],
    }))
  it('parses Phase 1 root and reply posts', () =>
    expect(
      parsePosts([
        {
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
      ])[0]?.labels,
    ).toEqual([
      { kind: 'page', value: '87' },
      { kind: 'chapter', value: '3장' },
    ]))
})
