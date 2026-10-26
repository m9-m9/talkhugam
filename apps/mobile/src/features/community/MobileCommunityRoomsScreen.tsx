import { communityKeys, type CommunityRoom } from '@talkhugam/domain'
import { useQuery } from '@tanstack/react-query'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getMobileCommunityRooms } from '../../entities/community/mobileCommunity'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'
import { MobileBackButton } from '../../shared/ui/MobileBackButton'
import { mobileColors } from '../../shared/ui/theme'

type Props = { loadRooms?(): ReturnType<typeof getMobileCommunityRooms>; onBack?: () => void; onCreateRoom(): void; onJoinRoom(roomId: string, requiresPassword: boolean): void }

/** 모든 로그인 회원이 참여할 수 있는 오픈 책방 발견 목록을 렌더링한다. */
export function MobileCommunityRoomsScreen({ loadRooms, onBack, onCreateRoom, onJoinRoom }: Props): React.JSX.Element {
  const roomsQuery = useQuery({ queryFn: loadRooms ?? (() => getMobileCommunityRooms(createMobileSupabaseClient())), queryKey: communityKeys.discovery() })
  /** 선택한 오픈 책방의 입장 방식에 맞는 참여 화면을 연다. */
  function handleJoin(room: CommunityRoom): void { onJoinRoom(room.id, room.access === 'password') }
  return <SafeAreaView style={styles.container}>{onBack ? <MobileBackButton onPress={onBack} /> : null}<ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>같이 읽을 사람을{`\n`}찾아요</Text><Text style={styles.description}>팔로우한 사람이 만든 책방을 먼저 보여드려요.</Text>
    <Pressable accessibilityLabel="새 오픈 책방 만들기" accessibilityRole="button" onPress={onCreateRoom} style={styles.primary}><Text style={styles.primaryText}>새 오픈 책방 만들기</Text></Pressable>
    {roomsQuery.isPending ? <View style={styles.state}><ActivityIndicator color={mobileColors.accent} /><Text style={styles.description}>오픈 책방을 불러오고 있어요.</Text></View> : null}
    {roomsQuery.isError ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.error}>오픈 책방을 불러오지 못했어요.</Text><Pressable accessibilityRole="button" onPress={() => void roomsQuery.refetch()} style={styles.secondary}><Text style={styles.secondaryText}>다시 시도</Text></Pressable></View> : null}
    {roomsQuery.data?.length === 0 ? <Text style={styles.empty}>아직 열린 책방이 없어요. 첫 책방을 열어 보세요.</Text> : null}
    <View style={styles.list}>{roomsQuery.data?.map((room) => <Pressable accessibilityLabel={`${room.name} 참여하기`} accessibilityRole="button" key={room.id} onPress={() => handleJoin(room)} style={styles.card}>
      {room.isFollowingCreator ? <Text style={styles.following}>팔로우한 사람이 열었어요</Text> : null}<Text style={styles.roomName}>{room.name}</Text>{room.description ? <Text style={styles.description}>{room.description}</Text> : null}<Text style={styles.meta}>{room.access === 'password' ? '비밀번호 필요' : '바로 참여'} · {room.activeMemberCount} / {room.capacity}명</Text>
    </Pressable>)}</View>
  </ScrollView></SafeAreaView>
}

const styles = StyleSheet.create({ card: { backgroundColor: mobileColors.surfaceRaised, borderColor: mobileColors.borderStrong, borderRadius: 12, borderWidth: 1, gap: 8, padding: 16 }, container: { backgroundColor: mobileColors.surface, flex: 1, paddingHorizontal: 16 }, content: { gap: 16, paddingVertical: 24 }, description: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22 }, empty: { color: mobileColors.inkSubtle, marginTop: 32, textAlign: 'center' }, error: { color: mobileColors.danger }, following: { color: mobileColors.ink, fontSize: 13, fontWeight: '700' }, list: { gap: 12, marginTop: 8 }, meta: { color: mobileColors.inkSubtle, fontSize: 13 }, primary: { alignItems: 'center', backgroundColor: mobileColors.primaryAction, borderRadius: 12, justifyContent: 'center', minHeight: 52, marginTop: 16 }, primaryText: { color: mobileColors.primaryActionText, fontSize: 16, fontWeight: '700' }, roomName: { color: mobileColors.ink, fontSize: 17, fontWeight: '700' }, secondary: { alignItems: 'center', borderColor: mobileColors.borderStrong, borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 }, secondaryText: { color: mobileColors.ink, fontWeight: '700' }, state: { alignItems: 'center', gap: 12, marginTop: 32 }, title: { color: mobileColors.ink, fontSize: 28, fontWeight: '700', lineHeight: 38 } })
