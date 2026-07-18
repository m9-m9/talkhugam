import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type RefObject } from 'react'
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
  bookCompletionKeys,
  getBookChatCompletions,
  removeBookChatCompletion,
  upsertBookChatCompletion,
  type BookChatCompletion,
  type BookCompletionInput,
} from '../../entities/book-completion'
import {
  createMuxThumbnailUrl,
  getVideoFilterMembers,
  getVideoPosts,
  getVideoThumbnailAuthorizations,
  mapVideoThumbnailAuthorizations,
  videoKeys,
  type VideoFilterMember,
  type VideoPost,
  type VideoThumbnailAuthorization,
} from '../../entities/video'
import { useVideoUpload } from '../../features/video-upload'
import { useAuthenticatedUser } from '../../features/auth'
import { readingRoomKeys } from '../../entities/reading-room'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

type LabelKind = 'page' | 'chapter'

/** 책 Discussion 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function BookDiscussionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { bookChatId, roomId } = useParams()
  const profileId = useAuthenticatedUser().id
  const [draft, setDraft] = useState('')
  const [labels, setLabels] = useState<PostForm['labels']>([])
  const [mentionedMemberIds, setMentionedMemberIds] = useState<PostForm['mentionedMemberIds']>([])
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRetryingTimeline, setIsRetryingTimeline] = useState(false)
  const [timelineRetryMessage, setTimelineRetryMessage] = useState<string | null>(null)
  const {
    errorMessage: videoErrorMessage,
    isUploadingVideo,
    uploadVideo,
  } = useVideoUpload(bookChatId)
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
  const membersQuery = useQuery({
    enabled: Boolean(roomId),
    queryFn: () => getVideoFilterMembers(createSupabaseClient(), roomId ?? ''),
    queryKey: videoKeys.members(roomId ?? ''),
  })
  const readyVideoPostIds = (videosQuery.data ?? [])
    .filter((video) => video.status === 'ready')
    .map((video) => video.id)
  const thumbnailsQuery = useQuery({
    enabled: readyVideoPostIds.length > 0,
    queryFn: () => getVideoThumbnailAuthorizations(createSupabaseClient(), readyVideoPostIds),
    queryKey: videoKeys.thumbnails(readyVideoPostIds),
    staleTime: 4 * 60 * 1_000,
  })
  const thumbnailsByPostId = mapVideoThumbnailAuthorizations(thumbnailsQuery.data ?? [])
  const completionsQuery = useQuery({
    enabled: Boolean(bookChatId),
    queryFn: () => getBookChatCompletions(createSupabaseClient(), bookChatId ?? '', profileId),
    queryKey: bookCompletionKeys.byChat(bookChatId ?? ''),
  })
  const completionMutation = useMutation({
    mutationFn: (input: BookCompletionInput) =>
      upsertBookChatCompletion(createSupabaseClient(), input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookCompletionKeys.byChat(bookChatId ?? '') }),
        queryClient.invalidateQueries({ queryKey: bookCompletionKeys.myBooks(profileId) }),
      ])
    },
  })
  const completionRemovalMutation = useMutation({
    mutationFn: (targetBookChatId: string) =>
      removeBookChatCompletion(createSupabaseClient(), targetBookChatId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookCompletionKeys.byChat(bookChatId ?? '') }),
        queryClient.invalidateQueries({ queryKey: bookCompletionKeys.myBooks(profileId) }),
      ])
    },
  })

  /** 제출 요청이나 사용자 동작을 처리한다. */
  async function handleSubmit() {
    const parsed = postInput(draft, labels, mentionedMemberIds)
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
      setMentionedMemberIds([])
      setReplyTo(null)
      await queryClient.invalidateQueries({ queryKey: postKeys.byBookChat(bookChatId) })
      await queryClient.invalidateQueries({ queryKey: readingRoomKeys.all })
    } catch {
      setErrorMessage('감상을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  /** 실패한 감상과 영상 조회를 함께 다시 요청한다. */
  function handleRetryTimeline() {
    setTimelineRetryMessage(
      getDiscussionTimelineErrorMessage(postsQuery.isError, videosQuery.isError),
    )
    setIsRetryingTimeline(true)
    void Promise.all([postsQuery.refetch(), videosQuery.refetch()]).finally(() => {
      setIsRetryingTimeline(false)
      setTimelineRetryMessage(null)
    })
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
      <CompletionSection
        bookChatId={bookChatId}
        completions={completionsQuery.data ?? []}
        errorMessage={
          completionMutation.isError || completionRemovalMutation.isError
            ? '완독 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
            : null
        }
        isLoading={completionsQuery.isPending}
        isSaving={completionMutation.isPending || completionRemovalMutation.isPending}
        onRemove={() => completionRemovalMutation.mutate(bookChatId)}
        onSave={(input) => completionMutation.mutate(input)}
      />
      <section className="mt-8 flex-1">
        {postsQuery.isPending && videosQuery.isPending ? (
          <LoadingSpinner label="대화를 불러오고 있어요." size="sm" />
        ) : (
          <DiscussionTimeline
            allPosts={postsQuery.data ?? []}
            hasPostError={postsQuery.isError}
            hasPendingQuery={postsQuery.isPending || videosQuery.isPending}
            hasVideoError={videosQuery.isError}
            isRetrying={isRetryingTimeline}
            onReply={setReplyTo}
            posts={roots}
            onRetry={handleRetryTimeline}
            retryMessage={timelineRetryMessage}
            videos={videosQuery.data ?? []}
            isThumbnailLoading={thumbnailsQuery.isLoading}
            onOpenVideo={(videoId) =>
              void navigate(`/rooms/${roomId}/books/${bookChatId}/videos/${videoId}`)
            }
            thumbnailsByPostId={thumbnailsByPostId}
          />
        )}
      </section>
      <ChatComposer
        errorMessage={errorMessage ?? videoErrorMessage}
        isReplying={Boolean(replyTo)}
        key={bookChatId}
        labels={labels}
        mentionCandidates={(membersQuery.data ?? []).filter((member) => !member.isCurrentUser)}
        onCancelReply={() => setReplyTo(null)}
        onChangeDraft={setDraft}
        onChangeLabels={setLabels}
        onChangeMentionedMemberIds={setMentionedMemberIds}
        onOpenVideoArchive={() => void navigate(`/rooms/${roomId}/books/${bookChatId}/videos`)}
        onRetryMentionMembers={() => void membersQuery.refetch()}
        onSelectVideo={uploadVideo}
        onSubmit={() => void handleSubmit()}
        hasMentionMemberError={membersQuery.isError}
        isUploadingVideo={isUploadingVideo}
        value={draft}
      />
    </main>
  )
}

/** 감상과 영상 조회 상태에 따라 대화 또는 재시도 안내를 렌더링한다. */
function DiscussionTimeline({
  allPosts,
  hasPostError,
  hasPendingQuery,
  hasVideoError,
  isRetrying,
  isThumbnailLoading,
  onOpenVideo,
  onReply,
  onRetry,
  posts,
  retryMessage,
  thumbnailsByPostId,
  videos,
}: {
  allPosts: DiscussionPost[]
  hasPostError: boolean
  hasPendingQuery: boolean
  hasVideoError: boolean
  isRetrying: boolean
  isThumbnailLoading: boolean
  onOpenVideo: (videoId: string) => void
  onReply: (id: string) => void
  onRetry: () => void
  posts: DiscussionPost[]
  retryMessage: string | null
  thumbnailsByPostId: ReadonlyMap<string, VideoThumbnailAuthorization>
  videos: VideoPost[]
}) {
  const errorMessage =
    getDiscussionTimelineErrorMessage(hasPostError, hasVideoError) ?? retryMessage
  const isShowingLoadingFeedback = hasPendingQuery || isRetrying
  const loadingLabel = isRetrying ? '대화를 다시 불러오고 있어요.' : '대화를 불러오고 있어요.'

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <RetryState isRetrying={isRetrying} message={errorMessage} onRetry={onRetry} />
      ) : null}
      <ChatTimeline
        allPosts={allPosts}
        onReply={onReply}
        isThumbnailLoading={isThumbnailLoading}
        onOpenVideo={onOpenVideo}
        posts={posts}
        showEmptyState={!errorMessage && !hasPendingQuery}
        videos={videos}
        thumbnailsByPostId={thumbnailsByPostId}
      />
      {isShowingLoadingFeedback ? <LoadingSpinner label={loadingLabel} size="xs" /> : null}
    </div>
  )
}

/** 실패한 대화 조회 종류에 맞는 재시도 안내 문구를 반환한다. */
function getDiscussionTimelineErrorMessage(
  hasPostError: boolean,
  hasVideoError: boolean,
): string | null {
  if (hasPostError && hasVideoError) return '대화를 불러오지 못했어요. 다시 시도해 주세요.'
  if (hasPostError) return '감상을 불러오지 못했어요. 다시 시도해 주세요.'
  if (hasVideoError) return '영상을 불러오지 못했어요. 다시 시도해 주세요.'
  return null
}

/** 개인 완독 기록과 모임 멤버의 총평 현황을 렌더링한다. */
function CompletionSection({
  bookChatId,
  completions,
  errorMessage,
  isLoading,
  isSaving,
  onRemove,
  onSave,
}: {
  bookChatId: string
  completions: BookChatCompletion[]
  errorMessage: string | null
  isLoading: boolean
  isSaving: boolean
  onRemove: () => void
  onSave: (input: BookCompletionInput) => void
}) {
  const ownCompletion = completions.find((completion) => completion.isMe)

  /** 빈 완독 기록 저장 요청이나 사용자 동작을 처리한다. */
  function handleMarkCompleted() {
    onSave({ bookChatId, rating: null, review: null })
  }

  if (isLoading)
    return (
      <section className="mt-8" aria-label="완독 현황">
        <LoadingSpinner label="완독 현황을 불러오고 있어요." size="xs" />
      </section>
    )

  return (
    <section
      className="border-ink/10 mt-8 rounded-lg border bg-white p-4"
      aria-labelledby="completion-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-ink text-base font-bold" id="completion-heading">
            함께 읽은 기록
          </h2>
          <p className="text-ink-subtle mt-1 text-xs">{completions.length}명 완독</p>
        </div>
        {ownCompletion ? (
          <button
            className="border-primary text-primary min-h-11 cursor-pointer rounded-md border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isSaving}
            onClick={onRemove}
            type="button"
          >
            완독 취소
          </button>
        ) : (
          <button
            className="bg-primary min-h-11 cursor-pointer rounded-md px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isSaving}
            onClick={handleMarkCompleted}
            type="button"
          >
            완독 기록하기
          </button>
        )}
      </div>

      {ownCompletion ? (
        <CompletionReviewForm
          bookChatId={bookChatId}
          completion={ownCompletion}
          isSaving={isSaving}
          key={ownCompletion.completedAt}
          onSave={onSave}
        />
      ) : null}

      {errorMessage ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {completions.length === 0 ? (
        <p className="text-ink-subtle mt-4 text-sm">아직 완독한 멤버가 없어요.</p>
      ) : (
        <ul className="mt-4 space-y-3" aria-label="완독한 멤버">
          {completions.map((completion) => (
            <li
              className="border-ink/10 border-t pt-3 first:border-t-0 first:pt-0"
              key={completion.profileId}
            >
              <p className="text-ink text-sm font-semibold">
                {completion.displayName}
                {completion.isMe ? ' (나)' : ''}
              </p>
              {completion.rating ? (
                <p className="text-primary mt-1 text-sm" aria-label={`${completion.rating}점`}>
                  {'★'.repeat(completion.rating)}
                </p>
              ) : null}
              <p className="text-ink-subtle mt-1 text-sm">{completion.review || '총평 작성 전'}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 완독한 사용자가 별점과 총평을 작성하는 입력 폼을 렌더링한다. */
function CompletionReviewForm({
  bookChatId,
  completion,
  isSaving,
  onSave,
}: {
  bookChatId: string
  completion: BookChatCompletion
  isSaving: boolean
  onSave: (input: BookCompletionInput) => void
}) {
  const [rating, setRating] = useState<number | null>(completion.rating)
  const [review, setReview] = useState(completion.review ?? '')

  /** 총평 저장 요청이나 사용자 동작을 처리한다. */
  function handleSaveReview() {
    onSave({
      bookChatId,
      rating,
      review: review || null,
    })
  }

  return (
    <div className="border-ink/10 mt-4 border-t pt-4">
      <fieldset>
        <legend className="text-ink text-sm font-medium">별점 (선택)</legend>
        <div className="mt-2 flex gap-2" role="group" aria-label="별점 선택">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              aria-label={`${value}점`}
              aria-pressed={rating === value}
              className={`min-h-11 min-w-11 cursor-pointer rounded-md text-lg font-bold ${
                rating !== null && value <= rating
                  ? 'bg-primary/10 text-primary'
                  : 'border-ink/10 text-ink-subtle border'
              }`}
              key={value}
              onClick={() => setRating(value)}
              type="button"
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <label className="text-ink mt-4 block text-sm font-medium" htmlFor="completion-review">
        총평 (선택)
      </label>
      <textarea
        className="border-ink/10 focus:border-primary mt-2 min-h-24 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none"
        id="completion-review"
        maxLength={1000}
        onChange={(event) => setReview(event.target.value)}
        placeholder="이 책을 읽고 남은 생각을 적어 보세요."
        value={review}
      />
      <button
        className="bg-ink mt-3 min-h-11 w-full cursor-pointer rounded-md px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        disabled={isSaving}
        onClick={handleSaveReview}
        type="button"
      >
        총평 저장
      </button>
    </div>
  )
}

/** 대화 입력창 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function ChatComposer({
  errorMessage,
  hasMentionMemberError,
  isReplying,
  isUploadingVideo,
  labels,
  mentionCandidates,
  onCancelReply,
  onChangeDraft,
  onChangeLabels,
  onChangeMentionedMemberIds,
  onOpenVideoArchive,
  onRetryMentionMembers,
  onSelectVideo,
  onSubmit,
  value,
}: {
  errorMessage: string | null
  hasMentionMemberError: boolean
  isReplying: boolean
  isUploadingVideo: boolean
  labels: PostForm['labels']
  mentionCandidates: VideoFilterMember[]
  onCancelReply: () => void
  onChangeDraft: (value: string) => void
  onChangeLabels: (labels: PostForm['labels']) => void
  onChangeMentionedMemberIds: (mentionedMemberIds: PostForm['mentionedMemberIds']) => void
  onOpenVideoArchive: () => void
  onRetryMentionMembers: () => void
  onSelectVideo: (file: File | undefined) => void
  onSubmit: () => void
  value: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const actionMenuRef = useRef<HTMLDivElement>(null)
  const actionMenuButtonRef = useRef<HTMLButtonElement>(null)
  const firstActionButtonRef = useRef<HTMLButtonElement>(null)
  const mentionMenuRef = useRef<HTMLDivElement>(null)
  const [isActionTrayOpen, setIsActionTrayOpen] = useState(false)
  const [labelKind, setLabelKind] = useState<LabelKind | null>(null)
  const [isMentionMenuDismissed, setIsMentionMenuDismissed] = useState(false)
  const [labelDrafts, setLabelDrafts] = useState<Record<LabelKind, string>>({
    chapter: '',
    page: '',
  })
  const mentionQuery = getActiveMentionQuery(value)
  const shouldShowMentionMenu = mentionQuery !== null && !isMentionMenuDismissed
  const matchingMentionCandidates = getMatchingMentionCandidates(mentionCandidates, mentionQuery)

  /** Add 라벨 요청이나 사용자 동작을 처리한다. */
  function handleAddLabel() {
    if (!labelKind) return
    const nextLabel = createDraftLabel(labelKind, labelDrafts[labelKind])
    if (!nextLabel) return
    onChangeLabels([...labels, nextLabel])
    setLabelDrafts((drafts) => ({ ...drafts, [labelKind]: '' }))
    setLabelKind(null)
    setIsActionTrayOpen(false)
    messageInputRef.current?.focus()
  }

  /** Remove 라벨 요청이나 사용자 동작을 처리한다. */
  function handleRemoveLabel(index: number) {
    onChangeLabels(labels.filter((_, labelIndex) => labelIndex !== index))
  }

  /** 입력된 메시지와 일치하는 멘션 대상 식별자를 함께 갱신한다. */
  function handleChangeMessage(nextValue: string) {
    onChangeDraft(nextValue)
    onChangeMentionedMemberIds(getMentionedMemberIds(nextValue, mentionCandidates))
    setIsMentionMenuDismissed(false)
  }

  /** 선택한 멤버를 현재 @ 입력 위치에 삽입하고 메시지 입력을 유지한다. */
  function handleSelectMention(member: VideoFilterMember) {
    handleChangeMessage(insertMention(value, member.displayName))
    window.requestAnimationFrame(() => messageInputRef.current?.focus())
  }

  /** 복귀 To 라벨 선택 요청이나 사용자 동작을 처리한다. */
  function handleReturnToLabelSelection() {
    setLabelKind(null)
    window.requestAnimationFrame(() => firstActionButtonRef.current?.focus())
  }

  useEffect(() => {
    /** 외부 포인터 Down 요청이나 사용자 동작을 처리한다. */
    function handleOutsidePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      const isMentionMenuTarget = mentionMenuRef.current?.contains(event.target)
      const isMessageInputTarget = messageInputRef.current?.contains(event.target)
      if (shouldShowMentionMenu && !isMentionMenuTarget && !isMessageInputTarget)
        setIsMentionMenuDismissed(true)
      if (!isActionTrayOpen) return
      if (actionMenuRef.current?.contains(event.target)) return
      if (actionMenuButtonRef.current?.contains(event.target)) return
      setIsActionTrayOpen(false)
    }

    /** Escape 키 요청이나 사용자 동작을 처리한다. */
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (shouldShowMentionMenu) {
        setIsMentionMenuDismissed(true)
        messageInputRef.current?.focus()
        return
      }
      if (!isActionTrayOpen) return
      setIsActionTrayOpen(false)
      actionMenuButtonRef.current?.focus()
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isActionTrayOpen, shouldShowMentionMenu])

  return (
    <section className="border-ink/10 relative mt-6 border-t pt-4">
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
        <div
          aria-labelledby="chat-action-menu-title"
          className="talkhugam-chat-action-menu border-ink/10 rounded-lg border bg-white p-3 shadow-lg"
          ref={actionMenuRef}
          role="dialog"
        >
          {labelKind ? (
            <div>
              <div className="mb-2 flex min-h-11 items-center gap-2">
                <button
                  aria-label="라벨 종류 선택으로 돌아가기"
                  className="text-ink hover:bg-surface-muted flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md"
                  onClick={handleReturnToLabelSelection}
                  type="button"
                >
                  <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                    <path
                      d="m14.5 5-7 7 7 7"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                </button>
                <h2 className="text-ink text-sm font-semibold" id="chat-action-menu-title">
                  {labelKind === 'page' ? '페이지 라벨' : '챕터 라벨'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="post-label-value">
                  {labelKind === 'page' ? '페이지 번호' : '챕터 이름 또는 번호'}
                </label>
                <input
                  autoFocus
                  className="border-ink/10 focus:border-primary min-h-11 min-w-0 flex-1 rounded-md border px-3 text-sm outline-none"
                  id="post-label-value"
                  onChange={(event) =>
                    setLabelDrafts((drafts) => ({
                      ...drafts,
                      [labelKind]: event.target.value,
                    }))
                  }
                  placeholder={labelKind === 'page' ? '예: 87' : '예: 3장 또는 고독'}
                  value={labelDrafts[labelKind]}
                />
                <button
                  aria-label="라벨 추가"
                  className="bg-primary text-ink min-h-11 cursor-pointer rounded-md px-3 text-sm font-medium"
                  onClick={handleAddLabel}
                  type="button"
                >
                  추가
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="sr-only" id="chat-action-menu-title">
                메시지 추가 메뉴
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <ActionButton
                  buttonRef={firstActionButtonRef}
                  disabled={isReplying}
                  label="페이지 라벨"
                  onClick={() => setLabelKind('page')}
                />
                <ActionButton
                  disabled={isReplying}
                  label="챕터 라벨"
                  onClick={() => setLabelKind('chapter')}
                />
                <ActionButton
                  label="영상 올리기"
                  onClick={() => {
                    setIsActionTrayOpen(false)
                    fileInputRef.current?.click()
                  }}
                />
                <ActionButton
                  label="영상 기록"
                  onClick={() => {
                    setIsActionTrayOpen(false)
                    onOpenVideoArchive()
                  }}
                />
              </div>
            </>
          )}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <input
          accept="video/mp4,video/quicktime"
          aria-label="영상 파일 선택"
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
          aria-label={isActionTrayOpen ? '메시지 추가 메뉴 닫기' : '메시지 추가 메뉴 열기'}
          className="border-ink/20 text-ink flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border"
          onClick={() => setIsActionTrayOpen((isOpen) => !isOpen)}
          ref={actionMenuButtonRef}
          type="button"
        >
          <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
            <path
              className={`origin-center transition-transform duration-300 motion-reduce:transition-none ${
                isActionTrayOpen ? 'rotate-45' : ''
              }`}
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2.4"
            />
          </svg>
        </button>
        <div className="relative min-w-0 flex-1">
          {shouldShowMentionMenu ? (
            <div
              className="border-ink/10 absolute right-0 bottom-full left-0 z-10 mb-2 rounded-lg border bg-white p-2 shadow-lg"
              ref={mentionMenuRef}
            >
              {hasMentionMemberError ? (
                <div className="space-y-2" role="alert">
                  <p className="text-sm text-red-600">
                    멘션할 멤버를 불러오지 못했어요. 다시 시도해 주세요.
                  </p>
                  <button
                    className="border-ink/10 text-ink min-h-11 cursor-pointer rounded-md border px-3 text-sm font-medium"
                    onClick={onRetryMentionMembers}
                    type="button"
                  >
                    다시 시도
                  </button>
                </div>
              ) : matchingMentionCandidates.length > 0 ? (
                <div aria-label="멘션할 멤버" id="mention-candidates" role="listbox">
                  {matchingMentionCandidates.map((member) => (
                    <button
                      aria-label={`${member.displayName} 멘션 추가`}
                      className="hover:bg-surface-muted text-ink flex min-h-11 w-full cursor-pointer items-center rounded-md px-3 text-left text-sm font-medium"
                      key={member.id}
                      onClick={() => handleSelectMention(member)}
                      role="option"
                      type="button"
                    >
                      @{member.displayName}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-ink-subtle px-3 py-2 text-sm">멘션할 멤버가 없어요.</p>
              )}
            </div>
          ) : null}
          <label className="sr-only" htmlFor="discussion-message">
            메시지 입력
          </label>
          <textarea
            aria-autocomplete="list"
            aria-controls={shouldShowMentionMenu ? 'mention-candidates' : undefined}
            className="border-ink/10 focus:border-primary min-h-11 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm outline-none"
            id="discussion-message"
            onChange={(event) => handleChangeMessage(event.target.value)}
            onKeyDown={(event) => {
              if (!shouldSubmitMessage(event.key, event.shiftKey)) return
              event.preventDefault()
              onSubmit()
            }}
            placeholder={isReplying ? '답글을 입력하세요' : '메시지 입력'}
            ref={messageInputRef}
            rows={1}
            value={value}
          />
        </div>
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
        <div className="mt-3">
          <LoadingSpinner label="영상을 채팅에 올리고 있어요…" size="xs" />
        </div>
      ) : null}
    </section>
  )
}

/** 동작 버튼 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function ActionButton({
  buttonRef,
  disabled = false,
  label,
  onClick,
}: {
  buttonRef?: RefObject<HTMLButtonElement | null>
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className="border-ink/10 text-ink min-h-11 cursor-pointer rounded-md border px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      ref={buttonRef}
      type="button"
    >
      {label}
    </button>
  )
}

/** 대화 타임라인 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function ChatTimeline({
  allPosts,
  isThumbnailLoading,
  onOpenVideo,
  onReply,
  posts,
  showEmptyState = true,
  thumbnailsByPostId,
  videos,
}: {
  allPosts: DiscussionPost[]
  isThumbnailLoading: boolean
  onOpenVideo: (videoId: string) => void
  onReply: (id: string) => void
  posts: DiscussionPost[]
  showEmptyState?: boolean
  thumbnailsByPostId: ReadonlyMap<string, VideoThumbnailAuthorization>
  videos: VideoPost[]
}) {
  const messages = createChatMessages(posts, videos)
  if (messages.length === 0 && showEmptyState)
    return (
      <div className="bg-surface-muted rounded-lg p-6 text-center">
        <p className="text-ink font-medium">첫 감상을 남겨 보세요</p>
        <p className="text-ink-subtle mt-2 text-sm">페이지나 챕터 라벨만 먼저 남겨도 괜찮아요.</p>
      </div>
    )
  if (messages.length === 0) return null
  return (
    <ul className="space-y-4">
      {messages.map((message) =>
        message.type === 'text' ? (
          <li className="flex" key={message.post.id}>
            <article className="border-ink/10 w-fit max-w-[70%] rounded-lg border bg-white px-4 py-3">
              <p className="text-ink text-sm font-medium">{message.post.authorName}</p>
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
              <Replies posts={allPosts.filter((reply) => reply.rootPostId === message.post.id)} />
            </article>
          </li>
        ) : (
          <li className="flex" key={message.video.id}>
            <VideoMessage
              isThumbnailLoading={isThumbnailLoading}
              onOpen={() => onOpenVideo(message.video.id)}
              thumbnailAuthorization={thumbnailsByPostId.get(message.video.id)}
              video={message.video}
            />
          </li>
        ),
      )}
    </ul>
  )
}

/** 영상 메시지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function VideoMessage({
  isThumbnailLoading,
  onOpen,
  thumbnailAuthorization,
  video,
}: {
  isThumbnailLoading: boolean
  onOpen: () => void
  thumbnailAuthorization: VideoThumbnailAuthorization | undefined
  video: VideoPost
}) {
  if (video.status === 'ready')
    return (
      <button
        aria-label={`${video.authorName}님의 영상 보기`}
        className="border-ink/10 focus-visible:ring-primary bg-ink relative w-[70%] max-w-[70%] overflow-hidden rounded-lg border text-left focus-visible:ring-2 focus-visible:outline-none"
        onClick={onOpen}
        type="button"
      >
        <div className="relative aspect-square">
          {thumbnailAuthorization ? (
            <img
              alt=""
              className="absolute inset-0 size-full object-cover"
              src={createMuxThumbnailUrl(thumbnailAuthorization)}
            />
          ) : isThumbnailLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoadingSpinner label="미리보기를 준비하고 있어요." size="sm" tone="inverse" />
            </div>
          ) : (
            <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm font-medium text-white">
              미리보기를 불러오지 못했어요.
            </p>
          )}
          <VideoPlayIcon />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-3 text-sm font-medium text-white">
            {video.authorName}의 영상
          </span>
        </div>
      </button>
    )
  const message = getVideoMessageLabel(video)
  const isLoading = video.status !== 'failed'
  return (
    <article className="border-ink/10 bg-ink flex aspect-square w-[70%] max-w-[70%] flex-col items-center justify-center rounded-lg border px-4 text-center">
      {isLoading ? (
        <LoadingSpinner label={message} size="sm" tone="inverse" />
      ) : (
        <p className="text-sm font-medium text-white">{message}</p>
      )}
    </article>
  )
}

/** 정방형 영상 미리보기 위에 재생 가능 여부를 나타내는 제어 아이콘을 렌더링한다. */
function VideoPlayIcon() {
  return (
    <span
      aria-hidden="true"
      className="text-ink absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-sm"
    >
      <svg className="ml-0.5 size-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5.7v12.6L18 12 8 5.7Z" />
      </svg>
    </span>
  )
}

/** 메시지 라벨 목록 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
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

/** 답글 목록 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function Replies({ posts }: { posts: DiscussionPost[] }) {
  if (posts.length === 0) return null
  return (
    <ul className="border-ink/10 mt-3 space-y-3 border-l pl-3">
      {posts.map((post) => (
        <li key={post.id}>
          <p className="text-ink text-xs font-medium">{post.authorName}</p>
          {post.body ? (
            <p className="text-ink-subtle mt-1 text-xs whitespace-pre-wrap">{post.body}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/** 작성 중 라벨 데이터를 생성해 반환한다. */
function createDraftLabel(kind: LabelKind, value: string): PostForm['labels'][number] | null {
  try {
    return parsePostForm({ body: '', labels: [{ kind, value }] }).labels[0] ?? null
  } catch {
    return null
  }
}

/** 라벨 값을 화면 표시용 문자열로 변환한다. */
function formatLabel(label: PostForm['labels'][number]) {
  if (label.kind === 'page') return `페이지 ${label.value}`
  if (label.kind === 'chapter') return `챕터 ${label.value}`
  return label.value
}

/** 대화 메시지 목록 데이터를 생성해 반환한다. */
function createChatMessages(posts: DiscussionPost[], videos: VideoPost[]) {
  const textMessages = posts.map((post) => ({
    createdAt: post.createdAt,
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

/** 영상 메시지 라벨 데이터를 조회하거나 계산해 반환한다. */
function getVideoMessageLabel(video: VideoPost) {
  if (video.status === 'failed') return '영상 처리에 실패했어요.'
  if (video.status === 'waiting_upload') return '영상을 올리고 있어요…'
  return '영상 준비 중…'
}

/** 메시지 마지막 단어에서 현재 작성 중인 @ 멘션 검색어를 추출한다. */
function getActiveMentionQuery(value: string) {
  const match = value.match(/(?:^|\s)@([^\s@]*)$/u)
  return match?.[1] ?? null
}

/** 현재 @ 검색어와 일치하는 독서방 멤버 후보를 반환한다. */
function getMatchingMentionCandidates(
  candidates: readonly VideoFilterMember[],
  query: string | null,
) {
  if (query === null) return []
  const normalizedQuery = query.toLocaleLowerCase('ko-KR')
  return candidates.filter((candidate) =>
    candidate.displayName.toLocaleLowerCase('ko-KR').includes(normalizedQuery),
  )
}

/** 메시지 본문에 실제로 완성된 @이름과 일치하는 멤버 식별자를 최대 여섯 명까지 반환한다. */
function getMentionedMemberIds(value: string, candidates: readonly VideoFilterMember[]) {
  const candidateIdsByName = new Map(
    candidates.map((candidate) => [candidate.displayName, candidate.id]),
  )
  const memberIds = [...value.matchAll(/(?:^|\s)@([^\s@]+)/gu)]
    .map((match) => candidateIdsByName.get(match[1] ?? ''))
    .filter((memberId): memberId is string => memberId !== undefined)

  return memberIds.filter((memberId, index) => memberIds.indexOf(memberId) === index).slice(0, 6)
}

/** 현재 작성 중인 @검색어를 선택한 멤버 이름으로 바꾸고 다음 메시지를 위한 공백을 추가한다. */
function insertMention(value: string, displayName: string) {
  const activeMentionPattern = /(^|\s)@[^\s@]*$/u
  if (activeMentionPattern.test(value))
    return value.replace(activeMentionPattern, (_, prefix: string) => `${prefix}@${displayName} `)
  const separator = value.length === 0 || value.endsWith(' ') ? '' : ' '
  return `${value}${separator}@${displayName} `
}

/** 메시지 본문·라벨·멘션을 전송 가능한 입력 형식으로 검증한다. */
function postInput(
  body: string,
  labels: PostForm['labels'],
  mentionedMemberIds: PostForm['mentionedMemberIds'],
) {
  try {
    return { ok: true as const, value: parsePostForm({ body, labels, mentionedMemberIds }) }
  } catch {
    return { ok: false as const }
  }
}
