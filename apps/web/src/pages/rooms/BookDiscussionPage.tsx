import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useEffect, useRef, useState, type RefObject } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ActionButton as SeedActionButton, TextField } from '@seed-design/react'

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
  bookRatingKeys,
  calculateAverageRating,
  getBookChatRatings,
  removeBookChatRating,
  upsertBookChatRating,
  type BookChatRating,
  type BookRatingInput,
} from '../../entities/book-rating'
import {
  createMuxThumbnailUrl,
  getVideoFilterMembers,
  getVideoPlaybackAuthorization,
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
  insertQuoteIntoDraft,
  PhotoQuoteFlow,
  type PhotoQuoteInsert,
} from '../../features/photo-quote'
import {
  invalidateRatingQueries,
  RatingForm,
  removeBookRatingFromCache,
  storeBookRatingInCache,
} from '../../features/book-rating'
import { useAuthenticatedUser } from '../../features/auth'
import { readingRoomKeys } from '../../entities/reading-room'
import {
  createManagedRoomInvite,
  getRoomManagement,
  requestManagedRoomInvite,
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
import { LazyMuxVideoPlayer } from '../../shared/ui/LazyMuxVideoPlayer'
import { BookLoadingIndicator, BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RatingStars } from '../../shared/ui/RatingStars'
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
  const [isRatingSheetOpen, setIsRatingSheetOpen] = useState(false)
  const [isRatingEditorOpen, setIsRatingEditorOpen] = useState(false)
  const [createdInvite, setCreatedInvite] = useState<CreatedManagedRoomInvite | null>(null)
  const [inviteRequestMessage, setInviteRequestMessage] = useState<string | null>(null)
  const [inviteShareError, setInviteShareError] = useState<string | null>(null)
  const [isInviteShareSheetOpen, setIsInviteShareSheetOpen] = useState(false)
  const ratingTriggerRef = useRef<HTMLButtonElement>(null)
  const inviteShareTriggerRef = useRef<HTMLButtonElement>(null)
  const {
    errorMessage: videoErrorMessage,
    isUploadingVideo,
    uploadVideo,
  } = useVideoUpload(bookChatId)
  const postsQuery = useQuery({
    enabled: Boolean(roomId && bookChatId),
    queryFn: () => getPosts(createSupabaseClient(), roomId ?? '', bookChatId ?? ''),
    queryKey: postKeys.byBookChat(roomId ?? '', bookChatId ?? ''),
  })
  const bookChatQuery = useQuery({
    enabled: Boolean(roomId && bookChatId),
    queryFn: () => getManagedBookChat(createSupabaseClient(), roomId ?? '', bookChatId ?? ''),
    queryKey: bookChatKeys.detail(roomId ?? '', bookChatId ?? ''),
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
  const inviteRequestMutation = useMutation({
    mutationFn: () => requestManagedRoomInvite(createSupabaseClient(), roomId ?? ''),
    onSuccess: (isCreated) => {
      setInviteRequestMessage(
        isCreated ? '방장에게 책방 초대를 요청했어요.' : '방장이 아직 초대 요청을 확인하고 있어요.',
      )
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
  const ratingsQuery = useQuery({
    enabled: Boolean(bookChatId) && isRatingSheetOpen,
    queryFn: () => getBookChatRatings(createSupabaseClient(), bookChatId ?? '', profileId),
    queryKey: bookRatingKeys.byChat(bookChatId ?? ''),
  })
  const ratingMutation = useMutation({
    mutationFn: (input: BookRatingInput) => upsertBookChatRating(createSupabaseClient(), input),
    onSuccess: (_result, input) => {
      storeBookRatingInCache(queryClient, { ...input, profileId })
      setIsRatingEditorOpen(false)
      trackAnalyticsEvent('book_rated')
      invalidateRatingQueries(queryClient, input.bookChatId, profileId)
    },
  })
  const ratingRemovalMutation = useMutation({
    mutationFn: (targetBookChatId: string) =>
      removeBookChatRating(createSupabaseClient(), targetBookChatId),
    onSuccess: (_result, targetBookChatId) => {
      removeBookRatingFromCache(queryClient, { bookChatId: targetBookChatId, profileId })
      invalidateRatingQueries(queryClient, targetBookChatId, profileId)
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
      await queryClient.invalidateQueries({
        queryKey: postKeys.byBookChat(roomId ?? '', bookChatId),
      })
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

  /** 별점 시트를 열어 현재 책의 평균 별점과 멤버 별점을 확인한다. */
  function handleOpenRatingSheet() {
    setIsRatingEditorOpen(false)
    setIsRatingSheetOpen(true)
  }

  /** 별점 시트를 닫고 메시지 추가 버튼으로 포커스를 돌려준다. */
  function handleCloseRatingSheet() {
    setIsRatingEditorOpen(false)
    setIsRatingSheetOpen(false)
    ratingTriggerRef.current?.focus()
  }

  /** 별점 요약에서 내 별점과 총평을 작성하거나 수정하는 상태로 전환한다. */
  function handleOpenRatingEditor() {
    ratingMutation.reset()
    ratingRemovalMutation.reset()
    setIsRatingEditorOpen(true)
  }

  /** 별점 작성 상태를 닫고 현재의 별점 요약으로 돌아간다. */
  function handleCloseRatingEditor() {
    setIsRatingEditorOpen(false)
  }

  /** 작성한 별점과 총평을 현재 책 대화의 개인 별점으로 저장한다. */
  function handleSaveRating(input: BookRatingInput) {
    ratingMutation.mutate(input)
  }

  /** 불러오지 못한 책 대화 별점을 다시 조회한다. */
  function handleRetryRatings() {
    void ratingsQuery.refetch()
  }

  /** 현재 사용자의 별점을 삭제하고 관련 목록을 최신 상태로 갱신한다. */
  function handleRemoveRating() {
    if (!bookChatId) return
    ratingRemovalMutation.mutate(bookChatId)
  }

  /** 방장 또는 운영자가 새 초대 코드를 만들거나 이미 만든 초대를 공유 시트로 연다. */
  function handleOpenRoomInvite() {
    if (createdInvite !== null) {
      setIsInviteShareSheetOpen(true)
      return
    }
    inviteMutation.mutate()
  }

  /** 현재 책방의 방장과 운영자에게 친구 초대를 요청한다. */
  function handleRequestRoomInvite() {
    setInviteRequestMessage(null)
    inviteRequestMutation.mutate()
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

  if (!roomId || !bookChatId) return <main className="bg-surface min-h-dvh" />
  const roots = postsQuery.data?.filter((post) => post.depth === 0) ?? []
  return (
    <main className="app-page bg-surface talkhugam-safe-bottom flex min-h-dvh flex-col px-4">
      <AppHeader
        action={
          <SeedActionButton
            aria-label="책 대화 관리"
            className="text-ink min-h-11 min-w-11 text-xl"
            onClick={() => void navigate(`/rooms/${roomId}/books/${bookChatId}/manage`)}
            size="medium"
            type="button"
            variant="ghost"
          >
            ⋯
          </SeedActionButton>
        }
        onBack={() => void navigate(`/rooms/${roomId}`)}
        title={roomQuery.data?.name ?? '책방'}
      />
      <header className="mt-8">
        <h1 className="text-ink text-xl font-bold">
          {bookChatQuery.data?.title ?? '책을 불러오고 있어요.'}
        </h1>
      </header>
      <section className="mt-8 flex-1">
        {postsQuery.isPending && videosQuery.isPending ? (
          <BookLoadingIndicator label="대화를 불러오고 있어요." size="sm" />
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
            thumbnailsByPostId={thumbnailsByPostId}
          />
        )}
      </section>
      <ChatComposer
        bookChatId={bookChatId}
        canCreateRoomInvite={roomManagementQuery.data?.canCurrentUserManageContent ?? false}
        inviteTriggerRef={inviteShareTriggerRef}
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
        onOpenRating={handleOpenRatingSheet}
        onOpenRoomInvite={handleOpenRoomInvite}
        onRequestRoomInvite={handleRequestRoomInvite}
        onRetryMentionMembers={() => void membersQuery.refetch()}
        onSelectVideo={uploadVideo}
        onSubmit={() => void handleSubmit()}
        ratingTriggerRef={ratingTriggerRef}
        hasMentionMemberError={membersQuery.isError}
        isRequestingRoomInvite={inviteRequestMutation.isPending}
        isUploadingVideo={isUploadingVideo}
        value={draft}
      />
      {inviteRequestMessage ? (
        <p className="text-primary mt-2 text-sm" role="status">
          {inviteRequestMessage}
        </p>
      ) : null}
      {inviteRequestMutation.isError ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          방장에게 초대 요청을 보내지 못했어요. 다시 시도해 주세요.
        </p>
      ) : null}
      {isRatingSheetOpen ? (
        <RatingSheet
          bookChatId={bookChatId}
          canEdit={bookChatQuery.data?.status !== 'archived'}
          errorMessage={getRatingMutationErrorMessage(
            ratingMutation.isError,
            ratingRemovalMutation.isError,
          )}
          isEditorOpen={isRatingEditorOpen}
          isError={ratingsQuery.isError && ratingsQuery.data === undefined}
          isLoading={ratingsQuery.isPending}
          isRetrying={ratingsQuery.isFetching}
          isSaving={ratingMutation.isPending || ratingRemovalMutation.isPending}
          onClose={handleCloseRatingSheet}
          onCloseEditor={handleCloseRatingEditor}
          onOpenEditor={handleOpenRatingEditor}
          onRemove={handleRemoveRating}
          onRetry={handleRetryRatings}
          onSave={handleSaveRating}
          ratings={ratingsQuery.data ?? []}
          returnFocusRef={ratingTriggerRef}
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
  onReply: (id: string) => void
  onRetry: () => void
  posts: DiscussionPost[]
  retryMessage: string | null
  thumbnailsByPostId: ReadonlyMap<string, VideoThumbnailAuthorization>
  videos: VideoPost[]
}) {
  const [activeTab, setActiveTab] = useState<'reviews' | 'videos'>('reviews')
  const errorMessage =
    getDiscussionTimelineErrorMessage(hasPostError, hasVideoError) ?? retryMessage
  const isShowingLoadingFeedback = hasPendingQuery || isRetrying
  const loadingLabel = isRetrying ? '대화를 다시 불러오고 있어요.' : '대화를 불러오고 있어요.'
  const visiblePosts = activeTab === 'reviews' ? posts : []
  const visibleVideos = activeTab === 'videos' ? videos : []

  return (
    <div className="space-y-4">
      <div
        aria-label="대화 종류"
        className="border-border grid grid-cols-2 overflow-hidden rounded-md border"
        role="tablist"
      >
        <button
          aria-selected={activeTab === 'reviews'}
          className={`min-h-11 text-sm font-semibold ${
            activeTab === 'reviews' ? 'talkhugam-tab--selected' : 'bg-surface text-ink-subtle'
          }`}
          onClick={() => setActiveTab('reviews')}
          role="tab"
          type="button"
        >
          책갈피
        </button>
        <button
          aria-selected={activeTab === 'videos'}
          className={`border-border min-h-11 border-l text-sm font-semibold ${
            activeTab === 'videos' ? 'talkhugam-tab--selected' : 'bg-surface text-ink-subtle'
          }`}
          onClick={() => setActiveTab('videos')}
          role="tab"
          type="button"
        >
          영상
        </button>
      </div>
      {errorMessage ? (
        <RetryState isRetrying={isRetrying} message={errorMessage} onRetry={onRetry} />
      ) : null}
      <ChatTimeline
        allPosts={allPosts}
        currentMemberId={currentMemberId}
        onReply={onReply}
        isThumbnailLoading={isThumbnailLoading}
        posts={visiblePosts}
        showEmptyState={!errorMessage && !hasPendingQuery}
        videos={visibleVideos}
        thumbnailsByPostId={thumbnailsByPostId}
      />
      {isShowingLoadingFeedback ? <BrandLoadingSpinner label={loadingLabel} size="xs" /> : null}
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

/** 별점 저장·삭제 실패를 구분해 사용자에게 보여 줄 안내 문구를 고른다. */
function getRatingMutationErrorMessage(hasSaveError: boolean, hasRemoveError: boolean) {
  if (hasRemoveError) return '별점을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.'
  if (hasSaveError) return '별점을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
  return null
}

type RatingSheetProps = {
  bookChatId: string
  canEdit: boolean
  errorMessage: string | null
  isEditorOpen: boolean
  isError: boolean
  isLoading: boolean
  isRetrying: boolean
  isSaving: boolean
  onClose: () => void
  onCloseEditor: () => void
  onOpenEditor: () => void
  onRemove: () => void
  onRetry: () => void
  onSave: (input: BookRatingInput) => void
  ratings: BookChatRating[]
  returnFocusRef: RefObject<HTMLElement | null>
}

/** 평균 별점과 멤버별 별점·총평, 내 별점 작성·수정·삭제를 하단 시트로 렌더링한다. */
function RatingSheet({ onClose, returnFocusRef, ...bodyProps }: RatingSheetProps) {
  return (
    <BottomSheet onClose={onClose} returnFocusRef={returnFocusRef} title="별점">
      <RatingSheetBody {...bodyProps} />
    </BottomSheet>
  )
}

/**
 * 별점 시트 본문을 조회 상태에 맞게 렌더링한다. 조회 중이거나 실패했을 때는 빈 입력으로
 * 기존 별점을 덮어쓰지 않도록 작성·수정·삭제를 숨기고, 보관된 책 대화에서는 읽기만 허용한다.
 */
function RatingSheetBody({
  bookChatId,
  canEdit,
  errorMessage,
  isEditorOpen,
  isError,
  isLoading,
  isRetrying,
  isSaving,
  onCloseEditor,
  onOpenEditor,
  onRemove,
  onRetry,
  onSave,
  ratings,
}: Omit<RatingSheetProps, 'onClose' | 'returnFocusRef'>) {
  if (isLoading) return <BookLoadingIndicator label="별점을 불러오고 있어요." size="xs" />
  if (isError)
    return (
      <RetryState
        isRetrying={isRetrying}
        message="별점을 불러오지 못했어요. 다시 시도해 주세요."
        onRetry={onRetry}
        retryLabel="별점 다시 시도"
      />
    )

  const ownRating = ratings.find((rating) => rating.isMe)
  const isEditing = canEdit && isEditorOpen
  return (
    <>
      {isEditing ? (
        <RatingForm
          bookChatId={bookChatId}
          initialRating={ownRating?.rating ?? null}
          initialReview={ownRating?.review ?? null}
          isSaving={isSaving}
          key={ownRating?.updatedAt ?? 'new-rating'}
          onCancel={onCloseEditor}
          onSave={onSave}
          submitLabel={ownRating ? '별점 수정' : '별점 저장'}
        />
      ) : (
        <RatingSummary
          averageRating={calculateAverageRating(ratings)}
          canEdit={canEdit}
          hasOwnRating={Boolean(ownRating)}
          isSaving={isSaving}
          onOpenEditor={onOpenEditor}
          onRemove={onRemove}
          ratingCount={ratings.length}
        />
      )}
      {errorMessage ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {!isEditing ? <MemberRatingList ratings={ratings} /> : null}
    </>
  )
}

/** 평균 별점과, 편집할 수 있을 때 현재 사용자의 별점 여부에 맞는 작성·수정·삭제 CTA를 렌더링한다. */
function RatingSummary({
  averageRating,
  canEdit,
  hasOwnRating,
  isSaving,
  onOpenEditor,
  onRemove,
  ratingCount,
}: {
  averageRating: number | null
  canEdit: boolean
  hasOwnRating: boolean
  isSaving: boolean
  onOpenEditor: () => void
  onRemove: () => void
  ratingCount: number
}) {
  return (
    <div className="border-ink/10 mt-4 border-t pt-4">
      <p className="text-ink text-sm font-semibold tabular-nums">
        {averageRating === null ? '아직 평균 별점이 없어요' : `평균 ${averageRating}`}
        <span className="text-ink-subtle ml-2 font-normal">{ratingCount}명 참여</span>
      </p>
      {canEdit ? (
        <RatingActions
          hasOwnRating={hasOwnRating}
          isSaving={isSaving}
          onOpenEditor={onOpenEditor}
          onRemove={onRemove}
        />
      ) : null}
    </div>
  )
}

/** 현재 사용자의 별점 여부에 맞는 작성·수정·삭제 버튼을 렌더링한다. */
function RatingActions({
  hasOwnRating,
  isSaving,
  onOpenEditor,
  onRemove,
}: {
  hasOwnRating: boolean
  isSaving: boolean
  onOpenEditor: () => void
  onRemove: () => void
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <SeedActionButton
        className="talkhugam-foundation-action--outline"
        disabled={isSaving}
        onClick={onOpenEditor}
        size="medium"
        type="button"
        variant="neutralOutline"
      >
        {hasOwnRating ? '별점 수정' : '별점 남기기'}
      </SeedActionButton>
      {hasOwnRating ? (
        <SeedActionButton
          className="talkhugam-foundation-action--outline"
          disabled={isSaving}
          onClick={onRemove}
          size="medium"
          type="button"
          variant="neutralOutline"
        >
          별점 삭제
        </SeedActionButton>
      ) : null}
    </div>
  )
}

/** 책방 멤버가 남긴 별점과 총평을 목록으로 렌더링한다. */
function MemberRatingList({ ratings }: { ratings: BookChatRating[] }) {
  if (ratings.length === 0)
    return <p className="text-ink-subtle mt-4 text-sm">아직 별점을 남긴 멤버가 없어요.</p>

  return (
    <ul className="mt-4 space-y-3" aria-label="멤버 별점">
      {ratings.map((rating) => (
        <li
          className="border-ink/10 border-t pt-3 first:border-t-0 first:pt-0"
          key={rating.profileId}
        >
          <p className="text-ink text-sm font-semibold">
            {rating.isMe ? '나' : rating.displayName}
          </p>
          <p className="mt-1">
            <RatingStars rating={rating.rating} />
          </p>
          {rating.review ? <p className="text-ink-subtle mt-1 text-sm">{rating.review}</p> : null}
        </li>
      ))}
    </ul>
  )
}

/** 대화 입력창 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function ChatComposer({
  bookChatId,
  canCreateRoomInvite,
  errorMessage,
  hasMentionMemberError,
  isReplying,
  isRequestingRoomInvite,
  isUploadingVideo,
  labels,
  mentionCandidates,
  onCancelReply,
  onChangeDraft,
  onChangeLabels,
  onChangeMentionedMemberIds,
  onOpenRating,
  onOpenRoomInvite,
  onRequestRoomInvite,
  onOpenVideoArchive,
  onRetryMentionMembers,
  onSelectVideo,
  onSubmit,
  ratingTriggerRef,
  value,
  inviteTriggerRef,
}: {
  bookChatId: string | undefined
  canCreateRoomInvite: boolean
  errorMessage: string | null
  hasMentionMemberError: boolean
  isReplying: boolean
  isRequestingRoomInvite: boolean
  isUploadingVideo: boolean
  labels: PostForm['labels']
  mentionCandidates: VideoFilterMember[]
  onCancelReply: () => void
  onChangeDraft: (value: string) => void
  onChangeLabels: (labels: PostForm['labels']) => void
  onChangeMentionedMemberIds: (mentionedMemberIds: PostForm['mentionedMemberIds']) => void
  onOpenRating: () => void
  onOpenRoomInvite: () => void
  onRequestRoomInvite: () => void
  onOpenVideoArchive: () => void
  onRetryMentionMembers: () => void
  onSelectVideo: (file: File | undefined) => void
  onSubmit: () => void
  ratingTriggerRef: RefObject<HTMLButtonElement | null>
  value: string
  inviteTriggerRef: RefObject<HTMLButtonElement | null>
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoQuoteFile, setPhotoQuoteFile] = useState<File | null>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const actionMenuButtonRef = useRef<HTMLButtonElement>(null)
  const firstActionButtonRef = useRef<HTMLButtonElement>(null)
  const mentionMenuRef = useRef<HTMLDivElement>(null)
  const shouldRestoreActionTrayFocusRef = useRef(true)
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
    handleCloseActionTray(false)
    window.setTimeout(() => messageInputRef.current?.focus(), 250)
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

  /** 사진에서 확인한 인용 문장을 입력창 끝에 넣고, 쪽이 있으면 페이지 라벨을 그 쪽으로 바꾼다. */
  function handleInsertPhotoQuote({ page, quote }: PhotoQuoteInsert) {
    handleChangeMessage(insertQuoteIntoDraft(value, quote))
    const pageLabel = page && !isReplying ? createDraftLabel('page', page) : null
    if (pageLabel) onChangeLabels([...labels.filter((label) => label.kind !== 'page'), pageLabel])
    handleClosePhotoQuote()
  }

  /** 사진 인식 화면을 닫고 사진 파일 참조를 버린 뒤 메시지 입력으로 포커스를 돌려준다. */
  function handleClosePhotoQuote() {
    setPhotoQuoteFile(null)
    window.requestAnimationFrame(() => messageInputRef.current?.focus())
  }

  /** 복귀 To 라벨 선택 요청이나 사용자 동작을 처리한다. */
  function handleReturnToLabelSelection() {
    setLabelKind(null)
    window.requestAnimationFrame(() => firstActionButtonRef.current?.focus())
  }

  /** 라벨 임시 입력을 비우고 메시지 추가 메뉴를 닫는다. */
  function handleCloseActionTray(shouldRestoreFocus = true) {
    shouldRestoreActionTrayFocusRef.current = shouldRestoreFocus
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
    shouldRestoreActionTrayFocusRef.current = true
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
    }

    /** Escape 키 요청이나 사용자 동작을 처리한다. */
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (shouldShowMentionMenu) {
        setIsMentionMenuDismissed(true)
        messageInputRef.current?.focus()
        return
      }
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [shouldShowMentionMenu])

  return (
    <section className="border-ink/10 relative mt-6 border-t pt-4">
      {isReplying ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-ink-subtle text-xs">답글 남기기</p>
          <SeedActionButton onClick={onCancelReply} size="small" type="button" variant="ghost">
            취소
          </SeedActionButton>
        </div>
      ) : null}
      {labels.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="선택한 라벨">
          {labels.map((label, index) => (
            <li
              className="border-border text-ink-subtle flex min-h-8 items-center gap-1 rounded-md border bg-white px-2 text-xs"
              key={`${label.kind}-${label.value}`}
            >
              {formatLabel(label)}
              <SeedActionButton
                aria-label={`${formatLabel(label)} 삭제`}
                className="min-h-6 min-w-6"
                onClick={() => handleRemoveLabel(index)}
                size="small"
                type="button"
                variant="ghost"
              >
                ×
              </SeedActionButton>
            </li>
          ))}
        </ul>
      ) : null}
      {isActionTrayOpen ? (
        <BottomSheet
          onClose={handleCloseActionTray}
          returnFocusRef={actionMenuButtonRef}
          shouldRestoreFocus={() => shouldRestoreActionTrayFocusRef.current}
          title={
            labelKind === 'page'
              ? '페이지 라벨'
              : labelKind === 'chapter'
                ? '챕터 라벨'
                : '메시지 추가'
          }
        >
          {labelKind ? (
            <div className="space-y-3">
              <div className="mb-2 flex min-h-11 items-center gap-2">
                <SeedActionButton
                  aria-label="라벨 종류 선택으로 돌아가기"
                  onClick={handleReturnToLabelSelection}
                  type="button"
                  variant="ghost"
                >
                  이전
                </SeedActionButton>
              </div>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="post-label-value">
                  {labelKind === 'page' ? '페이지 번호' : '챕터 이름 또는 번호'}
                </label>
                <TextField.Root className="talkhugam-information-field min-w-0 flex-1">
                  <TextField.Input
                    autoFocus
                    aria-label={labelKind === 'page' ? '페이지 번호' : '챕터 이름 또는 번호'}
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
                </TextField.Root>
                <SeedActionButton
                  aria-label="라벨 추가"
                  className="talkhugam-primary-action"
                  onClick={handleAddLabel}
                  type="button"
                >
                  추가
                </SeedActionButton>
              </div>
            </div>
          ) : (
            <div className="talkhugam-action-sheet-list">
              <SeedActionButton
                className="talkhugam-action-sheet-choice"
                disabled={isReplying}
                onClick={() => setLabelKind('page')}
                ref={firstActionButtonRef}
                variant="neutralWeak"
              >
                페이지 라벨
              </SeedActionButton>
              <SeedActionButton
                className="talkhugam-action-sheet-choice"
                disabled={isReplying}
                onClick={() => setLabelKind('chapter')}
                variant="neutralWeak"
              >
                챕터 라벨
              </SeedActionButton>
              <SeedActionButton
                className="talkhugam-action-sheet-choice"
                onClick={() => {
                  handleCloseActionTray(false)
                  fileInputRef.current?.click()
                }}
                variant="neutralWeak"
              >
                영상 올리기
              </SeedActionButton>
              <SeedActionButton
                className="talkhugam-action-sheet-choice"
                disabled={!bookChatId}
                onClick={() => {
                  handleCloseActionTray(false)
                  photoInputRef.current?.click()
                }}
                variant="neutralWeak"
              >
                사진에서 문장 가져오기
              </SeedActionButton>
              <SeedActionButton
                className="talkhugam-action-sheet-choice"
                onClick={() => {
                  handleCloseActionTray(false)
                  onOpenVideoArchive()
                }}
                variant="neutralWeak"
              >
                영상 기록
              </SeedActionButton>
              <SeedActionButton
                className="talkhugam-action-sheet-choice"
                onClick={() => {
                  ratingTriggerRef.current = actionMenuButtonRef.current
                  handleCloseActionTray(false)
                  onOpenRating()
                }}
                variant="neutralWeak"
              >
                별점
              </SeedActionButton>
              {canCreateRoomInvite ? (
                <SeedActionButton
                  className="talkhugam-action-sheet-choice"
                  onClick={() => {
                    handleCloseActionTray(false)
                    onOpenRoomInvite()
                  }}
                  ref={inviteTriggerRef}
                  variant="neutralWeak"
                >
                  책방 초대하기
                </SeedActionButton>
              ) : (
                <SeedActionButton
                  className="talkhugam-action-sheet-choice"
                  disabled={isRequestingRoomInvite}
                  onClick={() => {
                    handleCloseActionTray()
                    onRequestRoomInvite()
                  }}
                  variant="neutralWeak"
                >
                  초대 요청
                </SeedActionButton>
              )}
            </div>
          )}
        </BottomSheet>
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
        <input
          accept="image/*"
          aria-label="문장을 가져올 사진 선택"
          className="sr-only"
          onChange={(event) => {
            setPhotoQuoteFile(event.target.files?.[0] ?? null)
            event.target.value = ''
          }}
          ref={photoInputRef}
          type="file"
        />
        <SeedActionButton
          aria-expanded={isActionTrayOpen}
          aria-label={isActionTrayOpen ? '메시지 추가 메뉴 닫기' : '메시지 추가 메뉴 열기'}
          className="!size-11 shrink-0 rounded-full p-0"
          onClick={handleToggleActionTray}
          ref={actionMenuButtonRef}
          type="button"
          variant="neutralOutline"
        >
          <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
            <path
              className={`origin-center transition-transform duration-300 motion-reduce:transition-none ${
                isActionTrayOpen ? 'rotate-45' : ''
              }`}
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>
        </SeedActionButton>
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
                  <SeedActionButton
                    className="border-ink/10 text-ink min-h-11 rounded-md border"
                    onClick={onRetryMentionMembers}
                    size="medium"
                    type="button"
                    variant="neutralOutline"
                  >
                    다시 시도
                  </SeedActionButton>
                </div>
              ) : matchingMentionCandidates.length > 0 ? (
                <div aria-label="멘션할 멤버" id="mention-candidates" role="listbox">
                  {matchingMentionCandidates.map((member) => (
                    <SeedActionButton
                      aria-label={`${member.displayName} 멘션 추가`}
                      className="hover:!bg-surface-muted text-ink min-h-11 w-full justify-start rounded-md px-3 text-left"
                      key={member.id}
                      onClick={() => handleSelectMention(member)}
                      role="option"
                      size="medium"
                      type="button"
                      variant="ghost"
                    >
                      @{member.displayName}
                    </SeedActionButton>
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
          <TextField.Root className="!h-11 !min-h-11">
            <TextField.Textarea
              aria-autocomplete="list"
              aria-controls={shouldShowMentionMenu ? 'mention-candidates' : undefined}
              aria-label="메시지 입력"
              autoresize={false}
              className="!h-11 !min-h-11 text-base"
              id="discussion-message"
              onChange={(event) => handleChangeMessage(event.target.value)}
              onKeyDown={(event) => {
                if (!shouldSubmitMessage(event.key, event.shiftKey)) return
                event.preventDefault()
                onSubmit()
              }}
              placeholder={isReplying ? '답글을 입력하세요' : '메시지 입력'}
              ref={messageInputRef}
              value={value}
            />
          </TextField.Root>
        </div>
        <SeedActionButton
          className="talkhugam-primary-action !h-11 !min-h-11 shrink-0"
          disabled={value.trim().length === 0 && labels.length === 0}
          onClick={onSubmit}
          type="button"
        >
          전송
        </SeedActionButton>
      </div>
      {errorMessage ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {photoQuoteFile && bookChatId ? (
        <PhotoQuoteFlow
          bookChatId={bookChatId}
          file={photoQuoteFile}
          onClose={handleClosePhotoQuote}
          onInsert={handleInsertPhotoQuote}
        />
      ) : null}
      {isUploadingVideo ? (
        <div className="mt-3">
          <BookLoadingIndicator label="영상을 채팅에 올리고 있어요…" size="xs" />
        </div>
      ) : null}
    </section>
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
  onReply,
  posts,
  showEmptyState = true,
  thumbnailsByPostId,
  videos,
}: {
  allPosts: DiscussionPost[]
  currentMemberId: string | null
  isThumbnailLoading: boolean
  onReply: (id: string) => void
  posts: DiscussionPost[]
  showEmptyState?: boolean
  thumbnailsByPostId: ReadonlyMap<string, VideoThumbnailAuthorization>
  videos: VideoPost[]
}) {
  const messages = createChatMessages(posts, videos)
  if (messages.length === 0 && showEmptyState)
    return (
      <div className="border-border border-t border-b py-6 text-center">
        <p className="text-ink font-medium">첫 독후감을 남겨 보세요</p>
        <p className="text-ink-subtle mt-2 text-sm">페이지나 챕터 라벨만 먼저 남겨도 괜찮아요.</p>
      </div>
    )
  if (messages.length === 0) return null
  return (
    <ul className="space-y-4">
      {messages.map((message) => {
        if (message.type === 'text') {
          const isMine = isCurrentMemberMessage(message.post.authorMemberId, currentMemberId)

          return (
            <li
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              key={message.post.id}
            >
              <article
                className={`border-border w-fit max-w-[70%] rounded-lg border px-4 py-3 ${
                  isMine ? 'bg-ink text-white' : 'text-ink bg-white'
                }`}
              >
                <p className={`text-sm font-medium ${isMine ? 'text-white/70' : 'text-ink'}`}>
                  {message.post.authorName}
                </p>
                <PostLabels labels={message.post.labels} />
                {message.post.body ? (
                  <p
                    className={`mt-2 text-sm whitespace-pre-wrap ${
                      isMine ? 'text-white' : 'text-ink'
                    }`}
                  >
                    <HighlightedMentionText body={message.post.body} />
                  </p>
                ) : null}
                <SeedActionButton
                  className={`mt-2 ${isMine ? '!text-white/80' : '!text-ink-subtle'}`}
                  onClick={() => onReply(message.post.id)}
                  size="small"
                  type="button"
                  variant="ghost"
                >
                  답글 남기기
                </SeedActionButton>
                <Replies
                  currentMemberId={currentMemberId}
                  isInverted={isMine}
                  posts={allPosts.filter((reply) => reply.rootPostId === message.post.id)}
                />
              </article>
            </li>
          )
        }

        return (
          <li
            className={`flex ${
              isCurrentMemberMessage(message.video.authorMemberId, currentMemberId)
                ? 'justify-end'
                : 'justify-start'
            }`}
            key={message.video.id}
          >
            <VideoMessage
              canRecoverFailure={isCurrentMemberMessage(
                message.video.authorMemberId,
                currentMemberId,
              )}
              isThumbnailLoading={isThumbnailLoading}
              thumbnailAuthorization={thumbnailsByPostId.get(message.video.id)}
              video={message.video}
            />
          </li>
        )
      })}
    </ul>
  )
}

/** 영상 메시지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function VideoMessage({
  canRecoverFailure,
  isThumbnailLoading,
  thumbnailAuthorization,
  video,
}: {
  canRecoverFailure: boolean
  isThumbnailLoading: boolean
  thumbnailAuthorization: VideoThumbnailAuthorization | undefined
  video: VideoPost
}) {
  const navigate = useNavigate()
  const { bookChatId, roomId } = useParams()
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasPlaybackMediaError, setHasPlaybackMediaError] = useState(false)
  const playbackQuery = useQuery({
    enabled: video.status === 'ready' && isPlaying,
    queryFn: fetchPlaybackAuthorization,
    queryKey: videoKeys.playback(video.id),
    staleTime: 4 * 60 * 1_000,
  })

  /** 현재 영상 메시지의 Mux 재생 권한을 요청해 inline 플레이어에 전달한다. */
  function fetchPlaybackAuthorization() {
    return getVideoPlaybackAuthorization(createSupabaseClient(), video.id)
  }

  /** 썸네일 프레임을 같은 자리의 재생 프레임으로 전환한다. */
  function handleStartPlayback() {
    setHasPlaybackMediaError(false)
    setIsPlaying(true)
  }

  /** Mux 플레이어가 전달한 재생 실패를 같은 프레임 안의 오류 상태로 바꾼다. */
  function handlePlaybackMediaError() {
    setHasPlaybackMediaError(true)
  }

  /** 실패한 재생 권한 또는 미디어 재생을 같은 영상 프레임에서 다시 시도한다. */
  function handleRetryPlayback() {
    setHasPlaybackMediaError(false)
    void playbackQuery.refetch()
  }

  if (video.status === 'ready')
    return isPlaying ? (
      <article
        aria-label={`${video.authorName}의 영상 재생`}
        className="border-ink/10 bg-ink relative aspect-video w-full max-w-full overflow-hidden rounded-lg border"
      >
        {playbackQuery.isPending ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookLoadingIndicator label="재생 정보를 불러오고 있어요." size="sm" tone="inverse" />
          </div>
        ) : playbackQuery.isError || hasPlaybackMediaError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm font-medium text-white" role="alert">
              영상을 재생하지 못했어요.
            </p>
            <SeedActionButton
              className="!border-white/40 !text-white"
              onClick={handleRetryPlayback}
              size="small"
              type="button"
              variant="neutralOutline"
            >
              다시 시도
            </SeedActionButton>
          </div>
        ) : playbackQuery.data ? (
          <LazyMuxVideoPlayer
            className="absolute inset-0 size-full"
            metadata={{ videoId: video.id, videoTitle: `${video.authorName}의 영상` }}
            onPlaybackError={handlePlaybackMediaError}
            playbackId={playbackQuery.data.playbackId}
            tone="inverse"
            tokens={{
              playback: playbackQuery.data.token,
              thumbnail: playbackQuery.data.thumbnailToken,
            }}
          />
        ) : null}
      </article>
    ) : (
      <SeedActionButton
        aria-label={`${video.authorName}님의 영상 보기`}
        className="border-ink/10 bg-ink relative aspect-video !h-auto w-full max-w-full overflow-hidden rounded-lg border p-0 text-left"
        onClick={handleStartPlayback}
        size="large"
        type="button"
        variant="ghost"
      >
        <div className="relative size-full">
          {thumbnailAuthorization ? (
            <img
              alt=""
              className="absolute inset-0 size-full object-cover"
              decoding="async"
              loading="lazy"
              src={createMuxThumbnailUrl(thumbnailAuthorization)}
            />
          ) : isThumbnailLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <BookLoadingIndicator label="미리보기를 준비하고 있어요." size="sm" tone="inverse" />
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
      </SeedActionButton>
    )
  const message = getVideoMessageLabel(video)
  const isLoading = video.status !== 'failed'
  return (
    <article className="border-ink/10 bg-ink flex aspect-video w-full max-w-full flex-col items-center justify-center rounded-lg border px-4 text-center">
      {isLoading ? (
        <BookLoadingIndicator label={message} size="sm" tone="inverse" />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="talkhugam-balanced-copy text-sm font-medium text-white" role="alert">
            {canRecoverFailure ? `${message} 지우고 다시 올려 주세요.` : message}
          </p>
          {canRecoverFailure ? (
            <SeedActionButton
              className="!border-white/40 !text-white"
              onClick={() => void navigate(`/rooms/${roomId}/books/${bookChatId}/videos`)}
              size="small"
              type="button"
              variant="neutralOutline"
            >
              영상 기록에서 정리하기
            </SeedActionButton>
          ) : null}
        </div>
      )}
    </article>
  )
}

/** 비율형 영상 미리보기 위에 재생 가능 여부를 나타내는 제어 아이콘을 렌더링한다. */
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
          className="border-border text-ink-subtle rounded-md border bg-white px-2 py-1 text-xs"
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
  isInverted = false,
  posts,
}: {
  currentMemberId: string | null
  isInverted?: boolean
  posts: DiscussionPost[]
}) {
  if (posts.length === 0) return null
  return (
    <ul
      className={`mt-3 space-y-3 border-l pl-3 ${isInverted ? 'border-white/20' : 'border-border'}`}
    >
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
            <p className={`text-xs font-medium ${isInverted ? 'text-white/70' : 'text-ink'}`}>
              {post.authorName}
            </p>
            {post.body ? (
              <p
                className={`mt-1 text-xs whitespace-pre-wrap ${
                  isInverted ? 'text-white/80' : 'text-ink-subtle'
                }`}
              >
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
  if (video.status === 'failed') return '영상을 처리하지 못했어요.'
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
