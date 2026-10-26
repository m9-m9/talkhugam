import { useQuery } from '@tanstack/react-query'
import {
  formatRoomMemberSummary,
  formatRoomMessagePreview,
  readingRoomKeys,
  type ReadingRoom,
} from '@talkhugam/domain'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getMobileReadingRooms } from '../../entities/reading-room'
import { useMobileSessionProfileId } from '../../shared/api/MobileAppProviders'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'

type MobileReadingRoomsScreenProps = {
  onCreateRoom(): void
  onJoinRoom(): void
  onOpenCommunity?(): void
  onOpenProfile?(): void
  onOpenRoom(roomId: string): void
}

/** 인증된 회원의 비공개 책방 목록과 새 책방 진입 동작을 표시한다. */
export function MobileReadingRoomsScreen({
  onCreateRoom,
  onJoinRoom,
  onOpenCommunity,
  onOpenProfile,
  onOpenRoom,
}: MobileReadingRoomsScreenProps): React.JSX.Element {
  const profileId = useMobileSessionProfileId()
  const roomsQuery = useQuery({
    enabled: profileId !== null,
    queryFn: () => getMobileReadingRooms(createMobileSupabaseClient()),
    queryKey: readingRoomKeys.byProfile(profileId ?? ''),
  })

  /** 일시적인 목록 요청 실패를 같은 권한 범위에서 다시 조회한다. */
  function handleRetry(): void {
    void roomsQuery.refetch()
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          {onOpenProfile ? (
            <Pressable
              accessibilityLabel="내 정보 열기"
              accessibilityRole="button"
              onPress={onOpenProfile}
              style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}
            >
              <Text style={styles.profileButtonText}>내 정보</Text>
            </Pressable>
          ) : null}
          <Text style={styles.eyebrow}>내 책방</Text>
          <Text style={styles.title}>함께 읽는 이야기를{`\n`}이어 가요</Text>
          <Text style={styles.description}>초대받은 사람만 함께할 수 있는 비공개 책방이에요.</Text>
        </View>
        <RoomsContent
          error={roomsQuery.isError}
          isLoading={roomsQuery.isPending}
          onOpenRoom={onOpenRoom}
          onRetry={handleRetry}
          rooms={roomsQuery.data ?? []}
        />
        <View style={styles.actions}>
          <PrimaryAction label="새 책방 만들기" onPress={onCreateRoom} />
          <SecondaryAction label="초대 코드로 참여" onPress={onJoinRoom} />
          {onOpenCommunity ? <SecondaryAction label="오픈 책방 둘러보기" onPress={onOpenCommunity} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

type RoomsContentProps = {
  error: boolean
  isLoading: boolean
  onOpenRoom(roomId: string): void
  onRetry(): void
  rooms: readonly ReadingRoom[]
}

/** 목록 쿼리 상태에 맞춰 로딩·오류·빈 목록 또는 책방 카드를 표시한다. */
function RoomsContent({
  error,
  isLoading,
  onOpenRoom,
  onRetry,
  rooms,
}: RoomsContentProps): React.JSX.Element {
  if (isLoading) return <RoomsLoadingState />
  if (error) return <RoomsErrorState onRetry={onRetry} />
  if (rooms.length === 0) return <RoomsEmptyState />

  return (
    <View accessibilityLabel="함께 읽는 책방" style={styles.roomList}>
      {rooms.map((room) => (
        <RoomCard key={room.id} onOpenRoom={onOpenRoom} room={room} />
      ))}
    </View>
  )
}

/** 초기 책방 목록을 준비하는 동안 읽을 수 있는 진행 상태를 표시한다. */
function RoomsLoadingState(): React.JSX.Element {
  return (
    <View
      accessibilityLabel="책방을 준비하고 있어요."
      accessibilityRole="progressbar"
      style={styles.centeredState}
    >
      <ActivityIndicator color="#FF835F" />
      <Text style={styles.stateText}>책방을 준비하고 있어요.</Text>
    </View>
  )
}

/** 서버에서 책방을 불러오지 못했을 때 재시도 제어를 포함한 오류 상태를 표시한다. */
function RoomsErrorState({ onRetry }: { onRetry(): void }): React.JSX.Element {
  return (
    <View style={styles.centeredState}>
      <Text accessibilityRole="alert" style={styles.errorText}>
        책방을 불러오지 못했어요. 다시 시도해 주세요.
      </Text>
      <SecondaryAction label="다시 시도" onPress={onRetry} />
    </View>
  )
}

/** 아직 책방이 없는 회원에게 두 가지 진입 방법을 설명하는 빈 상태를 표시한다. */
function RoomsEmptyState(): React.JSX.Element {
  return (
    <View style={styles.centeredState}>
      <Text style={styles.emptyTitle}>아직 함께 읽는 책방이 없어요.</Text>
      <Text style={styles.stateText}>
        새 책방을 만들거나 친구가 보낸 초대 코드로 참여해 보세요.
      </Text>
    </View>
  )
}

/** 검증된 책방 요약을 최근 대화와 멤버 표시명이 포함된 카드로 표시한다. */
function RoomCard({
  onOpenRoom,
  room,
}: {
  onOpenRoom(roomId: string): void
  room: ReadingRoom
}): React.JSX.Element {
  /** 현재 회원이 속한 비공개 책방 상세 화면을 연다. */
  function handleOpenRoom(): void {
    onOpenRoom(room.id)
  }

  return (
    <Pressable
      accessibilityLabel={`${room.name} 열기`}
      accessibilityRole="button"
      onPress={handleOpenRoom}
      style={({ pressed }) => [styles.roomCard, pressed && styles.roomCardPressed]}
    >
      <Text style={styles.roomName}>{room.name}</Text>
      <Text style={styles.roomMembers}>{formatRoomMemberSummary(room.members)}</Text>
      <Text numberOfLines={2} style={styles.roomPreview}>
        {formatRoomMessagePreview(room)}
      </Text>
    </Pressable>
  )
}

type ActionProps = {
  label: string
  onPress(): void
}

/** 새 책방 생성처럼 핵심 흐름을 시작하는 높은 대비의 44px 버튼을 표시한다. */
function PrimaryAction({ label, onPress }: ActionProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.primaryAction, pressed && styles.primaryActionPressed]}
    >
      <Text style={styles.primaryActionText}>{label}</Text>
    </Pressable>
  )
}

/** 보조 경로에 사용하는 테두리형 44px 버튼을 표시한다. */
function SecondaryAction({ label, onPress }: ActionProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryAction, pressed && styles.secondaryActionPressed]}
    >
      <Text style={styles.secondaryActionText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  actions: { gap: 12, marginTop: 32 },
  centeredState: { alignItems: 'center', gap: 12, justifyContent: 'center', minHeight: 224 },
  container: { backgroundColor: '#000000', flex: 1, paddingHorizontal: 16 },
  description: { color: '#C7C7C7', fontSize: 15, lineHeight: 22, marginTop: 12 },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
  },
  errorText: { color: '#FF8A8A', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  eyebrow: { color: '#FF835F', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  header: { marginTop: 40 },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: '#FF835F',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryActionPressed: { backgroundColor: '#E46845' },
  primaryActionText: { color: '#000000', fontSize: 16, fontWeight: '700', lineHeight: 24 },
  profileButton: {
    alignSelf: 'flex-end',
    borderColor: '#393939',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  profileButtonPressed: { backgroundColor: '#1B1B1B', borderColor: '#FF835F' },
  profileButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  roomCard: {
    backgroundColor: '#101010',
    borderColor: '#393939',
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  roomCardPressed: { backgroundColor: '#1B1B1B', borderColor: '#FF835F' },
  roomList: { gap: 12, marginTop: 32 },
  roomMembers: { color: '#FFB5A3', fontSize: 14, lineHeight: 20 },
  roomName: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 26 },
  roomPreview: { color: '#C7C7C7', fontSize: 14, lineHeight: 20 },
  scrollContent: { flexGrow: 1, paddingBottom: 32 },
  secondaryAction: {
    alignItems: 'center',
    borderColor: '#FF835F',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryActionPressed: { backgroundColor: '#25130E' },
  secondaryActionText: { color: '#FF835F', fontSize: 16, fontWeight: '700', lineHeight: 24 },
  stateText: { color: '#C7C7C7', fontSize: 15, lineHeight: 22, maxWidth: 260, textAlign: 'center' },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', lineHeight: 38, marginTop: 8 },
})
