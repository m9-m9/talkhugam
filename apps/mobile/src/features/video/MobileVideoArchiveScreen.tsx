import { useQuery } from '@tanstack/react-query'
import { filterVideoPosts, videoKeys, type VideoPost, type VideoPostFilter } from '@talkhugam/domain'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getMobileVideoFilterMembers, getMobileVideoPosts } from '../../entities/video'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'
import { MobileVideoUploadSheet } from './MobileVideoUploadSheet'
import { mobileColors } from '../../shared/ui/mobileTheme'

type MobileVideoArchiveScreenProps = {
  bookChatId: string
  onBack(): void
  onOpenVideo(videoId: string): void
  roomId: string
}

/** 현재 책 대화에서 허용된 영상 기록을 상태·멤버 필터와 함께 목록으로 표시한다. */
export function MobileVideoArchiveScreen({
  bookChatId,
  onBack,
  onOpenVideo,
  roomId,
}: MobileVideoArchiveScreenProps): React.JSX.Element {
  const [filter, setFilter] = useState<VideoPostFilter>({ kind: 'all' })
  const [isUploadSheetOpen, setIsUploadSheetOpen] = useState(false)

  /** 경로의 책방과 책 대화에 함께 속한 영상만 RLS 범위에서 읽는다. */
  async function fetchVideos() {
    return getMobileVideoPosts(createMobileSupabaseClient(), roomId, bookChatId)
  }

  const videosQuery = useQuery({
    queryFn: fetchVideos,
    queryKey: videoKeys.byBookChat(bookChatId),
    refetchInterval: (query) =>
      query.state.data?.some((video) => video.status === 'waiting_upload' || video.status === 'processing')
        ? 3_000
        : false,
  })

  /** 영상 필터가 사용할 현재 활성 책방 멤버를 읽는다. */
  async function fetchMembers() {
    return getMobileVideoFilterMembers(createMobileSupabaseClient(), roomId)
  }

  const membersQuery = useQuery({
    queryFn: fetchMembers,
    queryKey: videoKeys.members(roomId),
  })
  const currentMemberId = membersQuery.data?.find((member) => member.isCurrentUser)?.id ?? null
  const resolvedFilter = filter.kind === 'mine' ? { kind: 'mine' as const, memberId: currentMemberId } : filter
  const videos = filterVideoPosts(videosQuery.data ?? [], resolvedFilter)

  /** 일시적으로 실패한 영상 목록 요청을 동일 범위에서 다시 실행한다. */
  function handleRetryVideos(): void {
    void videosQuery.refetch()
  }

  /** 선택한 영상 식별자를 상위 라우터에 전달해 재생 화면 진입을 요청한다. */
  function handleOpenVideo(videoId: string): void {
    onOpenVideo(videoId)
  }

  /** 영상 촬영·선택 시트를 열어 직접 업로드 시작을 허용한다. */
  function handleOpenUploadSheet(): void { setIsUploadSheetOpen(true) }

  /** 업로드 완료 또는 취소 뒤 시트를 닫는다. */
  function handleCloseUploadSheet(): void { setIsUploadSheetOpen(false) }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="책 대화로 돌아가기" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ 책 대화</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.heading}>영상 기록</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>함께 남긴 독서 순간</Text>
        <Text style={styles.description}>이 책을 읽으며 남긴 영상이에요.</Text>
        <Pressable accessibilityLabel="영상 추가" accessibilityRole="button" onPress={handleOpenUploadSheet} style={styles.uploadButton}><Text style={styles.uploadButtonText}>영상 추가</Text></Pressable>
        <VideoFilterBar
          currentMemberId={currentMemberId}
          filter={filter}
          isDisabled={membersQuery.isPending || membersQuery.isError}
          onChange={setFilter}
        />
        {membersQuery.isError ? <Text accessibilityRole="alert" style={styles.memberError}>멤버 필터를 불러오지 못해 전체 영상을 보여드려요.</Text> : null}
        <VideoArchiveContent
          isError={videosQuery.isError}
          isLoading={videosQuery.isPending}
          onOpenVideo={handleOpenVideo}
          onRetry={handleRetryVideos}
          videos={videos}
        />
      </ScrollView>
      {isUploadSheetOpen ? <MobileVideoUploadSheet bookChatId={bookChatId} onClose={handleCloseUploadSheet} roomId={roomId} /> : null}
    </SafeAreaView>
  )
}

/** 전체 또는 현재 회원의 영상만 선택할 수 있는 최소 필터 제어를 표시한다. */
function VideoFilterBar({
  currentMemberId,
  filter,
  isDisabled,
  onChange,
}: {
  currentMemberId: string | null
  filter: VideoPostFilter
  isDisabled: boolean
  onChange(filter: VideoPostFilter): void
}): React.JSX.Element {
  /** 전체 영상 필터로 전환한다. */
  function handleShowAll(): void {
    onChange({ kind: 'all' })
  }

  /** 현재 멤버의 영상만 필터링하도록 전환한다. */
  function handleShowMine(): void {
    onChange({ kind: 'mine', memberId: currentMemberId })
  }

  return (
    <View accessibilityLabel="영상 필터" style={styles.filterBar}>
      <FilterButton isActive={filter.kind === 'all'} label="전체 영상" onPress={handleShowAll} />
      <FilterButton disabled={isDisabled} isActive={filter.kind === 'mine'} label="내 영상" onPress={handleShowMine} />
    </View>
  )
}

/** 필터 하나의 선택 상태와 최소 44px 터치 영역을 렌더링한다. */
function FilterButton({
  disabled = false,
  isActive,
  label,
  onPress,
}: {
  disabled?: boolean
  isActive: boolean
  label: string
  onPress(): void
}): React.JSX.Element {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ selected: isActive }} disabled={disabled} onPress={onPress} style={[styles.filterButton, isActive && styles.filterButtonActive, disabled && styles.filterButtonDisabled]}><Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>{label}</Text></Pressable>
}

/** 영상 목록 요청 결과에 따라 진행·오류·빈 목록 또는 영상 카드를 표시한다. */
function VideoArchiveContent({
  isError,
  isLoading,
  onOpenVideo,
  onRetry,
  videos,
}: {
  isError: boolean
  isLoading: boolean
  onOpenVideo(videoId: string): void
  onRetry(): void
  videos: readonly VideoPost[]
}): React.JSX.Element {
  if (isLoading) return <View accessibilityLabel="영상 기록을 불러오고 있어요." accessibilityRole="progressbar" style={styles.state}><ActivityIndicator color={mobileColors.accent} /><Text style={styles.stateText}>영상 기록을 불러오고 있어요.</Text></View>
  if (isError) return <View style={styles.state}><Text accessibilityRole="alert" style={styles.errorText}>영상 기록을 불러오지 못했어요. 다시 시도해 주세요.</Text><Pressable accessibilityLabel="영상 기록 다시 시도" accessibilityRole="button" onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>다시 시도</Text></Pressable></View>
  if (videos.length === 0) return <View style={styles.state}><Text style={styles.emptyTitle}>아직 남긴 영상이 없어요.</Text><Text style={styles.stateText}>위의 영상 추가로 첫 독서 순간을 남겨 보세요.</Text></View>

  return <View accessibilityLabel="영상 기록 목록" style={styles.videoList}>{videos.map((video) => <VideoCard key={video.id} onOpenVideo={onOpenVideo} video={video} />)}</View>
}

/** 영상 작성자와 처리 상태를 표시하고 선택 시 상위 재생 경로로 이동시킨다. */
function VideoCard({ onOpenVideo, video }: { onOpenVideo(videoId: string): void; video: VideoPost }): React.JSX.Element {
  /** 해당 영상의 검증된 post 식별자를 재생 경로에 전달한다. */
  function handleOpen(): void {
    onOpenVideo(video.id)
  }

  return <Pressable accessibilityLabel={`${video.authorName}의 영상 열기`} accessibilityRole="button" onPress={handleOpen} style={({ pressed }) => [styles.videoCard, pressed && styles.videoCardPressed]}><View style={styles.videoPlaceholder}><Text style={styles.videoPlaceholderText}>▶</Text></View><View style={styles.videoCopy}><Text style={styles.videoAuthor}>{video.authorName}의 영상</Text><Text style={styles.videoStatus}>{getVideoStatusLabel(video.status)}</Text></View></Pressable>
}

/** Mux 처리 상태를 영상 보관함에 표시할 짧은 한국어 문구로 변환한다. */
function getVideoStatusLabel(status: VideoPost['status']): string {
  if (status === 'ready') return '재생 가능'
  if (status === 'waiting_upload') return '업로드 대기 중'
  if (status === 'processing') return '영상을 준비하고 있어요'
  if (status === 'failed') return '영상 처리에 실패했어요'
  return '삭제된 영상'
}

const styles = StyleSheet.create({
  backButton: { justifyContent: 'center', minHeight: 44, minWidth: 88 },
  backButtonText: { color: mobileColors.ink, fontSize: 15, fontWeight: '700' },
  container: { backgroundColor: mobileColors.surface, flex: 1, paddingHorizontal: 16 },
  content: { paddingBottom: 32 },
  description: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22, marginTop: 8 },
  emptyTitle: { color: mobileColors.ink, fontSize: 17, fontWeight: '700', lineHeight: 24 },
  errorText: { color: mobileColors.danger, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  filterBar: { flexDirection: 'row', gap: 8, marginTop: 24 },
  filterButton: { alignItems: 'center', borderColor: mobileColors.borderStrong, borderRadius: 22, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 },
  filterButtonActive: { backgroundColor: mobileColors.accentSoft, borderColor: mobileColors.accent },
  filterButtonDisabled: { opacity: 0.5 },
  filterButtonText: { color: mobileColors.ink, fontSize: 14, fontWeight: '700' },
  filterButtonTextActive: { color: mobileColors.accentText },
  header: { alignItems: 'center', flexDirection: 'row', minHeight: 56 },
  headerSpacer: { minWidth: 88 },
  heading: { color: mobileColors.ink, flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  memberError: { color: mobileColors.danger, fontSize: 13, lineHeight: 19, marginTop: 12 },
  retryButton: { alignItems: 'center', borderColor: mobileColors.borderStrong, borderRadius: 12, borderWidth: 1, justifyContent: 'center', marginTop: 16, minHeight: 44, paddingHorizontal: 16 },
  retryText: { color: mobileColors.ink, fontSize: 15, fontWeight: '700' },
  state: { alignItems: 'center', gap: 12, justifyContent: 'center', minHeight: 220, paddingHorizontal: 16 },
  stateText: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  title: { color: mobileColors.ink, fontSize: 24, fontWeight: '700', lineHeight: 32, marginTop: 24 },
  videoAuthor: { color: mobileColors.ink, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  videoCard: { alignItems: 'center', backgroundColor: mobileColors.surfaceRaised, borderColor: mobileColors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 88, padding: 12 },
  videoCardPressed: { backgroundColor: mobileColors.surfacePressed },
  videoCopy: { flex: 1, marginLeft: 12 },
  videoList: { gap: 12, marginTop: 20 },
  videoPlaceholder: { alignItems: 'center', backgroundColor: mobileColors.surfaceRaised, borderRadius: 8, height: 56, justifyContent: 'center', width: 80 },
  videoPlaceholderText: { color: mobileColors.ink, fontSize: 22 },
  videoStatus: { color: mobileColors.inkSubtle, fontSize: 13, lineHeight: 19, marginTop: 4 },
  uploadButton: { alignItems: 'center', alignSelf: 'flex-start', borderColor: mobileColors.borderStrong, borderRadius: 12, borderWidth: 1, justifyContent: 'center', marginTop: 16, minHeight: 44, paddingHorizontal: 16 },
  uploadButtonText: { color: mobileColors.ink, fontWeight: '700' },
})
