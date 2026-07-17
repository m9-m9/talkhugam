import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  createPost,
  createReply,
  getPosts,
  parsePostForm,
  postKeys,
  type DiscussionPost,
} from '../../entities/post'
import { createSupabaseClient } from '../../shared/api/supabaseClient'

export function BookDiscussionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { bookChatId, roomId } = useParams()
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const postsQuery = useQuery({
    enabled: Boolean(bookChatId),
    queryFn: () => getPosts(createSupabaseClient(), bookChatId ?? ''),
    queryKey: postKeys.byBookChat(bookChatId ?? ''),
  })

  async function handleSubmit() {
    const parsed = postInput(draft)
    if (!parsed.ok || !bookChatId) {
      setErrorMessage('감상을 한 글자 이상 입력해 주세요.')
      return
    }
    setErrorMessage(null)
    try {
      if (replyTo) await createReply(createSupabaseClient(), replyTo, parsed.value)
      else await createPost(createSupabaseClient(), bookChatId, parsed.value)
      setDraft('')
      setReplyTo(null)
      await queryClient.invalidateQueries({ queryKey: postKeys.byBookChat(bookChatId) })
    } catch {
      setErrorMessage('감상을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  if (!roomId || !bookChatId) return <main className="bg-surface min-h-screen" />
  const roots = postsQuery.data?.filter((post) => post.depth === 0) ?? []
  return (
    <main className="bg-surface mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <button
        className="text-ink-subtle -ml-3 min-h-11 px-3 text-sm"
        onClick={() => void navigate(`/rooms/${roomId}`)}
        type="button"
      >
        ← 독서방
      </button>
      <header className="mt-3">
        <p className="text-primary text-sm font-medium">책 대화</p>
        <h1 className="text-ink mt-2 text-xl font-bold">읽고 느낀 걸 나눠요</h1>
      </header>
      <section className="mt-8 flex-1">
        {postsQuery.isPending ? (
          <p className="text-ink-subtle text-sm">감상을 불러오고 있어요.</p>
        ) : (
          <PostList posts={roots} allPosts={postsQuery.data ?? []} onReply={setReplyTo} />
        )}
      </section>
      <section className="border-ink/10 mt-6 border-t pt-4">
        <p className="text-ink-subtle text-xs">{replyTo ? '답글 남기기' : '느낀 점 남기기'}</p>
        <textarea
          className="border-ink/10 focus:border-primary mt-2 min-h-16 w-full resize-none rounded-md border bg-white p-3 text-sm outline-none"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="읽고 느낀 걸 남겨보세요..."
          value={draft}
        />
        {errorMessage ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <button
          className="bg-primary mt-3 min-h-11 w-full rounded-md text-sm font-semibold text-white"
          onClick={() => void handleSubmit()}
          type="button"
        >
          {replyTo ? '답글 남기기' : '감상 남기기'}
        </button>
      </section>
    </main>
  )
}

function PostList({
  allPosts,
  onReply,
  posts,
}: {
  allPosts: DiscussionPost[]
  onReply: (id: string) => void
  posts: DiscussionPost[]
}) {
  if (posts.length === 0)
    return (
      <div className="bg-surface-muted rounded-lg p-6 text-center">
        <p className="text-ink font-medium">첫 감상을 남겨 보세요</p>
        <p className="text-ink-subtle mt-2 text-sm">한 문장이어도 충분해요.</p>
      </div>
    )
  return (
    <ul className="space-y-4">
      {posts.map((post) => (
        <li className="border-ink/10 rounded-lg border bg-white p-4" key={post.id}>
          <p className="text-ink text-sm font-medium">{post.author_name_snapshot}</p>
          <p className="text-ink mt-2 text-sm whitespace-pre-wrap">{post.body}</p>
          <button
            className="text-primary mt-3 min-h-11 text-xs"
            onClick={() => onReply(post.id)}
            type="button"
          >
            답글 남기기
          </button>
          <Replies posts={allPosts.filter((reply) => reply.root_post_id === post.id)} />
        </li>
      ))}
    </ul>
  )
}
function Replies({ posts }: { posts: DiscussionPost[] }) {
  if (posts.length === 0) return null
  return (
    <ul className="border-ink/10 mt-3 space-y-3 border-l pl-3">
      {posts.map((post) => (
        <li key={post.id}>
          <p className="text-ink text-xs font-medium">{post.author_name_snapshot}</p>
          <p className="text-ink-subtle mt-1 text-xs whitespace-pre-wrap">{post.body}</p>
        </li>
      ))}
    </ul>
  )
}
function postInput(value: string) {
  try {
    return { ok: true as const, value: parsePostForm({ body: value }) }
  } catch {
    return { ok: false as const }
  }
}
