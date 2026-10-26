import { useQuery } from '@tanstack/react-query'
import { videoKeys } from '@talkhugam/domain'
import { useVideoPlayer, VideoView } from 'expo-video'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getMobileVideoAsset, getMobileVideoPlaybackAuthorization } from '../../entities/video'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'

type MobileVideoPlayerScreenProps = { onBack(): void; postId: string }

/** RLS 영상 상태를 확인한 뒤 서명된 Mux HLS 재생을 제공한다. */
export function MobileVideoPlayerScreen({ onBack, postId }: MobileVideoPlayerScreenProps): React.JSX.Element {
  const assetQuery = useQuery({ queryFn: () => getMobileVideoAsset(createMobileSupabaseClient(), postId), queryKey: videoKeys.byPost(postId), refetchInterval: (query) => query.state.data?.status === 'waiting_upload' || query.state.data?.status === 'processing' ? 3_000 : false })
  const playbackQuery = useQuery({ enabled: assetQuery.data?.status === 'ready', queryFn: () => getMobileVideoPlaybackAuthorization(createMobileSupabaseClient(), postId), queryKey: videoKeys.playback(postId), staleTime: 4 * 60 * 1_000 })

  if (assetQuery.isPending || (assetQuery.data?.status === 'ready' && playbackQuery.isPending)) return <VideoState label="영상을 준비하고 있어요." onBack={onBack} />
  if (assetQuery.isError || playbackQuery.isError) return <VideoState label="영상을 재생하지 못했어요. 다시 시도해 주세요." onBack={onBack} onRetry={() => { void assetQuery.refetch(); void playbackQuery.refetch() }} />
  if (!assetQuery.data || assetQuery.data.status === 'deleted') return <VideoState label="이 영상을 찾을 수 없어요." onBack={onBack} />
  if (assetQuery.data.status !== 'ready' || !playbackQuery.data) return <VideoState label={assetQuery.data.status === 'failed' ? '영상 처리에 실패했어요.' : '영상이 아직 준비 중이에요.'} onBack={onBack} />
  return <SignedHlsPlayer onBack={onBack} source={`https://stream.mux.com/${encodeURIComponent(playbackQuery.data.playbackId)}.m3u8?token=${encodeURIComponent(playbackQuery.data.token)}`} />
}

/** 서명 토큰을 포함한 HLS source를 expo-video로 재생하고 미디어 오류를 화면 상태로 분리한다. */
function SignedHlsPlayer({ onBack, source }: { onBack(): void; source: string }): React.JSX.Element {
  const player = useVideoPlayer(source, (videoPlayer) => { videoPlayer.play() })
  return <SafeAreaView style={styles.container}><Pressable accessibilityLabel="영상 기록으로 돌아가기" accessibilityRole="button" onPress={onBack} style={styles.back}><Text style={styles.backText}>‹ 영상 기록</Text></Pressable><VideoView fullscreenOptions={{ enable: true }} nativeControls player={player} style={styles.player} /></SafeAreaView>
}

/** 로딩·처리 대기·오류 상태에서 안전한 복귀와 선택적 재시도를 제공한다. */
function VideoState({ label, onBack, onRetry }: { label: string; onBack(): void; onRetry?(): void }): React.JSX.Element {
  return <SafeAreaView style={styles.container}><View style={styles.state}><ActivityIndicator color="#FF835F" /><Text accessibilityRole="alert" style={styles.label}>{label}</Text>{onRetry ? <Pressable accessibilityLabel="영상 재생 다시 시도" accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>다시 시도</Text></Pressable> : null}<Pressable accessibilityLabel="영상 기록으로 돌아가기" accessibilityRole="button" onPress={onBack} style={styles.back}><Text style={styles.backText}>영상 기록으로 돌아가기</Text></Pressable></View></SafeAreaView>
}

const styles = StyleSheet.create({ back: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 16, alignSelf: 'flex-start' }, backText: { color: '#FF835F', fontWeight: '700' }, container: { backgroundColor: '#000000', flex: 1 }, label: { color: '#FFFFFF', textAlign: 'center' }, player: { flex: 1, width: '100%' }, retry: { borderColor: '#FF835F', borderRadius: 12, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }, retryText: { color: '#FF835F', fontWeight: '700' }, state: { alignItems: 'center', flex: 1, gap: 16, justifyContent: 'center', padding: 16 } })
