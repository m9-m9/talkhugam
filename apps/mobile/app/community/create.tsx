import { useRouter } from 'expo-router'
import { MobileCreateCommunityRoomScreen } from '../../src/features/community/MobileCommunityEntryScreens'

/** 새 오픈 책방 생성 완료 후 즉시 자유 채팅 상세로 이동하는 경로를 표시한다. */
export default function CreateCommunityRoute(): React.JSX.Element { const router = useRouter(); return <MobileCreateCommunityRoomScreen onFinished={(roomId) => router.replace(`/community/${roomId}`)} /> }
