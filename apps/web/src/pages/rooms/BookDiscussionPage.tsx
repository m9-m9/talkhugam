import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useEffect, useRef, useState, type RefObject } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { bookChatKeys, getManagedBookChat, getReadingRoom } from '../../entities/book-chat'
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
import {
  CompletionReviewForm,
  invalidateCompletionQueries,
  removeBookCompletionFromCache,
  storeBookCompletionInCache,
} from '../../features/book-completion'
import { useAuthenticatedUser } from '../../features/auth'
import { readingRoomKeys } from '../../entities/reading-room'
import {
  createManagedRoomInvite,
  getRoomManagement,
  roomManagementKeys,
  type CreatedManagedRoomInvite,
} from '../../entities/room-management'
import {
  copyInviteText,
  createInviteShareData,
  getInviteCopyText,
  getInvitePlatformUrl,
  InviteShareSheet,
  shareInviteWithKakao,
  type InviteShareData,
  type InviteSharePlatform,
} from '../../features/invite-sharing'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { getClientEnv } from '../../app/env'
import { trackAnalyticsEvent } from '../../shared/analytics'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BottomSheet } from '../../shared/ui/BottomSheet'
import { CompletionMark } from '../../shared/ui/CompletionMark'
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
  const [isCompletionSheetOpen, setIsCompletionSheetOpen] = useState(false)
  const [isCompletionEditorOpen, setIsCompletionEditorOpen] = useState(false)
  const [createdInvite, setCreatedInvite] = useState<CreatedManagedRoomInvite | null>(null)
  const [inviteShareError, setInviteShareError] = useState<string | null>(null)
  const [isInviteShareSheetOpen, setIsInviteShareSheetOpen] = useState(false)
  const completionTriggerRef = useRef<HTMLButtonElement>(null)
  const inviteShareTriggerRef = useRef<HTMLButtonElement>(null)
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
  const bookChatQuery = useQuery({
    enabled: Boolean(bookChatId),
    queryFn: () => getManagedBookChat(createSupabaseClient(), bookChatId ?? ''),
    queryKey: bookChatKeys.detail(bookChatId ?? ''),
  })
  const roomQuery = useQuery({
    enabled: Boolean(roomId),
    queryFn: () => getReadingRoom(createSupabaseClient(), roomId ?? ''),
    queryKey: bookChatKeys.room(roomId ?? ''),
  })
  const roomManagementQuery = useQuery({
    enabled: Boolean(roomId),
    queryFn: () => getRoomManagement(createSupabaseClient(), roomId ?? '', profileId),
    queryKey: roomManagementKeys.detail(roomId ?? ''),
  })
  const inviteMutation = useMutation({
    mutationFn: () => createManagedRoomInvite(createSupabaseClient(), roomId ?? ''),
    onSuccess: (invite) => {
      setCreatedInvite(invite)
      setIsInviteShareSheetOpen(true)
    },
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
    enabled: Boolean(bookChatId) && isCompletionSheetOpen,
    queryFn: () => getBookChatCompletions(createSupabaseClient(), bookChatId ?? '', profileId),
    queryKey: bookCompletionKeys.byChat(bookChatId ?? ''),
  })
  const completionMutation = useMutation({
    mutationFn: (input: BookCompletionInput) =>
      upsertBookChatCompletion(createSupabaseClient(), input),
    onSuccess: (_result, input) => {
      storeBookCompletionInCache(queryClient, { ...input, profileId })
      setIsCompletionEditorOpen(false)
      trackAnalyticsEvent('book_completed')
      invalidateCompletionQueries(queryClient, bookChatId ?? '', profileId)
    },
  })
  const completionRemovalMutation = useMutation({
    mutationFn: (targetBookChatId: string) =>
      removeBookChatCompletion(createSupabaseClient(), targetBookChatId),
    onSuccess: () => {
      removeBookCompletionFromCache(queryClient, { bookChatId: bookChatId ?? '', profileId })
      invalidateCompletionQueries(queryClient, bookChatId ?? '', profileId)
    },
  })

  /** 제출 요청이나 사용자 동작을 처리한다. */
  async function handleSubmit() {
    const parsed = postInput(draft, labels, mentionedMemberIds)
    if (!parsed.ok || !bookChatId) {
      setErrorMessage('독후감이나 라벨을 하나 이상 남겨 주세요.')
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
      trackAnalyticsEvent('post_created')
      setDraft('')
      setLabels([])
      setMentionedMemberIds([])
      setReplyTo(null)
      await queryClient.invalidateQueries({ queryKey: postKeys.byBookChat(bookChatId) })
      await queryClient.invalidateQueries({ queryKey: readingRoomKeys.all })
    } catch {
      setErrorMessage('독후감을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  /** 실패한 독후감과 영상 조회를 함께 다시 요청한다. */
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

  /** 완독 기록 시트를 열어 현재 책의 멤버 기록을 확인한다. */
  function handleOpenCompletionSheet() {
    setIsCompletionEditorOpen(false)
    setIsCompletionSheetOpen(true)
  }

  /** 완독 기록 시트를 닫고 메시지 추가 버튼으로 포커스를 돌려준다. */
  function handleCloseCompletionSheet() {
    setIsCompletionEditorOpen(false)
    setIsCompletionSheetOpen(false)
    completionTriggerRef.current?.focus()
  }

  /** 완독 기록 요약에서 별점과 총평을 작성하거나 수정하는 상태로 전환한다. */
  function handleOpenCompletionEditor() {
    setIsCompletionEditorOpen(true)
  }

  /** 완독 기록 작성 상태를 닫고 현재의 완독 요약으로 돌아간다. */
  function handleCloseCompletionEditor() {
    setIsCompletionEditorOpen(false)
  }

  /** 작성한 별점과 총평을 현재 책 대화의 개인 완독 기록으로 저장한다. */
  function handleSaveCompletion(input: BookCompletionInput) {
    completionMutation.mutate(input)
  }

  /** 현재 사용자의 완독 기록을 제거하고 관련 목록을 최신 상태로 갱신한다. */
  function handleRemoveCompletion() {
    if (!bookChatId) return
    completionRemovalMutation.mutate(bookChatId)
  }

  /** 방장이 새 초대 코드를 만들거나 이미 만든 초대를 공유 시트로 연다. */
  function handleOpenRoomInvite() {
    if (createdInvite !== null) {
      setIsInviteShareSheetOpen(true)
      return
    }
    inviteMutation.mutate()
  }

  /** 초대 공유 시트를 닫고 메뉴의 초대 버튼에 포커스를 되돌린다. */
  function handleCloseInviteShareSheet() {
    setIsInviteShareSheetOpen(false)
    window.requestAnimationFrame(() => inviteShareTriggerRef.current?.focus())
  }

  /** 선택한 채널의 지원 범위에 맞춰 초대 코드와 링크를 전달한다. */
  async function handleShareInvite(platform: InviteSharePlatform) {
    const room = roomQuery.data
    if (createdInvite === null || room === null || room === undefined) return

    const shareData = createInviteShareData(window.location.origin, room.name, createdInvite)
    setInviteShareError(null)
    try {
      if (platform === 'kakao') {
        const javascriptKey = getClientEnv().VITE_KAKAO_JAVASCRIPT_KEY
        if (javascriptKey) {
          try {
            await shareInviteWithKakao(shareData, javascriptKey)
          } catch {
            await shareWithDevice(shareData)
          }
        } else await shareWithDevice(shareData)
        handleCloseInviteShareSheet()
        return
      }
      if (platform === 'instagram') {
        await copyInviteText(getInviteCopyText(shareData))
        openInvitePlatform(platform, shareData)
        return
      }
      openInvitePlatform(platform, shareData)
      handleCloseInviteShareSheet()
    } catch (error) {
      if (isShareCancellation(error)) return
      setInviteShareError('초대 내용을 공유하지 못했어요. 다시 시도해 주세요.')
    }
  }

  /** 초대 코드와 링크를 클립보드에 함께 복사한다. */
  async function handleCopyInvite() {
    const room = roomQuery.data
    if (createdInvite === null || room === null || room === undefined) return

    setInviteShareError(null)
    try {
      const shareData = createInviteShareData(window.location.origin, room.name, createdInvite)
      await copyInviteText(getInviteCopyText(shareData))
    } catch {
      setInviteShareError('초대 코드와 링크를 복사하지 못했어요. 다시 시도해 주세요.')
    }
  }

  if (!roomId || !bookChatId) return <main className="bg-surface min-h-screen" />
  const roots = postsQuery.data?.filter((post) => post.depth === 0) ?? []
  return (
    <main className="app-page bg-surface flex min-h-screen flex-col px-4 pb-6">
      <AppHeader
        action={
          <button
            aria-label="책 대화 관리"
            className="text-ink min-h-11 min-w-11 px-3 text-xl"
            onClick={() => void navigate(`/rooms/${roomId}/books/${bookChatId}/manage`)}
            type="button"
          >
            ⋯
          </button>
        }
        onBack={() => void navigate(`/rooms/${roomId}`)}
        title={roomQuery.data?.name ?? '책방'}
      />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">책 대화</p>
        <h1 className="text-ink mt-2 text-xl font-bold">
          {bookChatQuery.data?.title ?? '책을 불러오고 있어요.'}
        </h1>
      </header>
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
            currentMemberId={getCurrentUserMemberId(membersQuery.data ?? [])}
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
        inviteTriggerRef={inviteShareTriggerRef}
        errorMessage={errorMessage ?? videoErrorMessage}
        isReplying={Boolean(replyTo)}
        isCurrentUserOwner={roomManagementQuery.data?.isCurrentUserOwner ?? false}
        key={bookChatId}
        labels={labels}
        mentionCandidates={(membersQuery.data ?? []).filter((member) => !member.isCurrentUser)}
        onCancelReply={() => setReplyTo(null)}
        onChangeDraft={setDraft}
        onChangeLabels={setLabels}
        onChangeMentionedMemberIds={setMentionedMemberIds}
        onOpenVideoArchive={() => void navigate(`/rooms/${roomId}/books/${bookChatId}/videos`)}
        onOpenCompletion={handleOpenCompletionSheet}
        onOpenRoomInvite={handleOpenRoomInvite}
        onRetryMentionMembers={() => void membersQuery.refetch()}
        onSelectVideo={uploadVideo}
        onSubmit={() => void handleSubmit()}
        completionTriggerRef={completionTriggerRef}
        hasMentionMemberError={membersQuery.isError}
        isUploadingVideo={isUploadingVideo}
        value={draft}
      />
      {isCompletionSheetOpen ? (
        <CompletionSheet
          bookChatId={bookChatId}
          completions={completionsQuery.data ?? []}
          errorMessage={
            completionMutation.isError || completionRemovalMutation.isError
              ? '완독 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
              : null
          }
          isLoading={completionsQuery.isPending}
          isEditorOpen={isCompletionEditorOpen}
          isSaving={completionMutation.isPending || completionRemovalMutation.isPending}
          onClose={handleCloseCompletionSheet}
          onCloseEditor={handleCloseCompletionEditor}
          onOpenEditor={handleOpenCompletionEditor}
          onRemove={handleRemoveCompletion}
          onSave={handleSaveCompletion}
        />
      ) : null}
      {createdInvite !== null && isInviteShareSheetOpen ? (
        <InviteShareSheet
          inviteCode={createdInvite.code}
          onClose={handleCloseInviteShareSheet}
          onCopyInvite={() => void handleCopyInvite()}
          onShare={(platform) => void handleShareInvite(platform)}
        />
      ) : null}
      {inviteMutation.isError || inviteShareError ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {inviteShareError ?? '초대 코드를 만들지 못했어요. 다시 시도해 주세요.'}
        </p>
      ) : null}
    </main>
  )
}

/** 독후감과 영상 조회 상태에 따라 대화 또는 재시도 안내를 렌더링한다. */
function DiscussionTimeline({
  allPosts,
  currentMemberId,
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
  currentMemberId: string | null
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
        currentMemberId={currentMemberId}
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
  if (hasPostError) return '독후감을 불러오지 못했어요. 다시 시도해 주세요.'
  if (hasVideoError) return '영상을 불러오지 못했어요. 다시 시도해 주세요.'
  return null
}

/** 개인 완독 기록과 책방 멤버의 총평 현황을 하단 시트로 렌더링한다. */
function CompletionSheet({
  bookChatId,
  completions,
  errorMessage,
  isEditorOpen,
  isLoading,
  isSaving,
  onClose,
  onCloseEditor,
  onOpenEditor,
  onRemove,
  onSave,
}: {
  bookChatId: string
  completions: BookChatCompletion[]
  errorMessage: string | null
  isEditorOpen: boolean
  isLoading: boolean
  isSaving: boolean
  onClose: () => void
  onCloseEditor: () => void
  onOpenEditor: () => void
  onRemove: () => void
  onSave: (input: BookCompletionInput) => void
}) {
  const ownCompletion = completions.find((completion) => completion.isMe)
  return (
    <BottomSheet onClose={onClose} title="완독 기록">
      {isLoading ? (
        <LoadingSpinner label="완독 현황을 불러오고 있어요." size="xs" variant="book" />
      ) : null}
      {!isLoading ? (
        <>
          {isEditorOpen ? (
            <CompletionReviewForm
              bookChatId={bookChatId}
              initialRating={ownCompletion?.rating ?? null}
              initialReview={ownCompletion?.review ?? null}
              isSaving={isSaving}
              key={ownCompletion?.completedAt ?? 'new-completion'}
              onCancel={onCloseEditor}
              onSave={onSave}
              submitLabel={ownCompletion ? '완독 기록 수정' : '완독 기록 저장'}
            />
          ) : (
            <CompletionSummary
              completionCount={completions.length}
              hasOwnCompletion={Boolean(ownCompletion)}
              isSaving={isSaving}
              onOpenEditor={onOpenEditor}
              onRemove={onRemove}
            />
          )}
          {errorMessage ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {!isEditorOpen && completions.length === 0 ? (
            <p className="text-ink-subtle mt-4 text-sm">아직 완독한 멤버가 없어요.</p>
          ) : null}
          {!isEditorOpen && completions.length > 0 ? (
            <ul className="mt-4 space-y-3" aria-label="완독한 멤버">
              {completions.map((completion) => (
                <li
                  className="border-ink/10 border-t pt-3 first:border-t-0 first:pt-0"
                  key={completion.profileId}
                >
                  <p className="text-ink text-sm font-semibold">
                    {completion.isMe ? '나' : completion.displayName}
                  </p>
                  {completion.rating ? (
                    <p className="text-primary mt-1 text-sm" aria-label={`${completion.rating}점`}>
                      {'★'.repeat(completion.rating)}
                    </p>
                  ) : null}
                  {completion.review ? (
                    <p className="text-ink-subtle mt-1 text-sm">{completion.review}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </BottomSheet>
  )
}

/** 현재 사용자의 완독 여부에 맞는 작성 또는 수정 CTA를 렌더링한다. */
function CompletionSummary({
  completionCount,
  hasOwnCompletion,
  isSaving,
  onOpenEditor,
  onRemove,
}: {
  completionCount: number
  hasOwnCompletion: boolean
  isSaving: boolean
  onOpenEditor: () => void
  onRemove: () => void
}) {
  return (
    <div className="border-ink/10 mt-4 border-t pt-4">
      <p className="text-ink text-sm font-semibold">함께 읽은 기록 · {completionCount}명 완독</p>
      <div className="mt-3 flex items-center gap-2">
        {hasOwnCompletion ? <CompletionMark label="내 완독" /> : null}
        <button
          className="bg-primary min-h-11 cursor-pointer rounded-md px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={isSaving}
          onClick={onOpenEditor}
          type="button"
        >
          {hasOwnCompletion ? '완독 기록 수정' : '완독하기'}
        </button>
        {hasOwnCompletion ? (
          <button
            className="border-primary text-primary min-h-11 cursor-pointer rounded-md border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isSaving}
            onClick={onRemove}
            type="button"
          >
            완독 취소
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** 대화 입력창 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function ChatComposer({
  completionTriggerRef,
  errorMessage,
  hasMentionMemberError,
  isReplying,
  isCurrentUserOwner,
  isUploadingVideo,
  labels,
  mentionCandidates,
  onCancelReply,
  onChangeDraft,
  onChangeLabels,
  onChangeMentionedMemberIds,
  onOpenCompletion,
  onOpenRoomInvite,
  onOpenVideoArchive,
  onRetryMentionMembers,
  onSelectVideo,
  onSubmit,
  value,
  inviteTriggerRef,
}: {
  completionTriggerRef: RefObject<HTMLButtonElement | null>
  errorMessage: string | null
  hasMentionMemberError: boolean
  isReplying: boolean
  isCurrentUserOwner: boolean
  isUploadingVideo: boolean
  labels: PostForm['labels']
  mentionCandidates: VideoFilterMember[]
  onCancelReply: () => void
  onChangeDraft: (value: string) => void
  onChangeLabels: (labels: PostForm['labels']) => void
  onChangeMentionedMemberIds: (mentionedMemberIds: PostForm['mentionedMemberIds']) => void
  onOpenCompletion: () => void
  onOpenRoomInvite: () => void
  onOpenVideoArchive: () => void
  onRetryMentionMembers: () => void
  onSelectVideo: (file: File | undefined) => void
  onSubmit: () => void
  value: string
  inviteTriggerRef: RefObject<HTMLButtonElement | null>
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
    handleCloseActionTray()
    messageInputRef.current?.focus()
  }

  /** 라벨 입력창에서 Enter를 누르면 현재 라벨을 추가한다. */
  function handleLabelInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleAddLabel()
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

  /** 라벨 임시 입력을 비우고 메시지 추가 메뉴를 닫는다. */
  function handleCloseActionTray() {
    setIsActionTrayOpen(false)
    setLabelKind(null)
    setLabelDrafts({ chapter: '', page: '' })
  }

  /** 메시지 추가 메뉴를 열거나, 열려 있으면 라벨 임시 입력을 비우고 닫는다. */
  function handleToggleActionTray() {
    if (isActionTrayOpen) {
      handleCloseActionTray()
      return
    }
    setIsActionTrayOpen(true)
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
      handleCloseActionTray()
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
      handleCloseActionTray()
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
                  onKeyDown={handleLabelInputKeyDown}
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
                    handleCloseActionTray()
                    fileInputRef.current?.click()
                  }}
                />
                <ActionButton
                  label="영상 기록"
                  onClick={() => {
                    handleCloseActionTray()
                    onOpenVideoArchive()
                  }}
                />
                <ActionButton
                  label="완독 기록"
                  onClick={() => {
                    completionTriggerRef.current = actionMenuButtonRef.current
                    handleCloseActionTray()
                    onOpenCompletion()
                  }}
                />
                {isCurrentUserOwner ? (
                  <ActionButton
                    buttonRef={inviteTriggerRef}
                    label="책방 초대하기"
                    onClick={() => {
                      handleCloseActionTray()
                      onOpenRoomInvite()
                    }}
                  />
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
      <div className="talkhugam-chat-composer-row">
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
          className="border-ink/20 text-ink flex size-11 cursor-pointer items-center justify-center rounded-full border"
          onClick={handleToggleActionTray}
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
            className="border-ink/10 focus:border-primary block min-h-11 w-full resize-none rounded-md border bg-white px-3 py-2 text-base outline-none"
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
          className="bg-primary text-ink min-h-11 shrink-0 rounded-md px-3 text-sm font-semibold disabled:opacity-40"
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
          <LoadingSpinner label="영상을 채팅에 올리고 있어요…" size="xs" variant="book" />
        </div>
      ) : null}
    </section>
  )
}

/** 동작 버튼 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function ActionButton({
  buttonRef,
  className = '',
  disabled = false,
  label,
  onClick,
}: {
  buttonRef?: RefObject<HTMLButtonElement | null>
  className?: string
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`border-ink/10 text-ink min-h-11 cursor-pointer rounded-md border px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      disabled={disabled}
      onClick={onClick}
      ref={buttonRef}
      type="button"
    >
      {label}
    </button>
  )
}

/** 기기 공유 창이 없으면 초대 문구를 복사해 카카오톡에서 바로 붙여 넣게 한다. */
async function shareWithDevice(shareData: InviteShareData): Promise<void> {
  if (typeof navigator.share === 'function') {
    await navigator.share(shareData)
    return
  }
  await copyInviteText(getInviteCopyText(shareData))
}

/** 카카오톡 외 채널의 공유 주소를 새 창으로 열어 초대 흐름을 이어간다. */
function openInvitePlatform(
  platform: Exclude<InviteSharePlatform, 'kakao'>,
  shareData: InviteShareData,
) {
  const platformUrl = getInvitePlatformUrl(platform, shareData)
  if (platformUrl === null) return
  window.open(platformUrl, '_blank', 'noopener,noreferrer')
}

/** 사용자가 기기 공유 창을 닫은 오류인지 확인해 불필요한 실패 안내를 막는다. */
function isShareCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  )
}

/** 대화 타임라인 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function ChatTimeline({
  allPosts,
  currentMemberId,
  isThumbnailLoading,
  onOpenVideo,
  onReply,
  posts,
  showEmptyState = true,
  thumbnailsByPostId,
  videos,
}: {
  allPosts: DiscussionPost[]
  currentMemberId: string | null
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
        <p className="text-ink font-medium">첫 독후감을 남겨 보세요</p>
        <p className="text-ink-subtle mt-2 text-sm">페이지나 챕터 라벨만 먼저 남겨도 괜찮아요.</p>
      </div>
    )
  if (messages.length === 0) return null
  return (
    <ul className="space-y-4">
      {messages.map((message) =>
        message.type === 'text' ? (
          <li
            className={`flex ${
              isCurrentMemberMessage(message.post.authorMemberId, currentMemberId)
                ? 'justify-end'
                : 'justify-start'
            }`}
            key={message.post.id}
          >
            <article className="border-ink/10 w-fit max-w-[70%] rounded-lg border bg-white px-4 py-3">
              <p className="text-ink text-sm font-medium">{message.post.authorName}</p>
              <PostLabels labels={message.post.labels} />
              {message.post.body ? (
                <p className="text-ink mt-2 text-sm whitespace-pre-wrap">
                  <HighlightedMentionText body={message.post.body} />
                </p>
              ) : null}
              <button
                className="text-primary mt-2 min-h-11 text-xs"
                onClick={() => onReply(message.post.id)}
                type="button"
              >
                답글 남기기
              </button>
              <Replies
                currentMemberId={currentMemberId}
                posts={allPosts.filter((reply) => reply.rootPostId === message.post.id)}
              />
            </article>
          </li>
        ) : (
          <li
            className={`flex ${
              isCurrentMemberMessage(message.video.authorMemberId, currentMemberId)
                ? 'justify-end'
                : 'justify-start'
            }`}
            key={message.video.id}
          >
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
              <LoadingSpinner
                label="미리보기를 준비하고 있어요."
                size="sm"
                tone="inverse"
                variant="book"
              />
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
        <LoadingSpinner label={message} size="sm" tone="inverse" variant="book" />
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
function Replies({
  currentMemberId,
  posts,
}: {
  currentMemberId: string | null
  posts: DiscussionPost[]
}) {
  if (posts.length === 0) return null
  return (
    <ul className="border-ink/10 mt-3 space-y-3 border-l pl-3">
      {posts.map((post) => (
        <li
          className={`flex ${
            isCurrentMemberMessage(post.authorMemberId, currentMemberId)
              ? 'justify-end'
              : 'justify-start'
          }`}
          key={post.id}
        >
          <div className="w-fit max-w-[70%]">
            <p className="text-ink text-xs font-medium">{post.authorName}</p>
            {post.body ? (
              <p className="text-ink-subtle mt-1 text-xs whitespace-pre-wrap">
                <HighlightedMentionText body={post.body} />
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

/** 메시지 본문에서 공백 뒤의 @멘션을 브랜드 색상으로 구분해 렌더링한다. */
function HighlightedMentionText({ body }: { body: string }) {
  return body.split(/((?:^|\s)@[^\s@]+)/u).map((segment, index) => {
    const mention = segment.match(/^(\s?)(@[^\s@]+)$/u)
    if (mention === null) return segment

    return (
      <Fragment key={`${mention[2]}-${index}`}>
        {mention[1]}
        <span className="text-primary font-semibold">{mention[2]}</span>
      </Fragment>
    )
  })
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
  if (video.status === 'failed') return '영상 처리를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'
  if (video.status === 'waiting_upload') return '영상을 올리고 있어요…'
  return '영상 준비 중…'
}

/** 메시지 마지막 단어에서 현재 작성 중인 @ 멘션 검색어를 추출한다. */
function getActiveMentionQuery(value: string) {
  const match = value.match(/(?:^|\s)@([^\s@]*)$/u)
  return match?.[1] ?? null
}

/** 현재 @ 검색어와 일치하는 책방 멤버 후보를 반환한다. */
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

/** 멤버 목록에서 현재 로그인한 사용자의 책방 멤버 식별자를 반환한다. */
function getCurrentUserMemberId(candidates: readonly VideoFilterMember[]): string | null {
  return candidates.find((candidate) => candidate.isCurrentUser)?.id ?? null
}

/** 메시지 작성자가 현재 책방 멤버인지 안전하게 비교한다. */
function isCurrentMemberMessage(
  authorMemberId: string | null,
  currentMemberId: string | null,
): boolean {
  return authorMemberId !== null && authorMemberId === currentMemberId
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
