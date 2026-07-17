import { useQuery, useQueryClient } from '@tanstack/react-query'
import MuxPlayer from '@mux/mux-player-react'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  createPost,
  createReply,
  getPosts,
  parsePostForm,
  postKeys,
  shouldSubmitMessage,
  type DiscussionPost,
  type PostForm,
} from '../../entities/post'
import {
  getVideoPlaybackAuthorization,
  getVideoPosts,
  videoKeys,
  type VideoPost,
} from '../../entities/video'
import { useVideoUpload } from '../../features/video-upload'
import { readingRoomKeys } from '../../entities/reading-room'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

type LabelKind = 'page' | 'chapter'

export function BookDiscussionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { bookChatId, roomId } = useParams()
  const [draft, setDraft] = useState('')
  const [labels, setLabels] = useState<PostForm['labels']>([])
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { errorMessage: videoErrorMessage, isUploadingVideo, uploadVideo } = useVideoUpload(bookChatId)
  const postsQuery = useQuery({
    enabled: Boolean(bookChatId),
    queryFn: () => getPosts(createSupabaseClient(), bookChatId ?? ''),
    queryKey: postKeys.byBookChat(bookChatId ?? ''),
  })
  const videosQuery = useQuery({
    enabled: Boolean(bookChatId),
    queryFn: () => getVideoPosts(createSupabaseClient(), bookChatId ?? ''),
    queryKey: videoKeys.byBookChat(bookChatId ?? ''),
    refetchInterval: (query) =>
      query.state.data?.some(
        (video) => video.status === 'waiting_upload' || video.status === 'processing',
      )
        ? 3_000
        : false,
  })

  async function handleSubmit() {
    const parsed = postInput(draft, labels)
    if (!parsed.ok || !bookChatId) {
      setErrorMessage('감상이나 라벨을 하나 이상 남겨 주세요.')
      return
    }
    if (replyTo && parsed.value.labels.length > 0) {
      setErrorMessage('답글에는 라벨을 붙일 수 없어요.')
      return
    }
    setErrorMessage(null)
    try {
      if (replyTo) await createReply(createSupabaseClient(), replyTo, parsed.value)
      else await createPost(createSupabaseClient(), bookChatId, parsed.value)
      setDraft('')
      setLabels([])
      setReplyTo(null)
      await queryClient.invalidateQueries({ queryKey: postKeys.byBookChat(bookChatId) })
      await queryClient.invalidateQueries({ queryKey: readingRoomKeys.all })
    } catch {
      setErrorMessage('감상을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  if (!roomId || !bookChatId) return <main className="bg-surface min-h-screen" />
  const roots = postsQuery.data?.filter((post) => post.depth === 0) ?? []
  return (
    <main className="app-page bg-surface flex min-h-screen flex-col px-4 pb-6">
      <AppHeader onBack={() => void navigate(`/rooms/${roomId}`)} title="책 대화" />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">책 대화</p>
        <h1 className="text-ink mt-2 text-xl font-bold">읽고 느낀 걸 나눠요</h1>
      </header>
      <section className="mt-8 flex-1">
        {postsQuery.isPending || videosQuery.isPending ? (
          <LoadingSpinner label="대화를 불러오고 있어요." size="sm" />
        ) : (
          <ChatTimeline
            allPosts={postsQuery.data ?? []}
            onReply={setReplyTo}
            posts={roots}
            videos={videosQuery.data ?? []}
          />
        )}
      </section>
      <ChatComposer
        errorMessage={errorMessage ?? videoErrorMessage}
        isReplying={Boolean(replyTo)}
        labels={labels}
        onCancelReply={() => setReplyTo(null)}
        onChangeDraft={setDraft}
        onChangeLabels={setLabels}
        onOpenVideoArchive={() => void navigate(`/rooms/${roomId}/books/${bookChatId}/videos`)}
        onSelectVideo={uploadVideo}
        onSubmit={() => void handleSubmit()}
        isUploadingVideo={isUploadingVideo}
        value={draft}
      />
    </main>
  )
}

function ChatComposer({
  errorMessage,
  isReplying,
  isUploadingVideo,
  labels,
  onCancelReply,
  onChangeDraft,
  onChangeLabels,
  onOpenVideoArchive,
  onSelectVideo,
  onSubmit,
  value,
}: {
  errorMessage: string | null
  isReplying: boolean
  isUploadingVideo: boolean
  labels: PostForm['labels']
  onCancelReply: () => void
  onChangeDraft: (value: string) => void
  onChangeLabels: (labels: PostForm['labels']) => void
  onOpenVideoArchive: () => void
  onSelectVideo: (file: File | undefined) => void
  onSubmit: () => void
  value: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isActionTrayOpen, setIsActionTrayOpen] = useState(false)
  const [labelKind, setLabelKind] = useState<LabelKind | null>(null)
  const [labelValue, setLabelValue] = useState('')

  function handleAddLabel() {
    if (!labelKind) return
    const nextLabel = createDraftLabel(labelKind, labelValue)
    if (!nextLabel) return
    onChangeLabels([...labels, nextLabel])
    setLabelKind(null)
    setLabelValue('')
  }

  function handleRemoveLabel(index: number) {
    onChangeLabels(labels.filter((_, labelIndex) => labelIndex !== index))
  }

  return (
    <section className="border-ink/10 mt-6 border-t pt-4">
      {isReplying ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-ink-subtle text-xs">답글 남기기</p>
          <button
            className="text-primary min-h-11 px-2 text-xs"
            onClick={onCancelReply}
            type="button"
          >
            취소
          </button>
        </div>
      ) : null}
      {labels.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="선택한 라벨">
          {labels.map((label, index) => (
            <li
              className="bg-primary/10 text-primary flex min-h-8 items-center gap-1 rounded-md px-2 text-xs"
              key={`${label.kind}-${label.value}`}
            >
              {formatLabel(label)}
              <button
                aria-label={`${formatLabel(label)} 삭제`}
                className="min-h-6 min-w-6"
                onClick={() => handleRemoveLabel(index)}
                type="button"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {isActionTrayOpen ? (
        <div className="border-ink/10 mb-3 rounded-lg border bg-white p-3">
          {labelKind ? (
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="post-label-value">
                {labelKind === 'page' ? '페이지 번호' : '챕터 이름 또는 번호'}
              </label>
              <input
                autoFocus
                className="border-ink/10 focus:border-primary min-h-11 min-w-0 flex-1 rounded-md border px-3 text-sm outline-none"
                id="post-label-value"
                onChange={(event) => setLabelValue(event.target.value)}
                placeholder={labelKind === 'page' ? '예: 87' : '예: 3장 또는 고독'}
                value={labelValue}
              />
              <button
                className="bg-primary min-h-11 rounded-md px-3 text-sm font-medium text-white"
                onClick={handleAddLabel}
                type="button"
              >
                추가
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                disabled={isReplying}
                label="페이지 라벨"
                onClick={() => setLabelKind('page')}
              />
              <ActionButton
                disabled={isReplying}
                label="챕터 라벨"
                onClick={() => setLabelKind('chapter')}
              />
              <ActionButton label="영상 올리기" onClick={() => fileInputRef.current?.click()} />
              <ActionButton label="영상 기록" onClick={onOpenVideoArchive} />
            </div>
          )}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <input
          accept="video/mp4,video/quicktime"
          className="sr-only"
          onChange={(event) => {
            onSelectVideo(event.target.files?.[0])
            event.target.value = ''
          }}
          ref={fileInputRef}
          type="file"
        />
        <button
          aria-expanded={isActionTrayOpen}
          aria-label="메시지 추가 메뉴"
          className="border-ink/20 text-ink flex min-h-11 min-w-11 items-center justify-center rounded-full border text-2xl leading-none"
          onClick={() => setIsActionTrayOpen((isOpen) => !isOpen)}
          type="button"
        >
          +
        </button>
        <label className="sr-only" htmlFor="discussion-message">
          메시지 입력
        </label>
        <textarea
          className="border-ink/10 focus:border-primary min-h-11 flex-1 resize-none rounded-md border bg-white px-3 py-2 text-sm outline-none"
          id="discussion-message"
          onChange={(event) => onChangeDraft(event.target.value)}
          onKeyDown={(event) => {
            if (!shouldSubmitMessage(event.key, event.shiftKey)) return
            event.preventDefault()
            onSubmit()
          }}
          placeholder={isReplying ? '답글을 입력하세요' : '메시지 입력'}
          rows={1}
          value={value}
        />
        <button
          className="bg-primary min-h-11 rounded-md px-3 text-sm font-semibold text-white disabled:opacity-40"
          disabled={value.trim().length === 0 && labels.length === 0}
          onClick={onSubmit}
          type="button"
        >
          전송
        </button>
      </div>
      {errorMessage ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isUploadingVideo ? (
        <p className="text-ink-subtle mt-2 text-xs">영상을 채팅에 올리고 있어요…</p>
      ) : null}
    </section>
  )
}

function ActionButton({
  disabled = false,
  label,
  onClick,
}: {
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className="border-ink/10 text-ink min-h-11 rounded-md border px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function ChatTimeline({
  allPosts,
  onReply,
  posts,
  videos,
}: {
  allPosts: DiscussionPost[]
  onReply: (id: string) => void
  posts: DiscussionPost[]
  videos: VideoPost[]
}) {
  const messages = createChatMessages(posts, videos)
  if (messages.length === 0)
    return (
      <div className="bg-surface-muted rounded-lg p-6 text-center">
        <p className="text-ink font-medium">첫 감상을 남겨 보세요</p>
        <p className="text-ink-subtle mt-2 text-sm">페이지나 챕터 라벨만 먼저 남겨도 괜찮아요.</p>
      </div>
    )
  return (
    <ul className="space-y-4">
      {messages.map((message) =>
        message.type === 'text' ? (
          <li className="flex" key={message.post.id}>
            <article className="border-ink/10 max-w-full rounded-lg border bg-white px-4 py-3">
              <p className="text-ink text-sm font-medium">{message.post.author_name_snapshot}</p>
              <PostLabels labels={message.post.labels} />
              {message.post.body ? (
                <p className="text-ink mt-2 text-sm whitespace-pre-wrap">{message.post.body}</p>
              ) : null}
              <button
                className="text-primary mt-2 min-h-11 text-xs"
                onClick={() => onReply(message.post.id)}
                type="button"
              >
                답글 남기기
              </button>
              <Replies posts={allPosts.filter((reply) => reply.root_post_id === message.post.id)} />
            </article>
          </li>
        ) : (
          <li className="flex" key={message.video.id}>
            <VideoMessage video={message.video} />
          </li>
        ),
      )}
    </ul>
  )
}

function VideoMessage({ video }: { video: VideoPost }) {
  const playbackQuery = useQuery({
    enabled: video.status === 'ready',
    queryFn: () => getVideoPlaybackAuthorization(createSupabaseClient(), video.id),
    queryKey: ['video-playback', video.id],
    staleTime: 4 * 60 * 1_000,
  })
  if (video.status === 'ready' && playbackQuery.data)
    return (
      <article className="border-ink/10 w-full max-w-full overflow-hidden rounded-lg border bg-white">
        <MuxPlayer
          className="aspect-video w-full"
          metadata={{ video_id: video.id, video_title: 'Talk후감 영상' }}
          playbackId={playbackQuery.data.playbackId}
          streamType="on-demand"
          thumbnailTime={0}
          tokens={{
            playback: playbackQuery.data.token,
            thumbnail: playbackQuery.data.thumbnailToken,
          }}
        />
        <p className="text-ink p-3 text-sm font-medium">{video.authorName}의 영상</p>
      </article>
    )
  return (
    <article className="border-ink/10 bg-ink flex aspect-video w-full max-w-full flex-col items-center justify-center rounded-lg border px-4 text-center">
      <p className="text-sm font-medium text-white">
        {getVideoMessageLabel(video, playbackQuery.isError)}
      </p>
      <p className="mt-2 text-xs text-white/70">채팅은 계속할 수 있어요.</p>
    </article>
  )
}

function PostLabels({ labels }: { labels: DiscussionPost['labels'] }) {
  if (labels.length === 0) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {labels.map((label) => (
        <li
          className="bg-primary/10 text-primary rounded-md px-2 py-1 text-xs"
          key={`${label.kind}-${label.value}`}
        >
          {formatLabel(label)}
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
          {post.body ? (
            <p className="text-ink-subtle mt-1 text-xs whitespace-pre-wrap">{post.body}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function createDraftLabel(kind: LabelKind, value: string): PostForm['labels'][number] | null {
  try {
    return parsePostForm({ body: '', labels: [{ kind, value }] }).labels[0] ?? null
  } catch {
    return null
  }
}

function formatLabel(label: PostForm['labels'][number]) {
  if (label.kind === 'page') return `페이지 ${label.value}`
  if (label.kind === 'chapter') return `챕터 ${label.value}`
  return label.value
}

function createChatMessages(posts: DiscussionPost[], videos: VideoPost[]) {
  const textMessages = posts.map((post) => ({
    createdAt: post.created_at,
    post,
    type: 'text' as const,
  }))
  const videoMessages = videos.map((video) => ({
    createdAt: video.createdAt,
    type: 'video' as const,
    video,
  }))
  return [...textMessages, ...videoMessages].sort((first, second) =>
    first.createdAt.localeCompare(second.createdAt),
  )
}

function getVideoMessageLabel(video: VideoPost, hasPlaybackError: boolean) {
  if (video.status === 'failed') return '영상 처리에 실패했어요.'
  if (hasPlaybackError) return '재생 정보를 불러오지 못했어요.'
  if (video.status === 'waiting_upload') return '영상을 올리고 있어요…'
  return '영상 준비 중…'
}

function postInput(body: string, labels: PostForm['labels']) {
  try {
    return { ok: true as const, value: parsePostForm({ body, labels }) }
  } catch {
    return { ok: false as const }
  }
}
