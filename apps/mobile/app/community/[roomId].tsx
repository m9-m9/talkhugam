import { useLocalSearchParams, useRouter } from 'expo-router'
import { z } from 'zod'
import { MobileCommunityRoomDetailScreen } from '../../src/features/community/MobileCommunityEntryScreens'

/** URL UUID를 검증한 활성 멤버 전용 오픈 책방 자유 채팅 경로를 표시한다. */
export default function CommunityDetailRoute(): React.JSX.Element { const router = useRouter(); const params = useLocalSearchParams<{ roomId?: string }>(); const parsed = z.string().uuid().safeParse(params.roomId); return <MobileCommunityRoomDetailScreen roomId={parsed.success ? parsed.data : null} onBack={() => router.replace('/community')} /> }
