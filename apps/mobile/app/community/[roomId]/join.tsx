import { useLocalSearchParams, useRouter } from 'expo-router'
import { z } from 'zod'
import { MobileJoinCommunityRoomScreen } from '../../../src/features/community/MobileCommunityEntryScreens'

/** URL의 UUID와 비밀번호 요구 여부를 검증해 안전한 오픈 책방 참여 화면을 표시한다. */
export default function JoinCommunityRoute(): React.JSX.Element { const router = useRouter(); const params = useLocalSearchParams<{ roomId?: string; requiresPassword?: string }>(); const roomId = z.string().uuid().safeParse(params.roomId).data; if (!roomId) return <></>; return <MobileJoinCommunityRoomScreen requiresPassword={params.requiresPassword === 'true'} roomId={roomId} onFinished={() => router.replace(`/community/${roomId}`)} /> }
