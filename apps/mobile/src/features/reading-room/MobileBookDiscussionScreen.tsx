import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  bookChatKeys,
  bookCompletionKeys,
  parseBookCompletionInput,
  parsePostForm,
  postKeys,
  readingRoomKeys,
  type BookChatCompletion,
  type BookCompletionInput,
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
  getMobileBookChatCompletions,
  removeMobileBookChatCompletion,
  upsertMobileBookChatCompletion,
} from '../../entities/book-completion'
import { getMobileDiscussionBookChat } from '../../entities/reading-room'
import { useMobileSessionProfileId } from '../../shared/api/MobileAppProviders'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'

type MobileBookDiscussionScreenProps = {
  bookChatId: string
  onBack(): void
  roomId: string
}

type Submission = {
  clientId: string
  rootPostId: string | null
  values: PostForm
}

/** RLS로 허용된 책 대화의 텍스트 글·답글·라벨·멘션을 기기 화면에서 작성하고 표시한다. */
export function MobileBookDiscussionScreen({
  bookChatId,
  onBack,
  roomId,
}: MobileBookDiscussionScreenProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const profileId = useMobileSessionProfileId()
  const [body, setBody] = useState('')
  const [label, setLabel] = useState('')
  const [replyTo, setReplyTo] = useState<DiscussionPost | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [failedSubmission, setFailedSubmission] = useState<Submission | null>(null)
  const [isCompletionSheetOpen, setIsCompletionSheetOpen] = useState(false)
  const [isCompletionEditorOpen, setIsCompletionEditorOpen] = useState(false)
  const [completionRating, setCompletionRating] = useState<number | null>(null)
  const [completionReview, setCompletionReview] = useState('')
  const [completionError, setCompletionError] = useState<string | null>(null)
  const [isCompletionSaving, setIsCompletionSaving] = useState(false)

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

  /** 현재 로그인 회원을 기준으로 책 대화 완독 기록과 방 멤버 표시명을 함께 읽어 온다. */
  async function fetchCompletions(): Promise<BookChatCompletion[]> {
    if (profileId === null) return []
    return getMobileBookChatCompletions(createMobileSupabaseClient(), bookChatId, profileId)
  }

  const completionsQuery = useQuery({
    enabled:
      profileId !== null &&
      bookChatQuery.data !== null &&
      bookChatQuery.data !== undefined,
    queryFn: fetchCompletions,
    queryKey: bookCompletionKeys.byChat(bookChatId),
  })

  /** 저장할 값과 멘션 대상을 검증해 한 번의 제출에 사용할 입력 모델로 만든다. */
  function createSubmission(): Submission | null {
    try {
      const values = parsePostForm({
        body,
        labels: replyTo === null && label.trim() ? [{ kind: 'custom', value: label }] : [],
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
      setLabel('')
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
    setLabel('')
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

  /** 실패한 책 대화 조회를 다시 요청해 일시적 네트워크 오류를 분리한다. */
  function handleRetryBookChat(): void {
    void bookChatQuery.refetch()
  }

  /** 실패한 텍스트 타임라인 조회를 같은 권한 범위에서 다시 요청한다. */
  function handleRetryPosts(): void {
    void postsQuery.refetch()
  }

  /** 완독 기록 시트를 열고 기존 기록은 목록 상태로 먼저 확인하도록 한다. */
  function handleOpenCompletionSheet(): void {
    setCompletionError(null)
    setIsCompletionEditorOpen(false)
    setIsCompletionSheetOpen(true)
  }

  /** 완독 기록 시트와 작성 중이던 입력을 닫아 다음 열기에서 최신 데이터를 사용한다. */
  function handleCloseCompletionSheet(): void {
    if (isCompletionSaving) return
    setCompletionError(null)
    setIsCompletionEditorOpen(false)
    setIsCompletionSheetOpen(false)
  }

  /** 현재 회원의 기존 완독 값 또는 빈 입력으로 별점·총평 편집 상태를 연다. */
  function handleOpenCompletionEditor(): void {
    const ownCompletion = completionsQuery.data?.find((completion) => completion.isMe)
    setCompletionRating(ownCompletion?.rating ?? null)
    setCompletionReview(ownCompletion?.review ?? '')
    setCompletionError(null)
    setIsCompletionEditorOpen(true)
  }

  /** 편집 상태만 닫고 완독 멤버 목록과 기존 저장 내용은 유지한다. */
  function handleCancelCompletionEditor(): void {
    if (isCompletionSaving) return
    setCompletionError(null)
    setIsCompletionEditorOpen(false)
  }

  /** 별점과 천 자 이내 총평을 검증해 현재 회원의 완독 기록으로 저장한다. */
  async function handleSaveCompletion(): Promise<void> {
    if (profileId === null || isCompletionSaving) return

    let input: BookCompletionInput
    try {
      input = parseBookCompletionInput({
        bookChatId,
        rating: completionRating,
        review: completionReview.trim() || null,
      })
    } catch {
      setCompletionError('별점은 1점부터 5점까지, 총평은 1,000자 이내로 남겨 주세요.')
      return
    }

    setIsCompletionSaving(true)
    setCompletionError(null)
    try {
      await upsertMobileBookChatCompletion(createMobileSupabaseClient(), input)
      setIsCompletionEditorOpen(false)
      await invalidateCompletionCaches(queryClient, bookChatId, profileId)
      await completionsQuery.refetch()
    } catch {
      setCompletionError('완독 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsCompletionSaving(false)
    }
  }

  /** 현재 회원의 완독 기록만 제거하고 책방·내 정보 화면의 관련 캐시를 갱신한다. */
  async function handleRemoveCompletion(): Promise<void> {
    if (profileId === null || isCompletionSaving) return

    setIsCompletionSaving(true)
    setCompletionError(null)
    try {
      await removeMobileBookChatCompletion(createMobileSupabaseClient(), bookChatId)
      await invalidateCompletionCaches(queryClient, bookChatId, profileId)
      await completionsQuery.refetch()
    } catch {
      setCompletionError('완독 기록을 취소하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsCompletionSaving(false)
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
          <Pressable
            accessibilityLabel="완독 기록"
            accessibilityRole="button"
            onPress={handleOpenCompletionSheet}
            style={styles.completionHeaderAction}
          >
            <Text style={styles.completionHeaderActionText}>완독</Text>
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
          <TextInput
            accessibilityLabel={isReplying ? '답글 입력' : '대화 입력'}
            editable={!isSubmitting}
            multiline
            onChangeText={setBody}
            placeholder={isReplying ? '답글을 남겨 주세요' : '이 책의 생각을 나눠 주세요'}
            placeholderTextColor="#8C8C8C"
            style={styles.bodyInput}
            value={body}
          />
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
          {!isReplying ? (
            <TextInput
              accessibilityLabel="라벨"
              editable={!isSubmitting}
              onChangeText={setLabel}
              placeholder="라벨 (예: 87쪽)"
              placeholderTextColor="#8C8C8C"
              style={styles.labelInput}
              value={label}
            />
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
        {isCompletionSheetOpen ? (
          <CompletionSheet
            completions={completionsQuery.data ?? []}
            completionError={completionError}
            completionRating={completionRating}
            completionReview={completionReview}
            isArchived={isArchived}
            isEditorOpen={isCompletionEditorOpen}
            isError={completionsQuery.isError}
            isLoading={completionsQuery.isPending}
            isSaving={isCompletionSaving}
            onCancelEditor={handleCancelCompletionEditor}
            onClose={handleCloseCompletionSheet}
            onOpenEditor={handleOpenCompletionEditor}
            onRemove={handleRemoveCompletion}
            onRetry={() => void completionsQuery.refetch()}
            onReviewChange={setCompletionReview}
            onSave={handleSaveCompletion}
            onSelectRating={setCompletionRating}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
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
          {post.labels.map((postLabel) => <Text key={`${postLabel.kind}-${postLabel.value}`} style={styles.label}>{postLabel.value}</Text>)}
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

type CompletionSheetProps = {
  completionError: string | null
  completionRating: number | null
  completionReview: string
  completions: readonly BookChatCompletion[]
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

/** 책 대화의 완독 멤버 현황과 현재 회원의 작성·수정·취소 제어를 하단 시트로 표시한다. */
function CompletionSheet({
  completionError,
  completionRating,
  completionReview,
  completions,
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
}: CompletionSheetProps): React.JSX.Element {
  const ownCompletion = completions.find((completion) => completion.isMe)

  return (
    <View
      accessibilityLabel="완독 기록 시트"
      accessibilityViewIsModal
      style={styles.completionBackdrop}
    >
      <View style={styles.completionSheet}>
        <View style={styles.completionSheetHeader}>
          <Text style={styles.completionSheetTitle}>완독 기록</Text>
          <Pressable
            accessibilityLabel="완독 기록 닫기"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onClose}
            style={styles.completionCloseAction}
          >
            <Text style={styles.completionCloseActionText}>닫기</Text>
          </Pressable>
        </View>
        {isLoading ? <CompletionLoadingState /> : null}
        {!isLoading && isError ? <CompletionErrorState onRetry={onRetry} /> : null}
        {!isLoading && !isError && isEditorOpen ? (
          <CompletionEditor
            error={completionError}
            isSaving={isSaving}
            onCancel={onCancelEditor}
            onReviewChange={onReviewChange}
            onSave={onSave}
            onSelectRating={onSelectRating}
            rating={completionRating}
            review={completionReview}
          />
        ) : null}
        {!isLoading && !isError && !isEditorOpen ? (
          <>
            <CompletionRoster completions={completions} />
            {completionError ? <Text accessibilityRole="alert" style={styles.saveError}>{completionError}</Text> : null}
            {!isArchived ? (
              <View style={styles.completionActions}>
                <Pressable
                  accessibilityLabel={ownCompletion ? '완독 기록 수정' : '완독하기'}
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={onOpenEditor}
                  style={styles.completionPrimaryAction}
                >
                  <Text style={styles.completionPrimaryActionText}>{ownCompletion ? '완독 기록 수정' : '완독하기'}</Text>
                </Pressable>
                {ownCompletion ? (
                  <Pressable
                    accessibilityLabel="완독 취소"
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={onRemove}
                    style={styles.completionSecondaryAction}
                  >
                    <Text style={styles.completionSecondaryActionText}>완독 취소</Text>
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

/** 완독 현황 조회 실패를 알리고 같은 책 대화 범위에서만 다시 불러온다. */
function CompletionErrorState({ onRetry }: { onRetry(): void }): React.JSX.Element {
  return (
    <View style={styles.completionLoadingState}>
      <Text accessibilityRole="alert" style={styles.errorText}>완독 현황을 불러오지 못했어요. 다시 시도해 주세요.</Text>
      <SecondaryAction label="완독 현황 다시 시도" onPress={onRetry} />
    </View>
  )
}

/** 완독 현황을 기다리는 동안 시트 안에서 짧은 진행 상태를 제공한다. */
function CompletionLoadingState(): React.JSX.Element {
  return (
    <View accessibilityLabel="완독 현황을 불러오고 있어요." accessibilityRole="progressbar" style={styles.completionLoadingState}>
      <ActivityIndicator color="#FF835F" />
      <Text style={styles.stateText}>완독 현황을 불러오고 있어요.</Text>
    </View>
  )
}

/** 책방 멤버가 남긴 별점과 총평을 개인 표시와 함께 시간순으로 렌더링한다. */
function CompletionRoster({ completions }: { completions: readonly BookChatCompletion[] }): React.JSX.Element {
  if (completions.length === 0) {
    return <Text style={styles.completionEmptyText}>아직 완독한 멤버가 없어요.</Text>
  }

  return (
    <View accessibilityLabel="완독한 멤버" style={styles.completionRoster}>
      {completions.map((completion) => (
        <View key={completion.profileId} style={styles.completionMember}>
          <Text style={styles.completionMemberName}>{completion.isMe ? '나' : completion.displayName}</Text>
          {completion.rating ? <Text accessibilityLabel={`${completion.rating}점`} style={styles.completionRatingText}>{'★'.repeat(completion.rating)}</Text> : null}
          {completion.review ? <Text style={styles.completionReviewText}>{completion.review}</Text> : null}
        </View>
      ))}
    </View>
  )
}

type CompletionEditorProps = {
  error: string | null
  isSaving: boolean
  onCancel(): void
  onReviewChange(value: string): void
  onSave(): void
  onSelectRating(rating: number): void
  rating: number | null
  review: string
}

/** 별점과 천 자 이내 총평을 입력해 개인 완독 기록으로 저장하는 편집기를 표시한다. */
function CompletionEditor({
  error,
  isSaving,
  onCancel,
  onReviewChange,
  onSave,
  onSelectRating,
  rating,
  review,
}: CompletionEditorProps): React.JSX.Element {
  return (
    <View style={styles.completionEditor}>
      <Text style={styles.completionEditorLabel}>별점</Text>
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
        placeholder="이 책을 다 읽고 남은 생각을 적어 주세요."
        placeholderTextColor="#8C8C8C"
        style={styles.completionReviewInput}
        value={review}
      />
      <Text accessibilityLabel={`총평 ${review.length}자`} style={styles.completionLengthText}>{review.length}/1000</Text>
      {error ? <Text accessibilityRole="alert" style={styles.saveError}>{error}</Text> : null}
      <View style={styles.completionActions}>
        <Pressable accessibilityLabel="취소" accessibilityRole="button" disabled={isSaving} onPress={onCancel} style={styles.completionSecondaryAction}>
          <Text style={styles.completionSecondaryActionText}>취소</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="완독 기록 저장"
          accessibilityRole="button"
          disabled={isSaving}
          onPress={onSave}
          style={[styles.completionPrimaryAction, isSaving && styles.submitActionDisabled]}
        >
          {isSaving ? <ActivityIndicator color="#000000" /> : <Text style={styles.completionPrimaryActionText}>완독 기록 저장</Text>}
        </Pressable>
      </View>
    </View>
  )
}

/** 완독 변경 뒤 책 대화와 개인 프로필·책방 읽기 목록 캐시를 모두 최신화한다. */
async function invalidateCompletionCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  bookChatId: string,
  profileId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: bookCompletionKeys.byChat(bookChatId) }),
    queryClient.invalidateQueries({ queryKey: bookCompletionKeys.myBooks(profileId) }),
    queryClient.invalidateQueries({ queryKey: bookCompletionKeys.myBookChatIds(profileId) }),
    queryClient.invalidateQueries({ queryKey: bookChatKeys.myReading(profileId, []) }),
    queryClient.invalidateQueries({ queryKey: readingRoomKeys.all }),
  ])
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  archivedDescription: { color: '#BDBDBD', fontSize: 14, lineHeight: 20, marginTop: 4 },
  archivedNotice: { backgroundColor: '#171717', borderColor: '#393939', borderTopWidth: 1, paddingBottom: 16, paddingHorizontal: 16, paddingTop: 12 },
  archivedNoticeText: { color: '#FFB5A3', fontSize: 15, fontWeight: '700', lineHeight: 22 },
  backButtonText: { color: '#FFFFFF', fontSize: 32, lineHeight: 36 },
  bodyInput: { backgroundColor: '#101010', borderColor: '#393939', borderRadius: 12, borderWidth: 1, color: '#FFFFFF', fontSize: 16, lineHeight: 24, maxHeight: 120, minHeight: 76, padding: 12, textAlignVertical: 'top' },
  composer: { backgroundColor: '#000000', borderColor: '#393939', borderTopWidth: 1, gap: 8, paddingBottom: 12, paddingHorizontal: 16, paddingTop: 12 },
  composerActions: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  completionActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 16 },
  completionBackdrop: { backgroundColor: 'rgba(0, 0, 0, 0.72)', bottom: 0, justifyContent: 'flex-end', left: 0, position: 'absolute', right: 0, top: 0 },
  completionCloseAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  completionCloseActionText: { color: '#FFB5A3', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  completionEditor: { gap: 12, marginTop: 16 },
  completionEditorLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', lineHeight: 22 },
  completionEmptyText: { color: '#C7C7C7', fontSize: 15, lineHeight: 22, marginTop: 16 },
  completionHeaderAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, paddingHorizontal: 4 },
  completionHeaderActionText: { color: '#FFB5A3', fontSize: 13, fontWeight: '700', lineHeight: 20 },
  completionLengthText: { alignSelf: 'flex-end', color: '#8C8C8C', fontSize: 12, lineHeight: 18, marginTop: -8 },
  completionLoadingState: { alignItems: 'center', gap: 12, minHeight: 180, justifyContent: 'center' },
  completionMember: { borderColor: '#393939', borderRadius: 12, borderWidth: 1, padding: 12 },
  completionMemberName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', lineHeight: 22 },
  completionPrimaryAction: { alignItems: 'center', backgroundColor: '#FF835F', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  completionPrimaryActionText: { color: '#000000', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  completionRatingText: { color: '#FF835F', fontSize: 15, letterSpacing: 1, lineHeight: 22, marginTop: 4 },
  completionReviewInput: { backgroundColor: '#101010', borderColor: '#393939', borderRadius: 12, borderWidth: 1, color: '#FFFFFF', fontSize: 16, lineHeight: 24, minHeight: 108, padding: 12, textAlignVertical: 'top' },
  completionReviewText: { color: '#C7C7C7', fontSize: 14, lineHeight: 20, marginTop: 4 },
  completionRoster: { gap: 8, marginTop: 16 },
  completionSecondaryAction: { alignItems: 'center', borderColor: '#FF835F', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  completionSecondaryActionText: { color: '#FF835F', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  completionSheet: { backgroundColor: '#101010', borderColor: '#393939', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, maxHeight: '82%', paddingBottom: 24, paddingHorizontal: 16, paddingTop: 12 },
  completionSheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  completionSheetTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 26 },
  container: { backgroundColor: '#000000', flex: 1 },
  emptyTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 24, textAlign: 'center' },
  errorText: { color: '#FF8A8A', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  fullState: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', paddingHorizontal: 16 },
  header: { alignItems: 'center', borderColor: '#202020', borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8 },
  headerCopy: { alignItems: 'center', flex: 1 },
  headerSpacer: { minWidth: 44 },
  keyboardAvoidingView: { flex: 1 },
  label: { backgroundColor: '#2D1712', borderRadius: 8, color: '#FFB5A3', fontSize: 13, lineHeight: 18, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  labelInput: { backgroundColor: '#101010', borderColor: '#393939', borderRadius: 8, borderWidth: 1, color: '#FFFFFF', fontSize: 16, lineHeight: 24, minHeight: 44, paddingHorizontal: 12 },
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
})
