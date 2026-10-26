import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  bookChatKeys,
  bookRatingKeys,
  calculateAverageRating,
  canManageRoomContent,
  insertQuoteIntoDraft,
  parseBookRatingInput,
  parsePostForm,
  postKeys,
  readingRoomKeys,
  roomRoleKeys,
  type BookChatRating,
  type BookRatingInput,
  type DiscussionPost,
  type PostForm,
} from '@talkhugam/domain'
import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  createMobileDiscussionPost,
  createMobileDiscussionReply,
  getMobileDiscussionMembers,
  getMobileDiscussionPosts,
  type MobileDiscussionMember,
} from '../../entities/post'
import {
  getMobileBookChatRatings,
  removeMobileBookChatRating,
  upsertMobileBookChatRating,
} from '../../entities/book-rating'
import {
  createMobileInviteShareMessage,
  createMobileRoomInvite,
  getMobileDiscussionBookChat,
  getMobileMyRoomRole,
  requestMobileRoomInvite,
} from '../../entities/reading-room'
import { useMobileSessionProfileId } from '../../shared/api/MobileAppProviders'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'
import { mobileColors, mobileRadius, mobileSpacing, mobileTouchTarget } from '../../shared/ui/mobileTheme'
import {
  MobilePhotoQuoteFlow,
  pickPhotoForQuote,
  type MobilePhotoQuoteInsert,
  type PhotoSource,
  type PickedPhoto,
} from '../photo-quote'
import { MobileVideoUploadSheet } from '../video/MobileVideoUploadSheet'
import {
  MobileMessageActionSheet,
  type MobileLabelKind,
  type MobileMenuView,
} from './MobileMessageActionSheet'

type MobileBookDiscussionScreenProps = {
  bookChatId: string
  onBack(): void
  onOpenVideoArchive?(): void
  roomId: string
}

type PostLabel = PostForm['labels'][number]

/** 문장 인용 확인 화면에 넘길 사진. photo가 null이면 직접 입력이다. */
type QuoteSource = { photo: PickedPhoto | null }

type Submission = {
  clientId: string
  rootPostId: string | null
  values: PostForm
}

/** RLS로 허용된 책 대화의 텍스트 글·답글·라벨·멘션을 기기 화면에서 작성하고 표시한다. */
export function MobileBookDiscussionScreen({
  bookChatId,
  onBack,
  onOpenVideoArchive,
  roomId,
}: MobileBookDiscussionScreenProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const profileId = useMobileSessionProfileId()
  const [body, setBody] = useState('')
  const [labels, setLabels] = useState<PostLabel[]>([])
  const [menuView, setMenuView] = useState<MobileMenuView | null>(null)
  const [quoteSource, setQuoteSource] = useState<QuoteSource | null>(null)
  const [lastPhotoSource, setLastPhotoSource] = useState<PhotoSource>('library')
  const [isVideoUploadOpen, setIsVideoUploadOpen] = useState(false)
  const [composerNotice, setComposerNotice] = useState<string | null>(null)
  const [isInviteBusy, setIsInviteBusy] = useState(false)
  const [replyTo, setReplyTo] = useState<DiscussionPost | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [failedSubmission, setFailedSubmission] = useState<Submission | null>(null)
  const [isRatingSheetOpen, setIsRatingSheetOpen] = useState(false)
  const [isRatingEditorOpen, setIsRatingEditorOpen] = useState(false)
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [ratingReview, setRatingReview] = useState('')
  const [ratingError, setRatingError] = useState<string | null>(null)
  const [isRatingSaving, setIsRatingSaving] = useState(false)

  /** 경로의 책방과 일치하는 책 대화만 RLS 범위에서 조회한다. */
  async function fetchBookChat() {
    return getMobileDiscussionBookChat(createMobileSupabaseClient(), roomId, bookChatId)
  }

  const bookChatQuery = useQuery({
    queryFn: fetchBookChat,
    queryKey: bookChatKeys.detail(roomId, bookChatId),
  })

  /** 확인된 책 대화에 연결된 텍스트 글만 시간순으로 읽어 온다. */
  async function fetchPosts(): Promise<DiscussionPost[]> {
    return getMobileDiscussionPosts(createMobileSupabaseClient(), roomId, bookChatId)
  }

  const postsQuery = useQuery({
    enabled: bookChatQuery.data !== null && bookChatQuery.data !== undefined,
    queryFn: fetchPosts,
    queryKey: postKeys.byBookChat(roomId, bookChatId),
  })

  /** 현재 책방의 활성 멤버만 멘션 후보로 읽어 온다. */
  async function fetchMembers(): Promise<MobileDiscussionMember[]> {
    return getMobileDiscussionMembers(createMobileSupabaseClient(), roomId)
  }

  const membersQuery = useQuery({
    enabled:
      bookChatQuery.data !== null &&
      bookChatQuery.data !== undefined &&
      bookChatQuery.data.status !== 'archived',
    queryFn: fetchMembers,
    queryKey: ['mobile-discussion-members', roomId],
  })

  /** 현재 로그인 회원을 기준으로 책 대화 별점과 방 멤버 표시명을 함께 읽어 온다. */
  async function fetchRatings(): Promise<BookChatRating[]> {
    if (profileId === null) return []
    return getMobileBookChatRatings(createMobileSupabaseClient(), bookChatId, profileId)
  }

  const ratingsQuery = useQuery({
    enabled:
      profileId !== null &&
      bookChatQuery.data !== null &&
      bookChatQuery.data !== undefined,
    queryFn: fetchRatings,
    queryKey: bookRatingKeys.byChat(bookChatId),
  })

  /** 현재 회원의 책방 역할을 읽어 초대 만들기와 초대 요청 중 보여 줄 항목을 정한다. */
  async function fetchRoomRole() {
    return getMobileMyRoomRole(createMobileSupabaseClient(), roomId)
  }

  const roleQuery = useQuery({ queryFn: fetchRoomRole, queryKey: roomRoleKeys.mine(roomId) })

  /** 저장할 값과 멘션 대상을 검증해 한 번의 제출에 사용할 입력 모델로 만든다. */
  function createSubmission(): Submission | null {
    try {
      const values = parsePostForm({
        body,
        labels: replyTo === null ? labels : [],
        mentionedMemberIds: getMentionedMemberIds(body, membersQuery.data ?? []),
      })
      return { clientId: createSubmissionClientId(), rootPostId: replyTo?.id ?? null, values }
    } catch {
      setSaveError('내용이나 라벨을 하나 이상 남겨 주세요.')
      return null
    }
  }

  /** 같은 제출 식별자를 보존해 네트워크 재시도에도 서버의 멱등성 규칙을 사용한다. */
  async function submitDiscussion(submission: Submission): Promise<void> {
    setIsSubmitting(true)
    setSaveError(null)
    try {
      if (submission.rootPostId === null) {
        await createMobileDiscussionPost(
          createMobileSupabaseClient(),
          bookChatId,
          submission.clientId,
          submission.values,
        )
      } else {
        await createMobileDiscussionReply(
          createMobileSupabaseClient(),
          submission.rootPostId,
          submission.clientId,
          submission.values,
        )
      }
      setBody('')
      setLabels([])
      setReplyTo(null)
      setFailedSubmission(null)
      await postsQuery.refetch()
      await queryClient.invalidateQueries({ queryKey: readingRoomKeys.all })
    } catch {
      setFailedSubmission(submission)
      setSaveError('대화 권한이 없거나 저장하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  /** 새 글 또는 답글 작성 시도에 고유한 제출 식별자를 만들고 서버 저장을 시작한다. */
  function handleSubmit(): void {
    if (isSubmitting) return
    const submission = createSubmission()
    if (submission === null) return
    void submitDiscussion(submission)
  }

  /** 실패한 동일 제출을 같은 clientId로 다시 전송해 중복 글 생성을 막는다. */
  function handleRetrySubmission(): void {
    if (failedSubmission === null || isSubmitting) return
    void submitDiscussion(failedSubmission)
  }

  /** 루트 글 하나를 답글 대상으로 지정하고 라벨 입력을 비운다. */
  function handleReply(post: DiscussionPost): void {
    setReplyTo(post)
    setSaveError(null)
    setFailedSubmission(null)
  }

  /** 답글 작성을 취소하고 새 루트 글 입력 상태로 전환한다. */
  function handleCancelReply(): void {
    setReplyTo(null)
    setSaveError(null)
    setFailedSubmission(null)
  }

  /** 선택한 고유 멘션 토큰을 현재 입력의 활성 @검색어 위치에 넣는다. */
  function handleSelectMention(member: MobileDiscussionMember): void {
    setBody((currentBody) => insertMentionToken(currentBody, member.mentionToken))
  }

  /** 시트에서 고른 종류와 값으로 라벨을 더한다. 값이 올바르지 않으면 false를 반환한다. */
  function handleAddLabel(kind: MobileLabelKind, value: string): boolean {
    const nextLabel = createDraftLabel(kind, value)
    if (!nextLabel) return false
    setLabels((current) => [...current, nextLabel])
    return true
  }

  /** 붙인 라벨 하나를 지운다. */
  function handleRemoveLabel(index: number): void {
    setLabels((current) => current.filter((_, labelIndex) => labelIndex !== index))
  }

  /** 카메라·앨범에서 사진을 받아 문장 고르기를 열고, 권한이 없으면 입력창 아래에 안내한다. */
  async function handlePickPhoto(source: PhotoSource): Promise<void> {
    setComposerNotice(null)
    setLastPhotoSource(source)
    const result = await pickPhotoForQuote(source)
    if (result.status === 'denied') {
      setComposerNotice(source === 'camera' ? '카메라 권한을 허용해 주세요.' : '사진 보관함 권한을 허용해 주세요.')
      return
    }
    if (result.status === 'picked') setQuoteSource({ photo: result.photo })
  }

  /** 열지 못한 사진 대신 같은 방법(카메라·앨범)으로 다른 사진을 고르게 한다. */
  function handlePickAnotherPhoto(): void {
    setQuoteSource(null)
    void handlePickPhoto(lastPhotoSource)
  }

  /** 확인한 인용 문장을 입력 끝에 넣고, 쪽이 있으면 페이지 라벨을 그 쪽으로 바꾼다(답글 제외). */
  function handleInsertQuote({ page, quote }: MobilePhotoQuoteInsert): void {
    setBody((currentBody) => insertQuoteIntoDraft(currentBody, quote))
    const pageLabel = page && replyTo === null ? createDraftLabel('page', page) : null
    if (pageLabel) setLabels((current) => [...current.filter((item) => item.kind !== 'page'), pageLabel])
    setQuoteSource(null)
  }

  /** 방장·운영자가 일회용 초대를 만들어 기기 공유 창으로 보낸다. */
  async function handleOpenRoomInvite(): Promise<void> {
    setIsInviteBusy(true)
    setComposerNotice(null)
    try {
      const invite = await createMobileRoomInvite(createMobileSupabaseClient(), roomId)
      await Share.share({ message: createMobileInviteShareMessage(invite) })
    } catch {
      setComposerNotice('초대 코드를 만들지 못했어요. 다시 시도해 주세요.')
    } finally {
      setIsInviteBusy(false)
    }
  }

  /** 참여자가 방장·운영자에게 초대를 요청하고 결과를 짧게 알린다. */
  async function handleRequestRoomInvite(): Promise<void> {
    setIsInviteBusy(true)
    setComposerNotice(null)
    try {
      const isCreated = await requestMobileRoomInvite(createMobileSupabaseClient(), roomId)
      setComposerNotice(isCreated ? '방장에게 책방 초대를 요청했어요.' : '방장이 아직 초대 요청을 확인하고 있어요.')
    } catch {
      setComposerNotice('방장에게 초대 요청을 보내지 못했어요. 다시 시도해 주세요.')
    } finally {
      setIsInviteBusy(false)
    }
  }

  /** 실패한 책 대화 조회를 다시 요청해 일시적 네트워크 오류를 분리한다. */
  function handleRetryBookChat(): void {
    void bookChatQuery.refetch()
  }

  /** 실패한 텍스트 타임라인 조회를 같은 권한 범위에서 다시 요청한다. */
  function handleRetryPosts(): void {
    void postsQuery.refetch()
  }

  /** 현재 책 대화와 연결된 영상 기록 화면을 상위 라우터에 요청한다. */
  function handleOpenVideoArchive(): void {
    onOpenVideoArchive?.()
  }

  /** 별점 시트를 열고 기존 기록은 목록 상태로 먼저 확인하도록 한다. */
  function handleOpenRatingSheet(): void {
    setRatingError(null)
    setIsRatingEditorOpen(false)
    setIsRatingSheetOpen(true)
  }

  /** 별점 시트와 작성 중이던 입력을 닫아 다음 열기에서 최신 데이터를 사용한다. */
  function handleCloseRatingSheet(): void {
    if (isRatingSaving) return
    setRatingError(null)
    setIsRatingEditorOpen(false)
    setIsRatingSheetOpen(false)
  }

  /** 현재 회원의 기존 별점 값 또는 빈 입력으로 별점·총평 편집 상태를 연다. */
  function handleOpenRatingEditor(): void {
    const ownRating = ratingsQuery.data?.find((rating) => rating.isMe)
    setSelectedRating(ownRating?.rating ?? null)
    setRatingReview(ownRating?.review ?? '')
    setRatingError(null)
    setIsRatingEditorOpen(true)
  }

  /** 편집 상태만 닫고 별점 멤버 목록과 기존 저장 내용은 유지한다. */
  function handleCancelRatingEditor(): void {
    if (isRatingSaving) return
    setRatingError(null)
    setIsRatingEditorOpen(false)
  }

  /** 별점과 천 자 이내 총평을 검증해 현재 회원의 별점으로 저장한다. */
  async function handleSaveRating(): Promise<void> {
    if (profileId === null || isRatingSaving) return

    let input: BookRatingInput
    try {
      input = parseBookRatingInput({
        bookChatId,
        rating: selectedRating,
        review: ratingReview.trim() || null,
      })
    } catch {
      setRatingError('별점은 1점부터 5점까지, 총평은 1,000자 이내로 남겨 주세요.')
      return
    }

    setIsRatingSaving(true)
    setRatingError(null)
    try {
      await upsertMobileBookChatRating(createMobileSupabaseClient(), input)
      setIsRatingEditorOpen(false)
      await invalidateRatingCaches(queryClient, bookChatId, profileId)
      await ratingsQuery.refetch()
    } catch {
      setRatingError('별점을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsRatingSaving(false)
    }
  }

  /** 현재 회원의 별점만 제거하고 관련 화면의 캐시를 갱신한다. */
  async function handleRemoveRating(): Promise<void> {
    if (profileId === null || isRatingSaving) return

    setIsRatingSaving(true)
    setRatingError(null)
    try {
      await removeMobileBookChatRating(createMobileSupabaseClient(), bookChatId)
      await invalidateRatingCaches(queryClient, bookChatId, profileId)
      await ratingsQuery.refetch()
    } catch {
      setRatingError('별점을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsRatingSaving(false)
    }
  }

  if (bookChatQuery.isPending) return <DiscussionLoadingState label="책 대화를 불러오고 있어요." />
  if (bookChatQuery.isError) return <DiscussionErrorState onRetry={handleRetryBookChat} />
  if (bookChatQuery.data === null) return <DiscussionUnavailableState onBack={onBack} />

  const isArchived = bookChatQuery.data.status === 'archived'
  const mentionCandidates = getMatchingMentionCandidates(membersQuery.data ?? [], body)
  const isReplying = replyTo !== null

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidingView}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="책방으로 돌아가기" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.title}>
              {bookChatQuery.data.title}
            </Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              책 대화
            </Text>
          </View>
          {onOpenVideoArchive ? (
            <Pressable
              accessibilityLabel="영상 기록"
              accessibilityRole="button"
              onPress={handleOpenVideoArchive}
              style={styles.videoHeaderAction}
            >
              <Text style={styles.videoHeaderActionText}>영상</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel="별점"
            accessibilityRole="button"
            onPress={handleOpenRatingSheet}
            style={styles.ratingHeaderAction}
          >
            <Text style={styles.ratingHeaderActionText}>별점</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.timeline} keyboardShouldPersistTaps="handled">
          <DiscussionTimeline
            isError={postsQuery.isError}
            isLoading={postsQuery.isPending}
            onReply={isArchived ? undefined : handleReply}
            onRetry={handleRetryPosts}
            posts={postsQuery.data ?? []}
          />
        </ScrollView>
        {isArchived ? (
          <View accessibilityLabel="보관된 책 대화" style={styles.archivedNotice}>
            <Text style={styles.archivedNoticeText}>보관된 책 대화</Text>
            <Text style={styles.archivedDescription}>지난 대화는 읽을 수 있지만 새 글과 답글은 남길 수 없어요.</Text>
          </View>
        ) : (
        <View style={styles.composer}>
          {isReplying ? (
            <View style={styles.replyBanner}>
              <Text numberOfLines={1} style={styles.replyBannerText}>
                {replyTo.authorName}님에게 답글
              </Text>
              <Pressable accessibilityLabel="답글 취소" accessibilityRole="button" onPress={handleCancelReply} style={styles.replyCancelButton}>
                <Text style={styles.replyCancelText}>취소</Text>
              </Pressable>
            </View>
          ) : null}
          {labels.length > 0 ? (
            <View accessibilityLabel="선택한 라벨" style={styles.labelChips}>
              {labels.map((postLabel, index) => (
                <Pressable
                  accessibilityLabel={`${formatPostLabel(postLabel)} 삭제`}
                  accessibilityRole="button"
                  key={`${postLabel.kind}-${postLabel.value}`}
                  onPress={() => handleRemoveLabel(index)}
                  style={styles.labelChip}
                >
                  <Text style={styles.labelChipText}>{formatPostLabel(postLabel)}</Text>
                  <Text importantForAccessibility="no" style={styles.labelChipText}>
                    ×
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.composerRow}>
            <Pressable
              accessibilityLabel="메시지 추가 메뉴 열기"
              accessibilityRole="button"
              onPress={() => setMenuView('root')}
              style={styles.composerIconButton}
            >
              <Text style={styles.composerIconText}>+</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="사진에서 문장 가져오기"
              accessibilityRole="button"
              onPress={() => setMenuView('photo-source')}
              style={styles.composerIconButton}
            >
              <Text style={styles.composerPhotoText}>사진</Text>
            </Pressable>
          <TextInput
            accessibilityLabel={isReplying ? '답글 입력' : '대화 입력'}
            editable={!isSubmitting}
            multiline
            onChangeText={setBody}
            placeholder={isReplying ? '답글을 남겨 주세요' : '이 책의 생각을 나눠 주세요'}
            placeholderTextColor="#8C8C8C"
            style={[styles.bodyInput, styles.bodyInputFlexible]}
            value={body}
          />
          </View>
          {mentionCandidates.length > 0 ? (
            <View accessibilityLabel="멘션 후보" style={styles.mentionCandidates}>
              {mentionCandidates.map((member) => (
                <Pressable
                  accessibilityLabel={`${member.displayName} · ${member.mentionToken} 멘션`}
                  accessibilityRole="button"
                  key={member.id}
                  onPress={() => handleSelectMention(member)}
                  style={styles.mentionCandidate}
                >
                  <Text numberOfLines={1} style={styles.mentionCandidateText}>
                    {member.displayName} · {member.mentionToken}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {composerNotice ? (
            <Text accessibilityLiveRegion="polite" style={styles.composerNotice}>
              {composerNotice}
            </Text>
          ) : null}
          {saveError ? <Text accessibilityRole="alert" style={styles.saveError}>{saveError}</Text> : null}
          <View style={styles.composerActions}>
            {failedSubmission ? (
              <Pressable
                accessibilityLabel="저장 다시 시도"
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={handleRetrySubmission}
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.secondaryActionPressed]}
              >
                <Text style={styles.secondaryActionText}>저장 다시 시도</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel={isReplying ? '답글 남기기' : '글 남기기'}
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={({ pressed }) => [styles.submitAction, isSubmitting && styles.submitActionDisabled, pressed && styles.submitActionPressed]}
            >
              {isSubmitting ? <ActivityIndicator color="#000000" /> : <Text style={styles.submitActionText}>{isReplying ? '답글 남기기' : '글 남기기'}</Text>}
            </Pressable>
          </View>
        </View>
        )}
        {isRatingSheetOpen ? (
          <RatingSheet
            ratings={ratingsQuery.data ?? []}
            ratingError={ratingError}
            selectedRating={selectedRating}
            ratingReview={ratingReview}
            isArchived={isArchived}
            isEditorOpen={isRatingEditorOpen}
            isError={ratingsQuery.isError}
            isLoading={ratingsQuery.isPending}
            isSaving={isRatingSaving}
            onCancelEditor={handleCancelRatingEditor}
            onClose={handleCloseRatingSheet}
            onOpenEditor={handleOpenRatingEditor}
            onRemove={handleRemoveRating}
            onRetry={() => void ratingsQuery.refetch()}
            onReviewChange={setRatingReview}
            onSave={handleSaveRating}
            onSelectRating={setSelectedRating}
          />
        ) : null}
        {menuView !== null ? (
          <MobileMessageActionSheet
            canCreateRoomInvite={canManageRoomContent(roleQuery.data ?? null)}
            initialView={menuView}
            isInviteBusy={isInviteBusy}
            isReplying={isReplying}
            onAddLabel={handleAddLabel}
            onClose={() => setMenuView(null)}
            onOpenRating={handleOpenRatingSheet}
            onOpenRoomInvite={() => void handleOpenRoomInvite()}
            onOpenVideoArchive={handleOpenVideoArchive}
            onOpenVideoUpload={() => setIsVideoUploadOpen(true)}
            onPickPhoto={(source) => void handlePickPhoto(source)}
            onRequestRoomInvite={() => void handleRequestRoomInvite()}
            onWriteQuote={() => setQuoteSource({ photo: null })}
          />
        ) : null}
        {isVideoUploadOpen ? (
          <MobileVideoUploadSheet bookChatId={bookChatId} onClose={() => setIsVideoUploadOpen(false)} roomId={roomId} />
        ) : null}
        {quoteSource ? (
          <MobilePhotoQuoteFlow
            bookChatId={bookChatId}
            onClose={() => setQuoteSource(null)}
            onInsert={handleInsertQuote}
            onPickAnotherPhoto={handlePickAnotherPhoto}
            photo={quoteSource.photo}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

/** 라벨 종류와 값을 검증해 저장 가능한 라벨로 만들고, 올바르지 않으면 null을 반환한다. */
function createDraftLabel(kind: MobileLabelKind, value: string): PostLabel | null {
  try {
    return parsePostForm({ body: '', labels: [{ kind, value }] }).labels[0] ?? null
  } catch {
    return null
  }
}

/** 라벨을 화면 표시용 문자열(페이지 87·챕터 3장)로 바꾼다. 직접 적은 라벨은 그대로 둔다. */
function formatPostLabel(postLabel: PostLabel): string {
  if (postLabel.kind === 'page') return `페이지 ${postLabel.value}`
  if (postLabel.kind === 'chapter') return `챕터 ${postLabel.value}`
  return postLabel.value
}

type DiscussionTimelineProps = {
  isError: boolean
  isLoading: boolean
  onReply?: (post: DiscussionPost) => void
  onRetry(): void
  posts: readonly DiscussionPost[]
}

/** 대화 타임라인을 로딩·오류·빈 상태와 실제 텍스트 글 상태로 구분해 표시한다. */
function DiscussionTimeline({
  isError,
  isLoading,
  onReply,
  onRetry,
  posts,
}: DiscussionTimelineProps): React.JSX.Element {
  if (isLoading) return <TimelineLoadingState />
  if (isError) return <TimelineErrorState onRetry={onRetry} />
  if (posts.length === 0) return <TimelineEmptyState />

  return (
    <View accessibilityLabel="책 대화 목록" style={styles.postList}>
      {posts.map((post) => <DiscussionPostCard key={post.id} onReply={onReply} post={post} />)}
    </View>
  )
}

/** 텍스트 대화 데이터를 기다리는 동안 읽을 수 있는 전체 타임라인 로더를 표시한다. */
function TimelineLoadingState(): React.JSX.Element {
  return (
    <View accessibilityLabel="대화를 불러오고 있어요." accessibilityRole="progressbar" style={styles.timelineState}>
      <ActivityIndicator color="#FF835F" />
      <Text style={styles.stateText}>대화를 불러오고 있어요.</Text>
    </View>
  )
}

/** 일시적 타임라인 오류를 알리고 조회만 다시 시도할 수 있게 한다. */
function TimelineErrorState({ onRetry }: { onRetry(): void }): React.JSX.Element {
  return (
    <View style={styles.timelineState}>
      <Text accessibilityRole="alert" style={styles.errorText}>대화를 불러오지 못했어요. 다시 시도해 주세요.</Text>
      <SecondaryAction label="다시 시도" onPress={onRetry} />
    </View>
  )
}

/** 아직 텍스트 글이 없는 책 대화에서 시작 방법을 안내한다. */
function TimelineEmptyState(): React.JSX.Element {
  return (
    <View style={styles.timelineState}>
      <Text style={styles.emptyTitle}>아직 나눈 이야기가 없어요.</Text>
      <Text style={styles.stateText}>첫 생각을 남기며 이 책의 대화를 시작해 보세요.</Text>
    </View>
  )
}

/** 루트 글과 한 단계 답글의 들여쓰기·라벨·답글 시작점을 표시한다. */
function DiscussionPostCard({
  onReply,
  post,
}: {
  onReply?: (post: DiscussionPost) => void
  post: DiscussionPost
}): React.JSX.Element {
  /** 루트 글에만 한 단계 답글 작성 상태를 연다. */
  function handleReply(): void {
    if (onReply === undefined) return
    onReply(post)
  }

  return (
    <View style={[styles.postCard, post.depth === 1 && styles.replyCard]}>
      <Text style={styles.postAuthor}>{post.authorName}</Text>
      {post.labels.length > 0 ? (
        <View style={styles.labels}>
          {post.labels.map((postLabel) => <Text key={`${postLabel.kind}-${postLabel.value}`} style={styles.label}>{formatPostLabel(postLabel)}</Text>)}
        </View>
      ) : null}
      {post.body ? <Text style={styles.postBody}>{post.body}</Text> : null}
      {post.depth === 0 && onReply !== undefined ? (
        <Pressable accessibilityLabel={`${post.authorName}님에게 답글`} accessibilityRole="button" onPress={handleReply} style={styles.replyAction}>
          <Text style={styles.replyActionText}>답글</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/** 권한이 확인되는 동안 책 대화 전체를 로딩 상태로 표시한다. */
function DiscussionLoadingState({ label }: { label: string }): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.fullState}>
        <ActivityIndicator color="#FF835F" />
        <Text style={styles.stateText}>{label}</Text>
      </View>
    </SafeAreaView>
  )
}

/** RLS가 아닌 조회 실패를 안전한 일반 오류와 재시도 동작으로 표시한다. */
function DiscussionErrorState({ onRetry }: { onRetry(): void }): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.fullState}>
        <Text accessibilityRole="alert" style={styles.errorText}>책 대화를 불러오지 못했어요. 다시 시도해 주세요.</Text>
        <SecondaryAction label="다시 시도" onPress={onRetry} />
      </View>
    </SafeAreaView>
  )
}

/** 경로와 일치하는 멤버 공개 책 대화가 없을 때 목록 복귀만 제공한다. */
function DiscussionUnavailableState({ onBack }: { onBack(): void }): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.fullState}>
        <Text style={styles.emptyTitle}>이 책 대화를 찾을 수 없어요</Text>
        <Text style={styles.stateText}>참여 중인 책방에서 다시 선택해 주세요.</Text>
        <PrimaryAction label="내 책방으로" onPress={onBack} />
      </View>
    </SafeAreaView>
  )
}

type ActionProps = { label: string; onPress(): void }

/** 중요 복귀 행동에 사용하는 44px 브랜드 버튼을 표시한다. */
function PrimaryAction({ label, onPress }: ActionProps): React.JSX.Element {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={styles.primaryAction}><Text style={styles.primaryActionText}>{label}</Text></Pressable>
}

/** 재시도처럼 보조 행동에 사용하는 44px 외곽선 버튼을 표시한다. */
function SecondaryAction({ label, onPress }: ActionProps): React.JSX.Element {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>{label}</Text></Pressable>
}

/** 현재 입력 끝의 @검색어와 일치하는 후보만 멘션 선택창에 반환한다. */
function getMatchingMentionCandidates(
  candidates: readonly MobileDiscussionMember[],
  body: string,
): MobileDiscussionMember[] {
  const query = getActiveMentionQuery(body)
  if (query === null) return []
  const normalizedQuery = query.toLocaleLowerCase('ko-KR')
  return candidates.filter((candidate) =>
    candidate.displayName.toLocaleLowerCase('ko-KR').includes(normalizedQuery) ||
    candidate.mentionToken.toLocaleLowerCase('ko-KR').includes(normalizedQuery),
  )
}

/** 메시지 마지막 단어에서 활성 @ 멘션 검색어를 추출한다. */
function getActiveMentionQuery(body: string): string | null {
  const result = body.match(/(?:^|\s)@([^\s@]*)$/u)
  return result?.[1] ?? null
}

/** 본문에 완성된 고유 멘션 토큰만 식별자로 변환하고 중복 없이 최대 여섯 명을 반환한다. */
function getMentionedMemberIds(
  body: string,
  candidates: readonly MobileDiscussionMember[],
): string[] {
  const candidateIds = new Map(candidates.map((candidate) => [candidate.mentionToken, candidate.id]))
  const ids = [...body.matchAll(/(?:^|\s)@([^\s@]+)/gu)]
    .map((match) => candidateIds.get(match[1] ?? ''))
    .filter((memberId): memberId is string => memberId !== undefined)
  return [...new Set(ids)].slice(0, 6)
}

/** 활성 @검색어를 선택한 멤버의 완전한 고유 토큰으로 바꾸고 다음 입력 공백을 추가한다. */
function insertMentionToken(body: string, mentionToken: string): string {
  const activeMentionPattern = /(^|\s)@[^\s@]*$/u
  if (activeMentionPattern.test(body)) {
    return body.replace(activeMentionPattern, (_match, prefix: string) => `${prefix}@${mentionToken} `)
  }
  const separator = body.length === 0 || body.endsWith(' ') ? '' : ' '
  return `${body}${separator}@${mentionToken} `
}

/** 현재 플랫폼의 암호학적 UUID를 한 번의 저장 시도에만 쓰는 idempotency 키로 반환한다. */
function createSubmissionClientId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('기기에서 제출 식별자를 만들 수 없어요.')
  }
  return globalThis.crypto.randomUUID()
}

type RatingSheetProps = {
  ratingError: string | null
  selectedRating: number | null
  ratingReview: string
  ratings: readonly BookChatRating[]
  isArchived: boolean
  isEditorOpen: boolean
  isError: boolean
  isLoading: boolean
  isSaving: boolean
  onCancelEditor(): void
  onClose(): void
  onOpenEditor(): void
  onRemove(): void
  onRetry(): void
  onReviewChange(value: string): void
  onSave(): void
  onSelectRating(rating: number): void
}

/** 평균 별점과 멤버 별점, 현재 회원의 작성·수정·삭제 제어를 하단 시트로 표시한다. */
function RatingSheet({
  ratingError,
  selectedRating,
  ratingReview,
  ratings,
  isArchived,
  isEditorOpen,
  isError,
  isLoading,
  isSaving,
  onCancelEditor,
  onClose,
  onOpenEditor,
  onRemove,
  onRetry,
  onReviewChange,
  onSave,
  onSelectRating,
}: RatingSheetProps): React.JSX.Element {
  const ownRating = ratings.find((rating) => rating.isMe)

  return (
    <View
      accessibilityLabel="별점 시트"
      accessibilityViewIsModal
      style={styles.ratingBackdrop}
    >
      <View style={styles.ratingSheet}>
        <View style={styles.ratingSheetHeader}>
          <Text style={styles.ratingSheetTitle}>별점</Text>
          <Pressable
            accessibilityLabel="별점 닫기"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onClose}
            style={styles.ratingCloseAction}
          >
            <Text style={styles.ratingCloseActionText}>닫기</Text>
          </Pressable>
        </View>
        {isLoading ? <RatingLoadingState /> : null}
        {!isLoading && isError ? <RatingErrorState onRetry={onRetry} /> : null}
        {!isLoading && !isError && isEditorOpen ? (
          <RatingEditor
            error={ratingError}
            isSaving={isSaving}
            onCancel={onCancelEditor}
            onReviewChange={onReviewChange}
            onSave={onSave}
            onSelectRating={onSelectRating}
            rating={selectedRating}
            review={ratingReview}
          />
        ) : null}
        {!isLoading && !isError && !isEditorOpen ? (
          <>
            <RatingAverage ratings={ratings} />
            <RatingRoster ratings={ratings} />
            {ratingError ? <Text accessibilityRole="alert" style={styles.saveError}>{ratingError}</Text> : null}
            {!isArchived ? (
              <View style={styles.sheetActions}>
                <Pressable
                  accessibilityLabel={ownRating ? '수정하기' : '별점 남기기'}
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={onOpenEditor}
                  style={styles.ratingPrimaryAction}
                >
                  <Text style={styles.ratingPrimaryActionText}>{ownRating ? '수정하기' : '별점 남기기'}</Text>
                </Pressable>
                {ownRating ? (
                  <Pressable
                    accessibilityLabel="별점 삭제"
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={onRemove}
                    style={styles.ratingSecondaryAction}
                  >
                    <Text style={styles.ratingSecondaryActionText}>별점 삭제</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  )
}

/** 별점 조회 실패를 알리고 같은 책 대화 범위에서만 다시 불러온다. */
function RatingErrorState({ onRetry }: { onRetry(): void }): React.JSX.Element {
  return (
    <View style={styles.ratingLoadingState}>
      <Text accessibilityRole="alert" style={styles.errorText}>별점을 불러오지 못했어요. 다시 시도해 주세요.</Text>
      <SecondaryAction label="별점 다시 시도" onPress={onRetry} />
    </View>
  )
}

/** 별점을 기다리는 동안 시트 안에서 짧은 진행 상태를 제공한다. */
function RatingLoadingState(): React.JSX.Element {
  return (
    <View accessibilityLabel="별점을 불러오고 있어요." accessibilityRole="progressbar" style={styles.ratingLoadingState}>
      <ActivityIndicator color="#FF835F" />
      <Text style={styles.stateText}>별점을 불러오고 있어요.</Text>
    </View>
  )
}

/** 멤버 별점의 평균과 참여 인원을 계산해 시트 상단에 표시한다. */
function RatingAverage({ ratings }: { ratings: readonly BookChatRating[] }): React.JSX.Element {
  const average = calculateAverageRating([...ratings])

  return (
    <View style={styles.ratingAverage}>
      <Text style={styles.ratingAverageText}>
        {average === null ? '아직 평균 별점이 없어요' : `평균 ${average}`}
      </Text>
      {average === null ? null : <Text style={styles.ratingCountText}>{`${ratings.length}명 참여`}</Text>}
    </View>
  )
}

/** 책방 멤버가 남긴 별점과 총평을 개인 표시와 함께 렌더링한다. */
function RatingRoster({ ratings }: { ratings: readonly BookChatRating[] }): React.JSX.Element {
  if (ratings.length === 0) {
    return <Text style={styles.ratingEmptyText}>아직 별점을 남긴 멤버가 없어요.</Text>
  }

  return (
    <View accessibilityLabel="멤버 별점" style={styles.ratingRoster}>
      {ratings.map((rating) => (
        <View key={rating.profileId} style={styles.ratingMember}>
          <Text style={styles.ratingMemberName}>{rating.isMe ? '나' : rating.displayName}</Text>
          {rating.rating ? <Text accessibilityLabel={`${rating.rating}점`} style={styles.memberRatingText}>{'★'.repeat(rating.rating)}</Text> : null}
          {rating.review ? <Text style={styles.ratingReviewText}>{rating.review}</Text> : null}
        </View>
      ))}
    </View>
  )
}

type RatingEditorProps = {
  error: string | null
  isSaving: boolean
  onCancel(): void
  onReviewChange(value: string): void
  onSave(): void
  onSelectRating(rating: number): void
  rating: number | null
  review: string
}

/** 별점과 천 자 이내 총평을 입력해 개인 별점으로 저장하는 편집기를 표시한다. */
function RatingEditor({
  error,
  isSaving,
  onCancel,
  onReviewChange,
  onSave,
  onSelectRating,
  rating,
  review,
}: RatingEditorProps): React.JSX.Element {
  return (
    <View style={styles.ratingEditor}>
      <Text style={styles.ratingEditorLabel}>별점</Text>
      <View accessibilityLabel="별점 선택" style={styles.ratingActions}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Pressable
            accessibilityLabel={`${score}점`}
            accessibilityRole="button"
            accessibilityState={{ selected: rating === score }}
            key={score}
            onPress={() => onSelectRating(score)}
            style={[styles.ratingAction, rating !== null && score <= rating && styles.ratingActionSelected]}
          >
            <Text style={[styles.ratingActionText, rating !== null && score <= rating && styles.ratingActionTextSelected]}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        accessibilityLabel="총평"
        editable={!isSaving}
        maxLength={1000}
        multiline
        onChangeText={onReviewChange}
        placeholder="이 책에 대한 생각을 적어 주세요. (선택)"
        placeholderTextColor="#8C8C8C"
        style={styles.ratingReviewInput}
        value={review}
      />
      <Text accessibilityLabel={`총평 ${review.length}자`} style={styles.ratingLengthText}>{review.length}/1000</Text>
      {error ? <Text accessibilityRole="alert" style={styles.saveError}>{error}</Text> : null}
      <View style={styles.sheetActions}>
        <Pressable accessibilityLabel="취소" accessibilityRole="button" disabled={isSaving} onPress={onCancel} style={styles.ratingSecondaryAction}>
          <Text style={styles.ratingSecondaryActionText}>취소</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="별점 저장"
          accessibilityRole="button"
          disabled={isSaving}
          onPress={onSave}
          style={[styles.ratingPrimaryAction, isSaving && styles.submitActionDisabled]}
        >
          {isSaving ? <ActivityIndicator color="#000000" /> : <Text style={styles.ratingPrimaryActionText}>별점 저장</Text>}
        </Pressable>
      </View>
    </View>
  )
}

/** 별점 변경 뒤 책 대화 별점 현황과 내 별점 도서 캐시를 최신화한다. */
async function invalidateRatingCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  bookChatId: string,
  profileId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: bookRatingKeys.byChat(bookChatId) }),
    queryClient.invalidateQueries({ queryKey: bookRatingKeys.myBooks(profileId) }),
  ])
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  archivedDescription: { color: '#BDBDBD', fontSize: 14, lineHeight: 20, marginTop: 4 },
  archivedNotice: { backgroundColor: '#171717', borderColor: '#393939', borderTopWidth: 1, paddingBottom: 16, paddingHorizontal: 16, paddingTop: 12 },
  archivedNoticeText: { color: '#FFB5A3', fontSize: 15, fontWeight: '700', lineHeight: 22 },
  backButtonText: { color: '#FFFFFF', fontSize: 32, lineHeight: 36 },
  bodyInputFlexible: { flex: 1 },
  composerIconButton: {
    alignItems: 'center',
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: mobileTouchTarget,
    minWidth: mobileTouchTarget,
  },
  composerIconText: { color: mobileColors.ink, fontSize: 24, lineHeight: 28 },
  composerNotice: { color: mobileColors.inkSubtle, fontSize: 14, lineHeight: 20 },
  composerPhotoText: { color: mobileColors.ink, fontSize: 13, fontWeight: '600' },
  composerRow: { alignItems: 'flex-start', flexDirection: 'row', gap: mobileSpacing.xs },
  labelChip: {
    alignItems: 'center',
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: mobileSpacing.xxs,
    justifyContent: 'center',
    minHeight: mobileTouchTarget,
    paddingHorizontal: mobileSpacing.sm,
  },
  labelChipText: { color: mobileColors.inkSubtle, fontSize: 13 },
  labelChips: { flexDirection: 'row', flexWrap: 'wrap', gap: mobileSpacing.xs },
  bodyInput: { backgroundColor: '#101010', borderColor: '#393939', borderRadius: 12, borderWidth: 1, color: '#FFFFFF', fontSize: 16, lineHeight: 24, maxHeight: 120, minHeight: 76, padding: 12, textAlignVertical: 'top' },
  composer: { backgroundColor: '#000000', borderColor: '#393939', borderTopWidth: 1, gap: 8, paddingBottom: 12, paddingHorizontal: 16, paddingTop: 12 },
  composerActions: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  sheetActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 16 },
  ratingAverage: { alignItems: 'baseline', flexDirection: 'row', gap: 8, marginTop: 16 },
  ratingAverageText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', lineHeight: 22 },
  ratingCountText: { color: '#C7C7C7', fontSize: 13, lineHeight: 20 },
  ratingBackdrop: { backgroundColor: 'rgba(0, 0, 0, 0.72)', bottom: 0, justifyContent: 'flex-end', left: 0, position: 'absolute', right: 0, top: 0 },
  ratingCloseAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  ratingCloseActionText: { color: '#FFB5A3', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  ratingEditor: { gap: 12, marginTop: 16 },
  ratingEditorLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', lineHeight: 22 },
  ratingEmptyText: { color: '#C7C7C7', fontSize: 15, lineHeight: 22, marginTop: 16 },
  ratingHeaderAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, paddingHorizontal: 4 },
  ratingHeaderActionText: { color: '#FFB5A3', fontSize: 13, fontWeight: '700', lineHeight: 20 },
  ratingLengthText: { alignSelf: 'flex-end', color: '#8C8C8C', fontSize: 12, lineHeight: 18, marginTop: -8 },
  ratingLoadingState: { alignItems: 'center', gap: 12, minHeight: 180, justifyContent: 'center' },
  ratingMember: { borderColor: '#393939', borderRadius: 12, borderWidth: 1, padding: 12 },
  ratingMemberName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', lineHeight: 22 },
  ratingPrimaryAction: { alignItems: 'center', backgroundColor: '#FF835F', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  ratingPrimaryActionText: { color: '#000000', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  memberRatingText: { color: '#FF835F', fontSize: 15, letterSpacing: 1, lineHeight: 22, marginTop: 4 },
  ratingReviewInput: { backgroundColor: '#101010', borderColor: '#393939', borderRadius: 12, borderWidth: 1, color: '#FFFFFF', fontSize: 16, lineHeight: 24, minHeight: 108, padding: 12, textAlignVertical: 'top' },
  ratingReviewText: { color: '#C7C7C7', fontSize: 14, lineHeight: 20, marginTop: 4 },
  ratingRoster: { gap: 8, marginTop: 16 },
  ratingSecondaryAction: { alignItems: 'center', borderColor: '#FF835F', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  ratingSecondaryActionText: { color: '#FF835F', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  ratingSheet: { backgroundColor: '#101010', borderColor: '#393939', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, maxHeight: '82%', paddingBottom: 24, paddingHorizontal: 16, paddingTop: 12 },
  ratingSheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  ratingSheetTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 26 },
  container: { backgroundColor: '#000000', flex: 1 },
  emptyTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 24, textAlign: 'center' },
  errorText: { color: '#FF8A8A', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  fullState: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', paddingHorizontal: 16 },
  header: { alignItems: 'center', borderColor: '#202020', borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8 },
  headerCopy: { alignItems: 'center', flex: 1 },
  headerSpacer: { minWidth: 44 },
  keyboardAvoidingView: { flex: 1 },
  label: { backgroundColor: '#2D1712', borderRadius: 8, color: '#FFB5A3', fontSize: 13, lineHeight: 18, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  mentionCandidate: { borderColor: '#393939', borderRadius: 8, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  mentionCandidateText: { color: '#FFB5A3', fontSize: 14, lineHeight: 20 },
  mentionCandidates: { gap: 4, maxHeight: 140 },
  postAuthor: { color: '#FF835F', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  postBody: { color: '#FFFFFF', fontSize: 16, lineHeight: 24, marginTop: 8 },
  postCard: { backgroundColor: '#101010', borderColor: '#393939', borderRadius: 12, borderWidth: 1, padding: 12 },
  postList: { gap: 12 },
  primaryAction: { alignItems: 'center', backgroundColor: '#FF835F', borderRadius: 12, justifyContent: 'center', minHeight: 48, minWidth: 160, paddingHorizontal: 16 },
  primaryActionText: { color: '#000000', fontSize: 16, fontWeight: '700', lineHeight: 24 },
  replyAction: { alignItems: 'flex-start', justifyContent: 'center', marginTop: 8, minHeight: 44 },
  replyActionText: { color: '#FFB5A3', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  replyBanner: { alignItems: 'center', backgroundColor: '#2D1712', borderRadius: 8, flexDirection: 'row', minHeight: 44, paddingHorizontal: 12 },
  replyBannerText: { color: '#FFB5A3', flex: 1, fontSize: 14, lineHeight: 20 },
  replyCancelButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  replyCancelText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  replyCard: { borderColor: '#FF835F', marginLeft: 24 },
  ratingAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  ratingActionSelected: { backgroundColor: '#2D1712', borderRadius: 12 },
  ratingActionText: { color: '#606060', fontSize: 28, lineHeight: 36 },
  ratingActionTextSelected: { color: '#FF835F' },
  ratingActions: { flexDirection: 'row', gap: 4 },
  saveError: { color: '#FF8A8A', fontSize: 14, lineHeight: 20 },
  secondaryAction: { alignItems: 'center', borderColor: '#FF835F', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  secondaryActionPressed: { backgroundColor: '#2D1712' },
  secondaryActionText: { color: '#FF835F', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  stateText: { color: '#C7C7C7', fontSize: 15, lineHeight: 22, maxWidth: 280, textAlign: 'center' },
  submitAction: { alignItems: 'center', backgroundColor: '#FF835F', borderRadius: 12, justifyContent: 'center', minHeight: 44, minWidth: 92, paddingHorizontal: 12 },
  submitActionDisabled: { backgroundColor: '#A64F3A' },
  submitActionPressed: { backgroundColor: '#FFB5A3' },
  submitActionText: { color: '#000000', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  subtitle: { color: '#FFB5A3', fontSize: 12, lineHeight: 18, marginTop: 2 },
  timeline: { flexGrow: 1, padding: 16 },
  timelineState: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', minHeight: 240 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', lineHeight: 24 },
  videoHeaderAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  videoHeaderActionText: { color: '#FF835F', fontSize: 14, fontWeight: '700' },
})
