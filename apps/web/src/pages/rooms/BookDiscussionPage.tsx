import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  EmojiPicker,
  type Emoji,
  type EmojiPickerListCategoryHeaderProps,
  type EmojiPickerListEmojiProps,
  type EmojiPickerListRowProps,
} from 'frimousse'
import { Fragment, useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ActionButton as SeedActionButton, TextField } from '@seed-design/react'

import { bookChatKeys, getManagedBookChat, getReadingRoom } from '../../entities/book-chat'
import {
  createPost,
  createReply,
  getPostReactions,
  getPosts,
  parsePostForm,
  postKeys,
  shouldSubmitMessage,
  togglePostReaction,
  type DiscussionPost,
  type PostForm,
  type PostReactionEmoji,
  type PostReactionSummary,
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
import { CompletionMark } from '../../shared/ui/CompletionMark'
import { BookLoadingIndicator, BrandLoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

type LabelKind = 'page' | 'chapter'
type ReplyTarget = Pick<DiscussionPost, 'authorName' | 'body' | 'id'>
type ReactionPickerPlacement = 'bottom' | 'top'
type BookChatTab = 'talk' | 'bookmark'
type EmojiCategoryTab = {
  index: number
  label: string
}

const VISIBLE_REACTION_SUMMARY_COUNT = 3
const REACTION_PICKER_HEIGHT = 440
const QUICK_REACTION_EMOJIS = ['❤️', '👍', '👎', '😢'] as const

/** 책 Discussion 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function BookDiscussionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { bookChatId, roomId } = useParams()
  const profileId = useAuthenticatedUser().id
  const [draft, setDraft] = useState('')
  const [labels, setLabels] = useState<PostForm['labels']>([])
  const [mentionedMemberIds, setMentionedMemberIds] = useState<PostForm['mentionedMemberIds']>([])
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRetryingTimeline, setIsRetryingTimeline] = useState(false)
  const [timelineRetryMessage, setTimelineRetryMessage] = useState<string | null>(null)
  const [isCompletionSheetOpen, setIsCompletionSheetOpen] = useState(false)
  const [isCompletionEditorOpen, setIsCompletionEditorOpen] = useState(false)
  const [createdInvite, setCreatedInvite] = useState<CreatedManagedRoomInvite | null>(null)
  const [inviteRequestMessage, setInviteRequestMessage] = useState<string | null>(null)
  const [inviteShareError, setInviteShareError] = useState<string | null>(null)
  const [isInviteShareSheetOpen, setIsInviteShareSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<BookChatTab>('talk')
  const isSubmittingPostRef = useRef(false)
  const completionTriggerRef = useRef<HTMLButtonElement>(null)
  const inviteShareTriggerRef = useRef<HTMLButtonElement>(null)
  const { errorMessage: videoErrorMessage, isUploadingVideo } = useVideoUpload(bookChatId)
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
  void roomManagementQuery
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
  const discussionPostIds = (postsQuery.data ?? []).map((post) => post.id)
  const currentMemberId = getCurrentUserMemberId(membersQuery.data ?? [])
  const reactionQueryKey = [...postKeys.reactions(bookChatId ?? ''), currentMemberId]
  const reactionsQuery = useQuery({
    enabled: discussionPostIds.length > 0 && !membersQuery.isPending,
    queryFn: () => getPostReactions(createSupabaseClient(), discussionPostIds, currentMemberId),
    queryKey: reactionQueryKey,
  })
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
  const reactionMutation = useMutation({
    mutationFn: ({ emoji, postId }: { emoji: PostReactionEmoji; postId: string }) =>
      togglePostReaction(createSupabaseClient(), postId, emoji),
    onMutate: async ({ emoji, postId }) => {
      await queryClient.cancelQueries({ queryKey: reactionQueryKey })
      const previousReactions =
        queryClient.getQueryData<Map<string, PostReactionSummary[]>>(reactionQueryKey) ??
        reactionsQuery.data ??
        new Map()
      queryClient.setQueryData(
        reactionQueryKey,
        toggleReactionSummary(previousReactions, postId, emoji),
      )
      return { previousReactions }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      queryClient.setQueryData(reactionQueryKey, context.previousReactions)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: postKeys.reactions(bookChatId ?? '') })
    },
  })

  /** 제출 요청이나 사용자 동작을 처리한다. */
  async function handleSubmit() {
    if (isSubmittingPostRef.current) return

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
    isSubmittingPostRef.current = true
    try {
      if (replyTo) await createReply(createSupabaseClient(), replyTo.id, parsed.value)
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
    } finally {
      isSubmittingPostRef.current = false
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

  /** 현재 책방의 방장에게 친구 초대를 요청한다. */
  function handleRequestRoomInvite() {
    setInviteRequestMessage(null)
    inviteRequestMutation.mutate()
  }

  void handleOpenCompletionSheet
  void handleOpenRoomInvite
  void handleRequestRoomInvite

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
        <h1 className="text-ink mt-2 text-xl font-bold">
          {bookChatQuery.data?.title ?? '책을 불러오고 있어요.'}
        </h1>
        <BookChatTabs activeTab={activeTab} onChange={setActiveTab} />
      </header>
      {activeTab === 'talk' ? (
        <>
          <section
            aria-labelledby="book-chat-talk-tab"
            className="mt-8 flex-1"
            id="book-chat-talk-panel"
            role="tabpanel"
          >
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
                onReact={(postId, emoji) => reactionMutation.mutate({ emoji, postId })}
                posts={roots}
                reactionsByPostId={reactionsQuery.data ?? new Map()}
                currentMemberId={currentMemberId}
                onRetry={handleRetryTimeline}
                retryMessage={timelineRetryMessage}
              />
            )}
          </section>
          <ChatComposer
            errorMessage={errorMessage ?? videoErrorMessage}
            key={bookChatId}
            labels={labels}
            mentionCandidates={(membersQuery.data ?? []).filter((member) => !member.isCurrentUser)}
            onCancelReply={() => setReplyTo(null)}
            onChangeDraft={setDraft}
            onChangeLabels={setLabels}
            onChangeMentionedMemberIds={setMentionedMemberIds}
            onRetryMentionMembers={() => void membersQuery.refetch()}
            onSubmit={() => void handleSubmit()}
            hasMentionMemberError={membersQuery.isError}
            isUploadingVideo={isUploadingVideo}
            replyTarget={replyTo}
            value={draft}
          />
        </>
      ) : (
        <BookmarkPanel
          isThumbnailLoading={thumbnailsQuery.isLoading}
          isUploadingVideo={isUploadingVideo}
          onCreateBookmark={() => void navigate(`/rooms/${roomId}/books/${bookChatId}/videos`)}
          onOpenVideo={(videoId) =>
            void navigate(`/rooms/${roomId}/books/${bookChatId}/videos/${videoId}`)
          }
          thumbnailsByPostId={thumbnailsByPostId}
          videos={videosQuery.data ?? []}
        />
      )}
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
          returnFocusRef={completionTriggerRef}
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

/** 현재 선택된 책 대화 영역을 대화와 책갈피 탭으로 전환한다. */
function BookChatTabs({
  activeTab,
  onChange,
}: {
  activeTab: BookChatTab
  onChange: (tab: BookChatTab) => void
}) {
  return (
    <div
      aria-label="책 대화 보기"
      className="bg-surface-muted border-ink/10 mt-4 grid grid-cols-2 gap-1 rounded-lg border p-1"
      role="tablist"
    >
      <SeedActionButton
        aria-controls="book-chat-talk-panel"
        aria-selected={activeTab === 'talk'}
        className={`min-h-11 rounded-md ${
          activeTab === 'talk' ? 'text-ink !bg-white shadow-sm' : 'text-ink-subtle'
        }`}
        onClick={() => onChange('talk')}
        role="tab"
        id="book-chat-talk-tab"
        size="medium"
        type="button"
        variant="ghost"
      >
        대화
      </SeedActionButton>
      <SeedActionButton
        aria-controls="book-chat-bookmark-panel"
        aria-selected={activeTab === 'bookmark'}
        className={`min-h-11 rounded-md ${
          activeTab === 'bookmark' ? 'text-ink !bg-white shadow-sm' : 'text-ink-subtle'
        }`}
        onClick={() => onChange('bookmark')}
        role="tab"
        id="book-chat-bookmark-tab"
        size="medium"
        type="button"
        variant="ghost"
      >
        책갈피
      </SeedActionButton>
    </div>
  )
}

/** 책갈피로 남긴 영상과 문장을 카드 목록 및 고정 작성 버튼으로 렌더링한다. */
function BookmarkPanel({
  isThumbnailLoading,
  isUploadingVideo,
  onCreateBookmark,
  onOpenVideo,
  thumbnailsByPostId,
  videos,
}: {
  isThumbnailLoading: boolean
  isUploadingVideo: boolean
  onCreateBookmark: () => void
  onOpenVideo: (videoId: string) => void
  thumbnailsByPostId: ReadonlyMap<string, VideoThumbnailAuthorization>
  videos: VideoPost[]
}) {
  return (
    <section
      aria-labelledby="book-chat-bookmark-tab"
      className="mt-6 flex-1 pb-20"
      id="book-chat-bookmark-panel"
      role="tabpanel"
    >
      <header className="mb-4">
        <p className="text-primary text-sm font-semibold">책갈피</p>
        <h2 className="text-ink mt-1 text-lg font-bold">함께 읽은 순간</h2>
        <p className="talkhugam-balanced-copy text-ink-subtle mt-1 text-sm">
          영상으로 남긴 책갈피를 모아 봐요.
        </p>
      </header>
      {isUploadingVideo ? (
        <div className="mb-4">
          <BookLoadingIndicator label="책갈피 영상을 올리고 있어요…" size="xs" />
        </div>
      ) : null}
      {videos.length > 0 ? (
        <ul aria-label="책갈피" className="space-y-3">
          {videos.map((video) => (
            <li key={video.id}>
              <BookmarkCard
                isThumbnailLoading={isThumbnailLoading}
                onOpen={() => onOpenVideo(video.id)}
                thumbnailAuthorization={thumbnailsByPostId.get(video.id)}
                video={video}
              />
            </li>
          ))}
        </ul>
      ) : (
        <BookmarkEmptyState />
      )}
      <div className="pointer-events-none fixed right-4 bottom-4 left-4 mx-auto flex max-w-[608px] justify-end">
        <SeedActionButton
          className="talkhugam-primary-action pointer-events-auto min-h-12 rounded-full px-4 shadow-lg"
          onClick={onCreateBookmark}
          size="large"
          type="button"
        >
          <span aria-hidden="true">+</span>
          <span>책갈피 남기기</span>
        </SeedActionButton>
      </div>
    </section>
  )
}

/** 책갈피가 없을 때 첫 기록 작성을 유도하는 빈 상태를 렌더링한다. */
function BookmarkEmptyState() {
  return (
    <div className="border-ink/10 bg-surface-muted rounded-lg border px-4 py-8 text-center">
      <p className="text-ink text-sm font-semibold">아직 남긴 책갈피가 없어요.</p>
      <p className="talkhugam-balanced-copy text-ink-subtle mt-2 text-sm">
        마음에 든 문장을 짧은 영상으로 남겨 보세요.
      </p>
    </div>
  )
}

/** 영상 책갈피 하나의 썸네일, 문장, 작성자를 카드로 렌더링한다. */
function BookmarkCard({
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
  return (
    <article className="border-ink/10 overflow-hidden rounded-lg border bg-white">
      <VideoMessage
        isThumbnailLoading={isThumbnailLoading}
        onOpen={onOpen}
        thumbnailAuthorization={thumbnailAuthorization}
        video={video}
      />
      <div className="space-y-1 p-3">
        <p className="text-ink talkhugam-balanced-copy border-primary border-l-2 pl-3 text-base font-semibold whitespace-pre-wrap">
          {video.body ?? '영상으로 남긴 책갈피'}
        </p>
        <p className="text-ink-subtle text-xs">{video.authorName}의 책갈피</p>
      </div>
    </article>
  )
}

/** 독후감 조회 상태에 따라 대화 또는 재시도 안내를 렌더링한다. */
function DiscussionTimeline({
  allPosts,
  currentMemberId,
  hasPostError,
  hasPendingQuery,
  hasVideoError,
  isRetrying,
  onReact,
  onReply,
  onRetry,
  posts,
  reactionsByPostId,
  retryMessage,
}: {
  allPosts: DiscussionPost[]
  currentMemberId: string | null
  hasPostError: boolean
  hasPendingQuery: boolean
  hasVideoError: boolean
  isRetrying: boolean
  onReact: (postId: string, emoji: PostReactionEmoji) => void
  onReply: (target: ReplyTarget) => void
  onRetry: () => void
  posts: DiscussionPost[]
  reactionsByPostId: ReadonlyMap<string, PostReactionSummary[]>
  retryMessage: string | null
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
        onReact={onReact}
        onReply={onReply}
        posts={posts}
        reactionsByPostId={reactionsByPostId}
        showEmptyState={!errorMessage && !hasPendingQuery}
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
  returnFocusRef,
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
  returnFocusRef: RefObject<HTMLElement | null>
}) {
  const ownCompletion = completions.find((completion) => completion.isMe)
  return (
    <BottomSheet onClose={onClose} returnFocusRef={returnFocusRef} title="완독 기록">
      {isLoading ? <BookLoadingIndicator label="완독 현황을 불러오고 있어요." size="xs" /> : null}
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
        <SeedActionButton
          className="talkhugam-primary-action"
          disabled={isSaving}
          onClick={onOpenEditor}
          size="medium"
          type="button"
          variant="brandSolid"
        >
          {hasOwnCompletion ? '완독 기록 수정' : '완독하기'}
        </SeedActionButton>
        {hasOwnCompletion ? (
          <SeedActionButton
            className="talkhugam-foundation-action--outline"
            disabled={isSaving}
            onClick={onRemove}
            size="medium"
            type="button"
            variant="neutralOutline"
          >
            완독 취소
          </SeedActionButton>
        ) : null}
      </div>
    </div>
  )
}

/** 대화 입력창 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function ChatComposer({
  errorMessage,
  hasMentionMemberError,
  isUploadingVideo,
  labels,
  mentionCandidates,
  onCancelReply,
  onChangeDraft,
  onChangeLabels,
  onChangeMentionedMemberIds,
  onRetryMentionMembers,
  onSubmit,
  replyTarget,
  value,
}: {
  errorMessage: string | null
  hasMentionMemberError: boolean
  isUploadingVideo: boolean
  labels: PostForm['labels']
  mentionCandidates: VideoFilterMember[]
  onCancelReply: () => void
  onChangeDraft: (value: string) => void
  onChangeLabels: (labels: PostForm['labels']) => void
  onChangeMentionedMemberIds: (mentionedMemberIds: PostForm['mentionedMemberIds']) => void
  onRetryMentionMembers: () => void
  onSubmit: () => void
  replyTarget: ReplyTarget | null
  value: string
}) {
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const actionMenuButtonRef = useRef<HTMLButtonElement>(null)
  const firstActionButtonRef = useRef<HTMLButtonElement>(null)
  const mentionMenuRef = useRef<HTMLDivElement>(null)
  const shouldRestoreActionTrayFocusRef = useRef(true)
  const [isActionTrayOpen, setIsActionTrayOpen] = useState(false)
  const [isLabelKindSelectionOpen, setIsLabelKindSelectionOpen] = useState(false)
  const [labelKind, setLabelKind] = useState<LabelKind | null>(null)
  const [isMentionMenuDismissed, setIsMentionMenuDismissed] = useState(false)
  const [labelDrafts, setLabelDrafts] = useState<Record<LabelKind, string>>({
    chapter: '',
    page: '',
  })
  const mentionQuery = getActiveMentionQuery(value)
  const shouldShowMentionMenu = mentionQuery !== null && !isMentionMenuDismissed
  const matchingMentionCandidates = getMatchingMentionCandidates(mentionCandidates, mentionQuery)

  /** 답글 대상이 선택되면 입력창을 화면에 보이게 내리고 바로 포커스를 둔다. */
  function focusMessageInputForReply() {
    window.requestAnimationFrame(() => {
      messageInputRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      messageInputRef.current?.focus()
    })
  }

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

  /** 복귀 To 라벨 선택 요청이나 사용자 동작을 처리한다. */
  function handleReturnToLabelSelection() {
    setLabelKind(null)
    setIsLabelKindSelectionOpen(true)
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

  useEffect(() => {
    if (!replyTarget) return
    focusMessageInputForReply()
  }, [replyTarget])

  return (
    <section className="border-ink/10 relative mt-6 border-t pt-4">
      {replyTarget ? (
        <ReplyComposerContext replyTarget={replyTarget} onCancelReply={onCancelReply} />
      ) : null}
      {labels.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="선택한 라벨">
          {labels.map((label, index) => (
            <li
              className="bg-primary/10 text-primary flex min-h-8 items-center gap-1 rounded-md px-2 text-xs"
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
          ) : isLabelKindSelectionOpen ? (
            <div className="grid grid-cols-2 gap-2">
              <SeedActionButton
                className="talkhugam-action-sheet-choice"
                disabled={Boolean(replyTarget)}
                onClick={() => {
                  setLabelKind('page')
                  setIsLabelKindSelectionOpen(false)
                }}
                ref={firstActionButtonRef}
                variant="neutralWeak"
              >
                페이지 라벨
              </SeedActionButton>
              <SeedActionButton
                className="talkhugam-action-sheet-choice"
                disabled={Boolean(replyTarget)}
                onClick={() => {
                  setLabelKind('chapter')
                  setIsLabelKindSelectionOpen(false)
                }}
                variant="neutralWeak"
              >
                챕터 라벨
              </SeedActionButton>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              <SeedActionButton
                className="talkhugam-action-sheet-choice"
                disabled={Boolean(replyTarget)}
                onClick={() => setIsLabelKindSelectionOpen(true)}
                ref={firstActionButtonRef}
                variant="neutralWeak"
              >
                라벨 등록
              </SeedActionButton>
            </div>
          )}
        </BottomSheet>
      ) : null}
      <div className="talkhugam-chat-composer-row">
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
              strokeWidth="2.4"
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
              placeholder={replyTarget ? '답글을 입력하세요.' : '메시지 입력'}
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
      {isUploadingVideo ? (
        <div className="mt-3">
          <BookLoadingIndicator label="영상을 채팅에 올리고 있어요…" size="xs" />
        </div>
      ) : null}
    </section>
  )
}

/** 답글 작성 중인 원문 작성자와 내용을 입력창 위에 요약해 렌더링한다. */
function ReplyComposerContext({
  onCancelReply,
  replyTarget,
}: {
  onCancelReply: () => void
  replyTarget: ReplyTarget
}) {
  return (
    <div className="border-ink/10 bg-surface-muted mb-3 flex min-h-11 items-center gap-3 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-primary text-xs font-semibold">{replyTarget.authorName}에게 답글</p>
        {replyTarget.body ? (
          <p className="text-ink-subtle mt-1 truncate text-xs">{replyTarget.body}</p>
        ) : null}
      </div>
      <SeedActionButton
        aria-label="답글 취소"
        className="!size-11 shrink-0 rounded-full p-0"
        onClick={onCancelReply}
        size="small"
        type="button"
        variant="ghost"
      >
        ×
      </SeedActionButton>
    </div>
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
  onReact,
  onReply,
  posts,
  reactionsByPostId,
  showEmptyState = true,
}: {
  allPosts: DiscussionPost[]
  currentMemberId: string | null
  onReact: (postId: string, emoji: PostReactionEmoji) => void
  onReply: (target: ReplyTarget) => void
  posts: DiscussionPost[]
  reactionsByPostId: ReadonlyMap<string, PostReactionSummary[]>
  showEmptyState?: boolean
}) {
  if (posts.length === 0 && showEmptyState)
    return (
      <div className="bg-surface-muted rounded-lg p-6 text-center">
        <p className="text-ink font-medium">첫 독후감을 남겨 보세요</p>
        <p className="text-ink-subtle mt-2 text-sm">페이지나 챕터 라벨만 먼저 남겨도 괜찮아요.</p>
      </div>
    )
  if (posts.length === 0) return null
  return (
    <ul className="space-y-4">
      {posts.map((post) => (
        <li
          className={`flex ${
            isCurrentMemberMessage(post.authorMemberId, currentMemberId)
              ? 'justify-end'
              : 'justify-start'
          }`}
          key={post.id}
        >
          <RootPostBubble
            currentMemberId={currentMemberId}
            onReact={onReact}
            onReply={onReply}
            post={post}
            reactions={reactionsByPostId.get(post.id) ?? []}
            replies={allPosts.filter((reply) => reply.rootPostId === post.id)}
          />
        </li>
      ))}
    </ul>
  )
}

/** 원문 메시지 버블과 필요할 때만 나타나는 답글·반응 액션을 렌더링한다. */
function RootPostBubble({
  currentMemberId,
  onReact,
  onReply,
  post,
  reactions,
  replies,
}: {
  currentMemberId: string | null
  onReact: (postId: string, emoji: PostReactionEmoji) => void
  onReply: (target: ReplyTarget) => void
  post: DiscussionPost
  reactions: PostReactionSummary[]
  replies: DiscussionPost[]
}) {
  const longPressTimerRef = useRef<number | null>(null)
  const [isActionBarVisible, setIsActionBarVisible] = useState(false)
  const [isActionBarPinned, setIsActionBarPinned] = useState(false)

  /** 포인터가 메시지 위에 있을 때 PC용 빠른 액션을 보여 준다. */
  function handleMouseEnter() {
    setIsActionBarVisible(true)
  }

  /** 마우스가 메시지 묶음 안에서 다시 움직이면 닫힌 빠른 액션을 복구한다. */
  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch') return
    setIsActionBarVisible(true)
  }

  /** 포인터가 메시지를 벗어나면 임시 액션을 숨긴다. */
  function handleMouseLeave() {
    if (isActionBarPinned) return
    setIsActionBarVisible(false)
  }

  /** 키보드 포커스가 메시지 묶음 안으로 들어오면 액션을 보여 준다. */
  function handleFocus() {
    setIsActionBarVisible(true)
  }

  /** 키보드 포커스가 메시지 묶음 밖으로 나가면 액션을 숨긴다. */
  function handleBlur(event: React.FocusEvent<HTMLElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    setIsActionBarVisible(false)
  }

  /** 터치가 오래 지속되면 모바일용 빠른 액션을 보여 준다. */
  function handlePointerDown() {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = window.setTimeout(() => {
      setIsActionBarVisible(true)
    }, 450)
  }

  /** 길게 누르기가 끝나기 전에 손을 떼면 예약된 액션 노출을 취소한다. */
  function handlePointerEnd() {
    if (longPressTimerRef.current === null) return
    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }

  /** 선택한 원문 메시지를 답글 대상으로 composer에 전달한다. */
  function handleReply() {
    setIsActionBarPinned(false)
    setIsActionBarVisible(false)
    onReply({ authorName: post.authorName, body: post.body, id: post.id })
  }

  /** 선택한 이모지를 현재 사용자의 메시지 반응으로 토글한다. */
  function handleReact(emoji: PostReactionEmoji) {
    onReact(post.id, emoji)
  }

  useEffect(
    () => () => {
      if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
    },
    [],
  )

  return (
    <article
      className={`flex w-full max-w-full flex-col outline-none ${
        isCurrentMemberMessage(post.authorMemberId, currentMemberId) ? 'items-end' : 'items-start'
      }`}
    >
      <div
        className={`flex w-fit max-w-[70%] flex-col ${
          isCurrentMemberMessage(post.authorMemberId, currentMemberId) ? 'items-end' : 'items-start'
        }`}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerEnd}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
      >
        <div
          aria-label={`${post.authorName}의 메시지`}
          className="border-ink/10 focus-visible:ring-primary/40 w-fit max-w-full rounded-lg border bg-white px-4 py-3 outline-none focus-visible:ring-2"
          tabIndex={0}
        >
          <p className="text-ink text-sm font-medium">{post.authorName}</p>
          <PostLabels labels={post.labels} />
          {post.body ? (
            <p className="text-ink mt-2 text-sm whitespace-pre-wrap">
              <HighlightedMentionText body={post.body} />
            </p>
          ) : null}
        </div>
        {isActionBarVisible ? (
          <MessageQuickActions
            isOwnMessage={isCurrentMemberMessage(post.authorMemberId, currentMemberId)}
            onReact={handleReact}
            onReply={handleReply}
            onTogglePinned={setIsActionBarPinned}
            post={post}
            reactions={reactions}
          />
        ) : null}
      </div>
      <ReactionSummary onReact={handleReact} reactions={reactions} />
      <Replies currentMemberId={currentMemberId} posts={replies} />
    </article>
  )
}

/** 현재 반응 요약에 사용자의 이모지 토글 결과를 반영한 새 Map을 반환한다. */
function toggleReactionSummary(
  reactionsByPostId: ReadonlyMap<string, PostReactionSummary[]>,
  postId: string,
  emoji: PostReactionEmoji,
): Map<string, PostReactionSummary[]> {
  const nextReactionsByPostId = new Map(reactionsByPostId)
  const currentReactions = nextReactionsByPostId.get(postId) ?? []
  const targetReaction = currentReactions.find((reaction) => reaction.emoji === emoji)

  if (!targetReaction) {
    nextReactionsByPostId.set(postId, [
      { count: 1, emoji, hasReacted: true, postId },
      ...currentReactions,
    ])
    return nextReactionsByPostId
  }

  const nextReaction = {
    ...targetReaction,
    count: targetReaction.hasReacted ? targetReaction.count - 1 : targetReaction.count + 1,
    hasReacted: !targetReaction.hasReacted,
  }
  const nextReactions =
    nextReaction.count > 0
      ? currentReactions.map((reaction) => (reaction.emoji === emoji ? nextReaction : reaction))
      : currentReactions.filter((reaction) => reaction.emoji !== emoji)
  nextReactionsByPostId.set(postId, nextReactions)
  return nextReactionsByPostId
}

/** 메시지 아래에 답글과 빠른 이모지 반응 버튼을 작은 행으로 렌더링한다. */
function MessageQuickActions({
  isOwnMessage,
  onReact,
  onReply,
  onTogglePinned,
  post,
  reactions,
}: {
  isOwnMessage: boolean
  onReact: (emoji: PostReactionEmoji) => void
  onReply: () => void
  onTogglePinned: (isPinned: boolean) => void
  post: DiscussionPost
  reactions: PostReactionSummary[]
}) {
  const [isExtendedEmojiPickerOpen, setIsExtendedEmojiPickerOpen] = useState(false)
  const [pickerPlacement, setPickerPlacement] = useState<ReactionPickerPlacement>('bottom')
  const actionContainerRef = useRef<HTMLDivElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)

  /** 대표 이모지 버튼에서 반응 선택 팔레트를 열거나 닫는다. */
  function handleToggleEmojiPicker() {
    if (isExtendedEmojiPickerOpen) {
      setIsExtendedEmojiPickerOpen(false)
      onTogglePinned(false)
      return
    }
    const buttonRect = emojiButtonRef.current?.getBoundingClientRect()
    if (buttonRect) {
      setPickerPlacement(getReactionPickerPlacement(buttonRect, window.innerHeight))
    }
    setIsExtendedEmojiPickerOpen(true)
    onTogglePinned(true)
  }

  /** 선택한 이모지를 반응으로 저장하고 선택 팔레트를 닫는다. */
  function handleSelectEmoji(emoji: PostReactionEmoji) {
    onReact(emoji)
    setIsExtendedEmojiPickerOpen(false)
    onTogglePinned(false)
  }

  /** Escape 입력으로 열린 반응 선택 팔레트를 닫는다. */
  const handleCloseEmojiPickerByEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIsExtendedEmojiPickerOpen(false)
      onTogglePinned(false)
    },
    [onTogglePinned],
  )

  /** 액션 묶음 바깥을 누르면 열린 반응 선택 팔레트를 닫는다. */
  const handleCloseEmojiPickerByOutsidePointer = useCallback(
    (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (actionContainerRef.current?.contains(target)) return
      setIsExtendedEmojiPickerOpen(false)
      onTogglePinned(false)
    },
    [onTogglePinned],
  )

  useEffect(() => {
    if (!isExtendedEmojiPickerOpen) return
    document.addEventListener('keydown', handleCloseEmojiPickerByEscape)
    document.addEventListener('pointerdown', handleCloseEmojiPickerByOutsidePointer)
    return () => {
      document.removeEventListener('keydown', handleCloseEmojiPickerByEscape)
      document.removeEventListener('pointerdown', handleCloseEmojiPickerByOutsidePointer)
    }
  }, [
    handleCloseEmojiPickerByEscape,
    handleCloseEmojiPickerByOutsidePointer,
    isExtendedEmojiPickerOpen,
  ])

  return (
    <div
      className={`relative mt-1 flex w-fit max-w-full flex-col overflow-visible ${
        isOwnMessage ? 'items-end' : 'items-start'
      }`}
      aria-label="메시지 빠른 액션"
      ref={actionContainerRef}
    >
      <div
        className={`flex w-full flex-wrap items-center gap-0.5 ${
          isOwnMessage ? 'justify-end' : 'justify-start'
        }`}
      >
        {QUICK_REACTION_EMOJIS.map((emoji) => (
          <QuickReactionButton emoji={emoji} key={emoji} onReact={onReact} reactions={reactions} />
        ))}
        <SeedActionButton
          aria-controls={`extra-reactions-${post.id}`}
          aria-expanded={isExtendedEmojiPickerOpen}
          aria-label="이모지 반응 열기"
          className="text-ink !size-11 rounded-full !bg-transparent p-0 text-xl hover:!bg-transparent active:!bg-transparent"
          onClick={handleToggleEmojiPicker}
          ref={emojiButtonRef}
          size="small"
          type="button"
          variant="ghost"
        >
          <EmojiReactionIcon />
        </SeedActionButton>
        <SeedActionButton
          aria-label={`${post.authorName}에게 답글`}
          className="text-ink order-last !size-11 rounded-full !bg-transparent p-0 hover:!bg-transparent active:!bg-transparent"
          onClick={onReply}
          size="small"
          type="button"
          variant="ghost"
        >
          <ReplyArrowIcon />
        </SeedActionButton>
      </div>
      {isExtendedEmojiPickerOpen ? (
        <ReactionEmojiPicker
          id={`extra-reactions-${post.id}`}
          onSelectEmoji={handleSelectEmoji}
          placement={pickerPlacement}
          reactions={reactions}
        />
      ) : null}
    </div>
  )
}

/** 기본 반응 이모지를 메시지 아래 빠른 선택 버튼으로 렌더링한다. */
function QuickReactionButton({
  emoji,
  onReact,
  reactions,
}: {
  emoji: PostReactionEmoji
  onReact: (emoji: PostReactionEmoji) => void
  reactions: PostReactionSummary[]
}) {
  const hasReacted = reactions.some((reaction) => reaction.emoji === emoji && reaction.hasReacted)
  return (
    <SeedActionButton
      aria-label={`${emoji} 반응 남기기`}
      className={`!size-11 rounded-full p-0 text-xl ${
        hasReacted
          ? 'text-primary ring-primary !bg-transparent ring-2 hover:!bg-transparent active:!bg-transparent'
          : 'text-ink !bg-transparent hover:!bg-transparent active:!bg-transparent'
      }`}
      onClick={() => onReact(emoji)}
      size="small"
      type="button"
      variant="ghost"
    >
      {emoji}
    </SeedActionButton>
  )
}

/** 트리거의 세로 위치와 viewport 높이를 받아 피커가 열릴 방향을 반환한다. */
function getReactionPickerPlacement(
  triggerRect: Pick<DOMRect, 'bottom' | 'top'>,
  viewportHeight: number,
): ReactionPickerPlacement {
  const availableBottomSpace = viewportHeight - triggerRect.bottom
  const availableTopSpace = triggerRect.top
  if (availableBottomSpace >= REACTION_PICKER_HEIGHT) return 'bottom'
  if (availableTopSpace < REACTION_PICKER_HEIGHT) return 'bottom'
  return availableTopSpace > availableBottomSpace ? 'top' : 'bottom'
}

/** Frimousse 기반 전체 Unicode 이모지 피커를 Talk후감 카드 형태로 렌더링한다. */
function ReactionEmojiPicker({
  id,
  onSelectEmoji,
  placement,
  reactions,
}: {
  id: string
  onSelectEmoji: (emoji: PostReactionEmoji) => void
  placement: ReactionPickerPlacement
  reactions: PostReactionSummary[]
}) {
  const placementClass = placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
  const pickerRootRef = useRef<HTMLDivElement>(null)
  const [categoryTabs, setCategoryTabs] = useState<EmojiCategoryTab[]>([])
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | null>(null)

  /** Frimousse가 선택한 이모지를 반응 저장 형식으로 전달한다. */
  function handleSelectFrimousseEmoji(emoji: Emoji) {
    onSelectEmoji(emoji.emoji)
  }

  /** Frimousse 목록에 나타난 카테고리를 상단 탭으로 노출하기 위해 저장한다. */
  const handleRegisterCategory = useCallback((categoryLabel: string) => {
    if (categoryLabel === 'Category') return
    setCategoryTabs((tabs) =>
      tabs.some((tab) => tab.label === categoryLabel)
        ? tabs
        : [...tabs, { index: tabs.length, label: categoryLabel }],
    )
    setSelectedCategoryLabel((selectedLabel) => selectedLabel ?? categoryLabel)
  }, [])

  /** 상단 카테고리 탭을 누르면 해당 카테고리 헤더 위치로 목록을 이동한다. */
  const handleSelectCategory = useCallback((categoryLabel: string) => {
    setSelectedCategoryLabel(categoryLabel)
    const categoryHeaders = Array.from(
      pickerRootRef.current?.querySelectorAll('[data-talkhugam-emoji-category]') ?? [],
    )
    const categoryHeader = categoryHeaders.find(
      (header) => header.getAttribute('data-talkhugam-emoji-category') === categoryLabel,
    )
    if (!(categoryHeader instanceof HTMLElement)) return
    const categorySection = categoryHeader.closest('[frimousse-category]')
    const viewport = pickerRootRef.current?.querySelector('[frimousse-viewport]')
    if (categorySection instanceof HTMLElement && viewport instanceof HTMLElement) {
      viewport.scrollTop = getCategoryScrollTop(pickerRootRef.current, categorySection)
      viewport.dispatchEvent(new Event('scroll', { bubbles: true }))
      window.requestAnimationFrame(() => setSelectedCategoryLabel(categoryLabel))
      return
    }
    categoryHeader.scrollIntoView({ block: 'start' })
  }, [])

  /** 목록 스크롤 위치를 읽어 현재 보이는 분류 탭을 활성 상태로 맞춘다. */
  function handleViewportScroll(event: React.UIEvent<HTMLDivElement>) {
    const activeCategoryLabel = getActiveEmojiCategoryLabel(
      pickerRootRef.current,
      event.currentTarget.scrollTop,
    )
    if (activeCategoryLabel === null) return
    setSelectedCategoryLabel(activeCategoryLabel)
  }

  /** Frimousse 카테고리 헤더를 상단 탭 등록 로직과 연결해 렌더링한다. */
  function renderCategoryHeader(props: EmojiPickerListCategoryHeaderProps) {
    return <ReactionEmojiCategoryHeader {...props} onRegisterCategory={handleRegisterCategory} />
  }

  return (
    <EmojiPicker.Root
      aria-label="Talk후감 이모티콘 패키지"
      className={`border-ink/10 absolute z-20 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-white p-3 shadow-lg sm:w-96 ${placementClass}`}
      columns={6}
      id={id}
      locale="ko"
      onEmojiSelect={handleSelectFrimousseEmoji}
      ref={pickerRootRef}
      role="group"
    >
      <EmojiPicker.Search
        aria-label="이모지 검색"
        className="border-ink/10 focus:border-primary mb-3 h-11 w-full rounded-md border bg-white px-3 text-base outline-none"
        placeholder="검색"
      />
      {categoryTabs.length > 0 ? (
        <EmojiCategoryTabs
          categories={categoryTabs}
          onSelectCategory={handleSelectCategory}
          selectedCategoryLabel={selectedCategoryLabel}
        />
      ) : null}
      <EmojiPicker.Viewport
        aria-label="이모지 목록"
        className="talkhugam-emoji-scrollbar h-72 max-h-[calc(100vh-11rem)]"
        onScroll={handleViewportScroll}
      >
        <EmojiPicker.Loading>
          <span className="sr-only">이모지를 불러오고 있어요.</span>
        </EmojiPicker.Loading>
        <EmojiPicker.Empty>
          <span className="sr-only">검색 결과가 없어요.</span>
        </EmojiPicker.Empty>
        <EmojiPicker.List
          components={{
            CategoryHeader: renderCategoryHeader,
            Emoji: (props) => <ReactionEmojiOption {...props} reactions={reactions} />,
            Row: ReactionEmojiRow,
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  )
}

/** Frimousse 분류 섹션들의 실제 높이를 더해 목표 분류의 목록 스크롤 위치를 계산한다. */
function getCategoryScrollTop(
  pickerRoot: HTMLElement | null,
  targetCategorySection: HTMLElement,
): number {
  if (pickerRoot === null) return 0
  const categorySections = Array.from(
    pickerRoot.querySelectorAll('[frimousse-category]') ?? [],
  ).filter((section): section is HTMLElement => section instanceof HTMLElement)
  const targetIndex = categorySections.indexOf(targetCategorySection)
  if (targetIndex < 0) return 0
  const measuredScrollTop = categorySections
    .slice(0, targetIndex)
    .reduce((scrollTop, section) => scrollTop + getCategorySectionHeight(pickerRoot, section), 0)
  if (measuredScrollTop > 0) return measuredScrollTop
  return targetIndex * 96
}

/** Frimousse가 inline style과 CSS 변수로 표현한 분류 섹션 높이를 숫자로 변환한다. */
function getCategorySectionHeight(pickerRoot: HTMLElement, categorySection: HTMLElement): number {
  const measuredHeight = categorySection.getBoundingClientRect().height
  if (measuredHeight > 0) return measuredHeight
  const rowHeight = Number.parseFloat(pickerRoot.style.getPropertyValue('--frimousse-row-height'))
  const categoryHeaderHeight = Number.parseFloat(
    pickerRoot.style.getPropertyValue('--frimousse-category-header-height'),
  )
  const rowsCount = Number.parseFloat(
    categorySection.style.height.match(/(\d+)\s*\*\s*var\(--frimousse-row-height\)/)?.[1] ?? '0',
  )
  if (!Number.isFinite(rowHeight) || !Number.isFinite(categoryHeaderHeight)) return 0
  return categoryHeaderHeight + rowsCount * rowHeight
}

/** 목록 스크롤 위치에 가장 가까운 Frimousse 분류 라벨을 반환한다. */
function getActiveEmojiCategoryLabel(
  pickerRoot: HTMLElement | null,
  scrollTop: number,
): string | null {
  if (pickerRoot === null) return null
  const categorySections = Array.from(
    pickerRoot.querySelectorAll('[frimousse-category]') ?? [],
  ).filter((section): section is HTMLElement => section instanceof HTMLElement)
  for (let index = categorySections.length - 1; index >= 0; index -= 1) {
    const categorySection = categorySections[index]
    if (!categorySection) continue
    const categoryHeader = categorySection.querySelector('[data-talkhugam-emoji-category]')
    if (!(categoryHeader instanceof HTMLElement)) continue
    if (getCategoryScrollTop(pickerRoot, categorySection) > scrollTop + 1) continue
    return categoryHeader.getAttribute('data-talkhugam-emoji-category')
  }
  return null
}

/** 이모지 분류를 피커 최상단 탭으로 렌더링하고 선택한 분류로 이동하게 한다. */
function EmojiCategoryTabs({
  categories,
  onSelectCategory,
  selectedCategoryLabel,
}: {
  categories: EmojiCategoryTab[]
  onSelectCategory: (category: string) => void
  selectedCategoryLabel: string | null
}) {
  /** 세로 휠 입력을 가로 스크롤로 바꿔 카테고리 탭을 쉽게 넘기게 한다. */
  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
    event.preventDefault()
    event.currentTarget.scrollLeft += event.deltaY
  }

  return (
    <div
      aria-label="이모지 카테고리"
      className="talkhugam-category-scrollbar mb-3 flex w-full min-w-0 touch-pan-x gap-1.5 overflow-x-scroll overscroll-x-contain pb-1"
      onWheel={handleWheel}
      role="tablist"
    >
      {categories.map((category) => {
        const isSelected = category.label === selectedCategoryLabel
        return (
          <button
            aria-label={category.label}
            aria-selected={isSelected}
            className={`border-ink/10 hover:border-primary focus-visible:ring-primary/40 flex size-9 shrink-0 items-center justify-center rounded-full border bg-white text-lg outline-none focus-visible:ring-2 ${
              isSelected ? 'border-primary ring-primary/40 ring-2' : ''
            }`}
            key={category.label}
            onClick={() => onSelectCategory(category.label)}
            onPointerDown={() => onSelectCategory(category.label)}
            role="tab"
            type="button"
          >
            {getCategoryRepresentativeEmoji(category.label, category.index)}
          </button>
        )
      })}
    </div>
  )
}

/** 카테고리 라벨에 대응하는 대표 첫 이모지를 반환한다. */
function getCategoryRepresentativeEmoji(category: string, categoryIndex: number): string {
  const normalizedCategory = category.toLocaleLowerCase()
  if (normalizedCategory.includes('travel') || normalizedCategory.includes('여행')) return '🌐'
  if (normalizedCategory.includes('food') || normalizedCategory.includes('음식')) return '🍇'
  if (normalizedCategory.includes('animal') || normalizedCategory.includes('동물')) return '🐵'
  if (
    normalizedCategory.includes('people') ||
    normalizedCategory.includes('body') ||
    normalizedCategory.includes('사람') ||
    normalizedCategory.includes('신체') ||
    normalizedCategory.includes('몸')
  )
    return '👋'
  if (
    normalizedCategory.includes('activity') ||
    normalizedCategory.includes('activities') ||
    normalizedCategory.includes('활동')
  )
    return '🎃'
  if (
    normalizedCategory.includes('object') ||
    normalizedCategory.includes('objects') ||
    normalizedCategory.includes('사물') ||
    normalizedCategory.includes('물건')
  )
    return '👓'
  if (normalizedCategory.includes('symbol') || normalizedCategory.includes('기호')) return '🏧'
  if (normalizedCategory.includes('flag') || normalizedCategory.includes('깃발')) return '🏁'
  return getCategoryRepresentativeEmojiByOrder(categoryIndex)
}

/** 라벨 번역이 달라도 Emojibase 기본 분류 순서에 맞는 대표 이모지를 반환한다. */
function getCategoryRepresentativeEmojiByOrder(categoryIndex: number): string {
  return ['😀', '👋', '🐵', '🍇', '🌐', '🎃', '👓', '🏧', '🏁'][categoryIndex] ?? '😀'
}

/** Frimousse 카테고리 헤더를 스크롤 위치 기준점으로만 유지하고 화면에서는 숨긴다. */
function ReactionEmojiCategoryHeader({
  category,
  onRegisterCategory,
  ...props
}: EmojiPickerListCategoryHeaderProps & {
  onRegisterCategory: (category: string) => void
}) {
  const isMeasurementCategory = category.label === 'Category'

  useEffect(() => {
    if (isMeasurementCategory) return
    onRegisterCategory(category.label)
  }, [category.label, isMeasurementCategory, onRegisterCategory])

  if (isMeasurementCategory)
    return <div {...props} aria-hidden="true" className="h-px overflow-hidden opacity-0" />

  return (
    <div
      {...props}
      data-talkhugam-emoji-category={category.label}
      aria-hidden="true"
      className="h-px overflow-hidden opacity-0"
    />
  )
}

/** Frimousse 이모지 행을 여섯 칸 그리드처럼 보이게 렌더링한다. */
function ReactionEmojiRow({ children, ...props }: EmojiPickerListRowProps) {
  return (
    <div {...props} className="mb-2 grid grid-cols-6 gap-2 max-[360px]:grid-cols-5">
      {children}
    </div>
  )
}

/** Frimousse 이모지 버튼을 Talk후감 반응 버튼 스타일과 내 선택 상태로 렌더링한다. */
function ReactionEmojiOption({
  emoji,
  reactions,
  ...props
}: EmojiPickerListEmojiProps & {
  emoji: Emoji & { isActive: boolean }
  reactions: PostReactionSummary[]
}) {
  const hasReacted = reactions.some(
    (reaction) => reaction.emoji === emoji.emoji && reaction.hasReacted,
  )
  return (
    <button
      {...props}
      aria-label={`${emoji.emoji} 반응 남기기`}
      className={`grid size-11 shrink-0 place-items-center rounded-md p-0 text-[28px] ${
        hasReacted ? 'ring-primary bg-primary/10 text-primary ring-2' : 'bg-surface-muted text-ink'
      }`}
      onClick={props.onClick}
      type="button"
    >
      {emoji.emoji}
    </button>
  )
}

/** 대표 이모지 반응 버튼 안에 표시할 얼굴과 더하기 표시를 렌더링한다. */
function EmojiReactionIcon() {
  return (
    <span aria-hidden="true" className="relative inline-flex size-6 items-center justify-center">
      <span className="text-xl leading-none">😊</span>
      <span className="bg-primary text-on-primary absolute -top-1 -right-1 flex size-3 items-center justify-center rounded-full text-[10px] leading-none">
        +
      </span>
    </span>
  )
}

/** 메시지 아래에 누적된 이모지 반응 개수와 내 선택 상태를 표시한다. */
function ReactionSummary({
  onReact,
  reactions,
}: {
  onReact: (emoji: PostReactionEmoji) => void
  reactions: PostReactionSummary[]
}) {
  if (reactions.length === 0) return null
  const visibleReactions = reactions.slice(0, VISIBLE_REACTION_SUMMARY_COUNT)
  const hiddenReactionCount = countHiddenReactions(reactions, VISIBLE_REACTION_SUMMARY_COUNT)
  return (
    <div
      className="border-primary/20 mt-2 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border bg-white p-1 shadow-sm"
      aria-label="메시지 반응 패키지"
    >
      {visibleReactions.map((reaction) => (
        <SeedActionButton
          aria-label={`${reaction.emoji} 반응 ${reaction.count}개${
            reaction.hasReacted ? ', 내가 남김' : ''
          }`}
          className={`min-h-8 rounded-full px-2 text-xs font-bold ${
            reaction.hasReacted ? 'bg-primary/10 text-primary' : 'text-ink-subtle bg-transparent'
          }`}
          key={reaction.emoji}
          onClick={() => onReact(reaction.emoji)}
          size="small"
          type="button"
          variant="ghost"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            {reaction.emoji}
          </span>
          <span className="ml-1">{reaction.count}</span>
        </SeedActionButton>
      ))}
      {hiddenReactionCount > 0 ? (
        <span className="text-ink-subtle flex min-h-8 items-center px-2 text-xs font-bold">
          +{hiddenReactionCount}
        </span>
      ) : null}
    </div>
  )
}

/** 요약 바에서 접어야 하는 반응 종류 수를 반환한다. */
function countHiddenReactions(
  reactions: PostReactionSummary[],
  visibleReactionCount: number,
): number {
  return Math.max(reactions.length - visibleReactionCount, 0)
}

/** 답글 액션을 나타내는 작은 꺾인 화살표 아이콘을 렌더링한다. */
function ReplyArrowIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M9 7 5 11m0 0 4 4m-4-4h9a5 5 0 0 1 5 5v1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
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
      <SeedActionButton
        aria-label={`${video.authorName}님의 영상 보기`}
        className="border-ink/10 bg-ink relative !aspect-[3/1] !h-auto w-full max-w-full overflow-hidden rounded-none border-0 p-0 text-left"
        onClick={onOpen}
        size="large"
        type="button"
        variant="ghost"
      >
        <div className="absolute inset-0">
          {thumbnailAuthorization ? (
            <img
              alt=""
              className="absolute inset-0 size-full object-cover"
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
    <article className="border-ink/10 bg-ink flex aspect-[3/1] w-full max-w-full flex-col items-center justify-center rounded-none border-0 px-4 text-center">
      {isLoading ? (
        <BookLoadingIndicator label={message} size="sm" tone="inverse" />
      ) : (
        <p className="text-sm font-medium text-white">{message}</p>
      )}
    </article>
  )
}

/** 영상 미리보기 위에 재생 가능 여부를 나타내는 제어 아이콘을 렌더링한다. */
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
          <div className="bg-surface-muted w-fit max-w-full min-w-36 rounded-md px-3 py-2">
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
