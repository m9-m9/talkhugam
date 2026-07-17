import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import MuxPlayer from '@mux/mux-player-react'

import {
  createPost,
  createReply,
  getPosts,
  parsePostForm,
  postKeys,
  type DiscussionPost,
} from '../../entities/post'
import {
  getVideoPlaybackAuthorization,
  getVideoPosts,
  deleteVideoPost,
  getUploadedVideoPostId,
  shouldRefreshVideoPosts,
  videoKeys,
  type VideoPost,
} from '../../entities/video'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

export function BookDiscussionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { bookChatId, roomId } = useParams()
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const uploadedVideoPostId = getUploadedVideoPostId(location.state)
  const postsQuery = useQuery({
    enabled: Boolean(bookChatId),
    queryFn: () => getPosts(createSupabaseClient(), bookChatId ?? ''),
    queryKey: postKeys.byBookChat(bookChatId ?? ''),
  })
  const videoPostsQuery = useQuery({
    enabled: Boolean(bookChatId),
    queryFn: () => getVideoPosts(createSupabaseClient(), bookChatId ?? ''),
    queryKey: videoKeys.byBookChat(bookChatId ?? ''),
    refetchInterval: (query) =>
      shouldRefreshVideoPosts(query.state.data, uploadedVideoPostId) ? 3_000 : false,
  })
  const deleteVideoMutation = useMutation({
    mutationFn: (postId: string) => deleteVideoPost(createSupabaseClient(), postId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: videoKeys.byBookChat(bookChatId ?? '') })
    },
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

  async function handleDeleteVideo(postId: string) {
    if (!window.confirm('이 영상을 삭제할까요? 삭제 후 복구할 수 없어요.')) return
    try {
      await deleteVideoMutation.mutateAsync(postId)
    } catch {
      setErrorMessage('영상을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  if (!roomId || !bookChatId) return <main className="bg-surface min-h-screen" />
  const roots = postsQuery.data?.filter((post) => post.depth === 0) ?? []
  const isWaitingForUploadedVideo = shouldRefreshVideoPosts(
    videoPostsQuery.data,
    uploadedVideoPostId,
  )
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
        <div className="flex items-center justify-between">
          <h1 className="text-ink mt-2 text-xl font-bold">읽고 느낀 걸 나눠요</h1>
          <button
            className="text-primary min-h-11 px-3 text-sm font-medium"
            onClick={() => void navigate(`/rooms/${roomId}/books/${bookChatId}/video`)}
            type="button"
          >
            영상 남기기
          </button>
        </div>
      </header>
      <section className="mt-8 flex-1">
        {postsQuery.isPending ? (
          <LoadingSpinner label="감상을 불러오고 있어요." size="sm" />
        ) : (
          <PostList posts={roots} allPosts={postsQuery.data ?? []} onReply={setReplyTo} />
        )}
      </section>
      <section className="mt-8">
        <h2 className="text-ink text-base font-bold">영상 기록</h2>
        {videoPostsQuery.isPending ? (
          <div className="mt-4">
            <LoadingSpinner label="영상을 불러오고 있어요." size="sm" />
          </div>
        ) : (
          <VideoFeed
            isDeleting={deleteVideoMutation.isPending}
            isWaitingForUploadedVideo={isWaitingForUploadedVideo}
            onDelete={(postId) => void handleDeleteVideo(postId)}
            posts={videoPostsQuery.data ?? []}
          />
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

function VideoFeed({
  isDeleting,
  isWaitingForUploadedVideo,
  onDelete,
  posts,
}: {
  isDeleting: boolean
  isWaitingForUploadedVideo: boolean
  onDelete: (postId: string) => void
  posts: VideoPost[]
}) {
  if (posts.length === 0 && !isWaitingForUploadedVideo)
    return <p className="text-ink-subtle mt-4 text-sm">아직 남겨진 영상이 없어요.</p>
  return (
    <ul className="mt-4 space-y-4">
      {isWaitingForUploadedVideo ? (
        <li className="border-ink/10 overflow-hidden rounded-lg border bg-white">
          <VideoPlaceholder message="업로드한 영상을 독서방에 추가하고 있어요…" />
        </li>
      ) : null}
      {posts.map((post) => (
        <li className="border-ink/10 overflow-hidden rounded-lg border bg-white" key={post.id}>
          <VideoPostCard isDeleting={isDeleting} onDelete={onDelete} post={post} />
        </li>
      ))}
    </ul>
  )
}

function VideoPostCard({
  isDeleting,
  onDelete,
  post,
}: {
  isDeleting: boolean
  onDelete: (postId: string) => void
  post: VideoPost
}) {
  const playbackQuery = useQuery({
    enabled: post.status === 'ready',
    queryFn: () => getVideoPlaybackAuthorization(createSupabaseClient(), post.id),
    queryKey: ['video-playback', post.id],
    staleTime: 4 * 60 * 1_000,
  })

  if (post.status === 'ready')
    return (
      <>
        {playbackQuery.data ? (
          <MuxPlayer
            className="aspect-video w-full"
            metadata={{ video_id: post.id, video_title: 'Talk후감 영상' }}
            playbackId={playbackQuery.data.playbackId}
            streamType="on-demand"
            thumbnailTime={0}
            tokens={{
              playback: playbackQuery.data.token,
              thumbnail: playbackQuery.data.thumbnailToken,
            }}
          />
        ) : playbackQuery.isError ? (
          <VideoPlaceholder message="재생 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." />
        ) : (
          <VideoPlaceholder message="재생 화면을 준비하고 있어요…" />
        )}
        <VideoMeta isDeleting={isDeleting} onDelete={onDelete} post={post} />
      </>
    )
  if (post.status === 'failed')
    return (
      <>
        <VideoPlaceholder message="영상 처리에 실패했어요." />
        <VideoMeta isDeleting={isDeleting} onDelete={onDelete} post={post} />
      </>
    )
  return (
    <>
      <VideoPlaceholder message="영상 준비 중 · 대화는 계속할 수 있어요" />
      <VideoMeta isDeleting={isDeleting} onDelete={onDelete} post={post} />
    </>
  )
}

function VideoPlaceholder({ message }: { message: string }) {
  return (
    <div className="bg-ink flex aspect-video items-center justify-center px-6 text-center">
      <LoadingSpinner label={message} size="sm" tone="inverse" />
    </div>
  )
}

function VideoMeta({
  isDeleting,
  onDelete,
  post,
}: {
  isDeleting: boolean
  onDelete: (postId: string) => void
  post: VideoPost
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div>
        <p className="text-ink text-sm font-medium">{post.authorName}</p>
        {post.body ? <p className="text-ink-subtle mt-2 text-sm">{post.body}</p> : null}
      </div>
      <button
        className="text-ink-subtle min-h-11 px-2 text-xs"
        disabled={isDeleting}
        onClick={() => onDelete(post.id)}
        type="button"
      >
        삭제
      </button>
    </div>
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
