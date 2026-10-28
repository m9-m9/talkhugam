import { useQuery } from '@tanstack/react-query'
import { bookChatKeys, type BookChat, type ReadingRoomDetail } from '@talkhugam/domain'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getMobileBookChats, getMobileReadingRoomDetail } from '../../entities/reading-room'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'
import { mobileColors } from '../../shared/ui/mobileTheme'

type MobileRoomDetailScreenProps = {
  onAddBook?(): void
  onBack(): void
  onOpenBookChat(bookChatId: string): void
  roomId: string | null
}

/** 현재 회원에게 허용된 책방과 진행 중인 책 대화 목록을 상태별로 표시한다. */
export function MobileRoomDetailScreen({
  onAddBook,
  onBack,
  onOpenBookChat,
  roomId,
}: MobileRoomDetailScreenProps): React.JSX.Element {
  /** 허용된 책방을 RLS 범위에서 조회한다. */
  async function fetchRoom(): Promise<ReadingRoomDetail | null> {
    if (roomId === null) return null
    return getMobileReadingRoomDetail(createMobileSupabaseClient(), roomId)
  }

  const roomQuery = useQuery({
    enabled: roomId !== null,
    queryFn: fetchRoom,
    queryKey: bookChatKeys.room(roomId ?? 'invalid-room'),
  })

  /** 방 접근이 확인된 뒤 진행 중인 책 대화 목록을 조회한다. */
  async function fetchBookChats(): Promise<BookChat[]> {
    if (roomId === null) return []
    return getMobileBookChats(createMobileSupabaseClient(), roomId)
  }

  const bookChatsQuery = useQuery({
    enabled: roomId !== null && roomQuery.data !== null && roomQuery.data !== undefined,
    queryFn: fetchBookChats,
    queryKey: bookChatKeys.byRoom(roomId ?? 'invalid-room'),
  })

  /** 네트워크 오류 후 같은 회원 권한으로 책방 상세 조회를 다시 요청한다. */
  function handleRetryRoom(): void {
    void roomQuery.refetch()
  }

  /** 네트워크 오류 후 같은 회원 권한으로 책 대화 목록을 다시 요청한다. */
  function handleRetryBookChats(): void {
    void bookChatsQuery.refetch()
  }

  if (roomId === null) return <RoomUnavailableState onBack={onBack} />
  if (roomQuery.isPending) return <RoomLoadingState />
  if (roomQuery.isError) return <RoomErrorState onRetry={handleRetryRoom} />
  if (roomQuery.data === null) return <RoomUnavailableState onBack={onBack} />

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <BackButton onPress={onBack} />
          <Text style={styles.headerTitle}>책방</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.introduction}>
          <Text style={styles.roomName}>{roomQuery.data.name}</Text>
          {roomQuery.data.description ? (
            <Text style={styles.description}>{roomQuery.data.description}</Text>
          ) : null}
        </View>
        <View style={styles.booksSection}>
          <View style={styles.booksSectionHeader}>
            <Text style={styles.sectionTitle}>지금 함께 읽는 책</Text>
            {onAddBook ? <SecondaryAction label="새 책 대화 시작" onPress={onAddBook} /> : null}
          </View>
          <BookChatsContent
            bookChats={bookChatsQuery.data ?? []}
            isError={bookChatsQuery.isError}
            isLoading={bookChatsQuery.isPending}
            onOpenBookChat={onOpenBookChat}
            onRetry={handleRetryBookChats}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

type BookChatsContentProps = {
  bookChats: readonly BookChat[]
  isError: boolean
  isLoading: boolean
  onOpenBookChat(bookChatId: string): void
  onRetry(): void
}

/** 책 목록 요청 상태에 맞춰 로딩·오류·빈 목록 또는 책 대화 카드를 표시한다. */
function BookChatsContent({
  bookChats,
  isError,
  isLoading,
  onOpenBookChat,
  onRetry,
}: BookChatsContentProps): React.JSX.Element {
  if (isLoading) return <BookChatsLoadingState />
  if (isError) return <BookChatsErrorState onRetry={onRetry} />
  if (bookChats.length === 0) return <BookChatsEmptyState />

  return (
    <View accessibilityLabel="함께 읽는 책" style={styles.bookList}>
      {bookChats.map((bookChat) => (
        <BookChatCard bookChat={bookChat} key={bookChat.id} onOpenBookChat={onOpenBookChat} />
      ))}
    </View>
  )
}

/** 초기 책 대화 목록을 준비하는 동안 읽을 수 있는 진행 상태를 표시한다. */
function BookChatsLoadingState(): React.JSX.Element {
  return (
    <View accessibilityLabel="책을 불러오고 있어요." accessibilityRole="progressbar" style={styles.state}>
      <ActivityIndicator color={mobileColors.accent} />
      <Text style={styles.stateText}>책을 불러오고 있어요.</Text>
    </View>
  )
}

/** 책 대화 목록 요청 오류를 안내하고 재시도 동작을 제공한다. */
function BookChatsErrorState({ onRetry }: { onRetry(): void }): React.JSX.Element {
  return (
    <View style={styles.state}>
      <Text accessibilityRole="alert" style={styles.errorText}>
        책 목록을 불러오지 못했어요. 다시 시도해 주세요.
      </Text>
      <SecondaryAction label="다시 시도" onPress={onRetry} />
    </View>
  )
}

/** 진행 중인 책이 없는 책방에 다음 상태를 명확히 설명한다. */
function BookChatsEmptyState(): React.JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>아직 함께 읽는 책이 없어요.</Text>
      <Text style={styles.stateText}>책방 멤버가 첫 책을 추가하면 여기에서 대화를 시작할 수 있어요.</Text>
    </View>
  )
}

/** 책 표지 정보 없이도 제목과 작가로 책 대화 진입점을 제공한다. */
function BookChatCard({
  bookChat,
  onOpenBookChat,
}: {
  bookChat: BookChat
  onOpenBookChat(bookChatId: string): void
}): React.JSX.Element {
  /** 선택한 책 대화 화면으로 안전하게 이동한다. */
  function handleOpenBookChat(): void {
    onOpenBookChat(bookChat.id)
  }

  return (
    <Pressable
      accessibilityLabel={`${bookChat.title} 대화 열기`}
      accessibilityRole="button"
      onPress={handleOpenBookChat}
      style={({ pressed }) => [styles.bookCard, pressed && styles.bookCardPressed]}
    >
      <View style={styles.bookPlaceholder}>
        <Text accessibilityElementsHidden style={styles.bookPlaceholderText}>
          책
        </Text>
      </View>
      <View style={styles.bookCopy}>
        <Text numberOfLines={2} style={styles.bookTitle}>
          {bookChat.title}
        </Text>
        <Text numberOfLines={1} style={styles.bookAuthor}>
          {bookChat.authors.join(', ') || bookChat.name}
        </Text>
      </View>
    </Pressable>
  )
}

/** 권한 확인 중인 책방을 위한 전체 화면 로딩 상태를 표시한다. */
function RoomLoadingState(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View accessibilityLabel="책방을 불러오고 있어요." accessibilityRole="progressbar" style={styles.fullState}>
        <ActivityIndicator color={mobileColors.accent} />
        <Text style={styles.stateText}>책방을 불러오고 있어요.</Text>
      </View>
    </SafeAreaView>
  )
}

/** 일시적인 책방 상세 요청 오류를 재시도 가능한 상태로 표시한다. */
function RoomErrorState({ onRetry }: { onRetry(): void }): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.fullState}>
        <Text accessibilityRole="alert" style={styles.errorText}>
          책방을 불러오지 못했어요. 다시 시도해 주세요.
        </Text>
        <SecondaryAction label="다시 시도" onPress={onRetry} />
      </View>
    </SafeAreaView>
  )
}

/** RLS에서 숨겨진 책방 또는 잘못된 경로를 안전한 목록 복귀 상태로 표시한다. */
function RoomUnavailableState({ onBack }: { onBack(): void }): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.fullState}>
        <Text style={styles.unavailableTitle}>이 책방을 찾을 수 없어요</Text>
        <Text style={styles.stateText}>참여 중인 책방인지 확인해 주세요.</Text>
        <PrimaryAction label="내 책방으로" onPress={onBack} />
      </View>
    </SafeAreaView>
  )
}

/** 상세 흐름에서 목록으로 돌아갈 수 있는 최소 44px 뒤로 가기 버튼을 표시한다. */
function BackButton({ onPress }: { onPress(): void }): React.JSX.Element {
  return (
    <Pressable accessibilityLabel="내 책방으로 돌아가기" accessibilityRole="button" onPress={onPress} style={styles.backButton}>
      <Text style={styles.backButtonText}>‹</Text>
    </Pressable>
  )
}

type ActionProps = { label: string; onPress(): void }

/** 중요 복귀 행동을 위한 높은 대비의 44px 버튼을 표시한다. */
function PrimaryAction({ label, onPress }: ActionProps): React.JSX.Element {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={styles.primaryAction}><Text style={styles.primaryActionText}>{label}</Text></Pressable>
}

/** 재시도처럼 보조 행동에 사용하는 테두리형 44px 버튼을 표시한다. */
function SecondaryAction({ label, onPress }: ActionProps): React.JSX.Element {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>{label}</Text></Pressable>
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  backButtonText: { color: mobileColors.ink, fontSize: 32, lineHeight: 36 },
  bookAuthor: { color: mobileColors.inkSubtle, fontSize: 14, lineHeight: 20, marginTop: 4 },
  bookCard: { alignItems: 'center', backgroundColor: mobileColors.surfaceRaised, borderColor: mobileColors.borderStrong, borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 92, padding: 12 },
  bookCardPressed: { backgroundColor: mobileColors.surfacePressed, borderColor: mobileColors.inkSubtle },
  bookCopy: { flex: 1, marginLeft: 12 },
  bookList: { gap: 12, marginTop: 16 },
  bookPlaceholder: { alignItems: 'center', backgroundColor: mobileColors.surfaceRaised, borderRadius: 8, height: 64, justifyContent: 'center', width: 48 },
  bookPlaceholderText: { color: mobileColors.inkSubtle, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  bookTitle: { color: mobileColors.ink, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  booksSection: { marginTop: 40 },
  booksSectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  container: { backgroundColor: mobileColors.surface, flex: 1, paddingHorizontal: 16 },
  description: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22, marginTop: 12 },
  emptyState: { alignItems: 'center', backgroundColor: mobileColors.surfaceRaised, borderColor: mobileColors.borderStrong, borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 16, padding: 24 },
  emptyTitle: { color: mobileColors.ink, fontSize: 17, fontWeight: '700', lineHeight: 24, textAlign: 'center' },
  errorText: { color: mobileColors.danger, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  fullState: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  headerRow: { alignItems: 'center', flexDirection: 'row', marginTop: 8 },
  headerSpacer: { minWidth: 44 },
  headerTitle: { color: mobileColors.ink, flex: 1, fontSize: 16, fontWeight: '700', lineHeight: 24, textAlign: 'center' },
  introduction: { marginTop: 32 },
  primaryAction: { alignItems: 'center', backgroundColor: mobileColors.primaryAction, borderRadius: 12, justifyContent: 'center', minHeight: 48, minWidth: 160, paddingHorizontal: 16 },
  primaryActionText: { color: mobileColors.primaryActionText, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  roomName: { color: mobileColors.ink, fontSize: 28, fontWeight: '700', lineHeight: 38, marginTop: 8 },
  scrollContent: { flexGrow: 1, paddingBottom: 32 },
  secondaryAction: { alignItems: 'center', borderColor: mobileColors.borderStrong, borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 44, minWidth: 120, paddingHorizontal: 12 },
  secondaryActionText: { color: mobileColors.ink, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  sectionTitle: { color: mobileColors.ink, fontSize: 18, fontWeight: '700', lineHeight: 26 },
  state: { alignItems: 'center', gap: 12, minHeight: 180, justifyContent: 'center' },
  stateText: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22, maxWidth: 280, textAlign: 'center' },
  unavailableTitle: { color: mobileColors.ink, fontSize: 20, fontWeight: '700', lineHeight: 28, textAlign: 'center' },
})
