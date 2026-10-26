import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { publicProfileKeys } from '@talkhugam/domain'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  followMobilePublicProfile,
  getMobilePublicProfile,
  getMobilePublicProfileFollowers,
  unfollowMobilePublicProfile,
} from '../../entities/profile'
import { reportMobileCommunityTarget } from '../../entities/community'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'
import { mobileColors } from '../../shared/ui/theme'

type MobilePublicProfileScreenProps = { onBack(): void; profileId: string }

/** 다른 회원의 공개 허용 정보, 팔로워, 단방향 팔로우 행동을 표시한다. */
export function MobilePublicProfileScreen({ onBack, profileId }: MobilePublicProfileScreenProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const profileQuery = useQuery({
    queryFn: () => getMobilePublicProfile(createMobileSupabaseClient(), profileId),
    queryKey: publicProfileKeys.detail(profileId),
  })
  const followersQuery = useQuery({
    queryFn: () => getMobilePublicProfileFollowers(createMobileSupabaseClient(), profileId),
    queryKey: publicProfileKeys.followers(profileId),
  })
  const followMutation = useMutation({
    mutationFn: (isFollowing: boolean) => isFollowing
      ? unfollowMobilePublicProfile(createMobileSupabaseClient(), profileId)
      : followMobilePublicProfile(createMobileSupabaseClient(), profileId),
    onSuccess: (_result, wasFollowing) => {
      queryClient.setQueryData(publicProfileKeys.detail(profileId), (current: typeof profileQuery.data) => current
        ? { ...current, followerCount: Math.max(0, current.followerCount + (wasFollowing ? -1 : 1)), isFollowing: !wasFollowing }
        : current)
      void queryClient.invalidateQueries({ queryKey: publicProfileKeys.followers(profileId) })
    },
  })
  const reportMutation = useMutation({
    mutationFn: () => reportMobileCommunityTarget(createMobileSupabaseClient(), 'profile', profileId, '운영자 확인이 필요해요'),
  })

  /** 현재 팔로우 상태를 반전해 서버 RPC에 저장한다. */
  function handleToggleFollow(): void {
    if (!profileQuery.data || followMutation.isPending) return
    followMutation.mutate(profileQuery.data.isFollowing)
  }

  /** 현재 공개 프로필만 운영자 검토 대상으로 신고한다. */
  function handleReportProfile(): void {
    if (reportMutation.isPending) return
    reportMutation.mutate()
  }

  if (profileQuery.isPending) return <PublicProfileStatus label="프로필을 불러오고 있어요." />
  if (profileQuery.isError || !profileQuery.data) return <PublicProfileError onBack={onBack} onRetry={() => void profileQuery.refetch()} />

  const profile = profileQuery.data
  const actionLabel = `${profile.displayName} ${profile.isFollowing ? '언팔로우' : '팔로우'}`
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityLabel="이전 화면으로 돌아가기" accessibilityRole="button" onPress={onBack} style={styles.back}><Text style={styles.backText}>‹ 이전</Text></Pressable>
        <View style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{profile.displayName.slice(0, 1)}</Text></View>
          <Text accessibilityRole="header" style={styles.name}>{profile.displayName}</Text>
          <Text style={styles.bio}>{profile.bio || '아직 소개를 작성하지 않았어요.'}</Text>
          <Text style={styles.count}>팔로워 {profile.followerCount}명</Text>
          <Pressable accessibilityLabel={actionLabel} accessibilityRole="button" disabled={followMutation.isPending} onPress={handleToggleFollow} style={[styles.followButton, profile.isFollowing && styles.followingButton]}>
            <Text style={[styles.followButtonText, profile.isFollowing && styles.followingButtonText]}>{followMutation.isPending ? '저장 중…' : profile.isFollowing ? '언팔로우' : '팔로우'}</Text>
          </Pressable>
          {followMutation.isError ? <Text accessibilityRole="alert" style={styles.error}>팔로우 상태를 저장하지 못했어요. 다시 시도해 주세요.</Text> : null}
          <Pressable accessibilityLabel={`${profile.displayName} 프로필 신고`} accessibilityRole="button" disabled={reportMutation.isPending} onPress={handleReportProfile} style={styles.reportButton}>
            <Text style={styles.reportButtonText}>{reportMutation.isPending ? '신고 접수 중…' : '프로필 신고'}</Text>
          </Pressable>
          {reportMutation.isSuccess ? <Text accessibilityRole="alert" style={styles.notice}>프로필 신고를 접수했어요.</Text> : null}
          {reportMutation.isError ? <Text accessibilityRole="alert" style={styles.error}>프로필 신고를 접수하지 못했어요. 다시 시도해 주세요.</Text> : null}
        </View>
        <View style={styles.followerSection}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>팔로워</Text>
          {followersQuery.isPending ? <ActivityIndicator accessibilityLabel="팔로워를 불러오고 있어요." color={mobileColors.accent} /> : null}
          {followersQuery.isError ? <Pressable accessibilityLabel="팔로워 다시 불러오기" accessibilityRole="button" onPress={() => void followersQuery.refetch()} style={styles.retry}><Text style={styles.retryText}>다시 시도</Text></Pressable> : null}
          {followersQuery.data?.length === 0 ? <Text style={styles.muted}>아직 팔로워가 없어요.</Text> : null}
          {followersQuery.data?.map((follower) => <Text key={follower.id} style={styles.follower}>{follower.displayName}</Text>)}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

/** 공개 프로필 데이터를 불러오는 동안 전체 화면 진행 상태를 표시한다. */
function PublicProfileStatus({ label }: { label: string }): React.JSX.Element {
  return <SafeAreaView style={styles.container}><View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.center}><ActivityIndicator color={mobileColors.accent} /><Text style={styles.muted}>{label}</Text></View></SafeAreaView>
}

/** 공개 프로필을 찾지 못하거나 조회 실패했을 때 재시도와 뒤로가기를 제공한다. */
function PublicProfileError({ onBack, onRetry }: { onBack(): void; onRetry(): void }): React.JSX.Element {
  return <SafeAreaView style={styles.container}><View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>프로필을 불러오지 못했어요.</Text><Pressable accessibilityLabel="프로필 다시 불러오기" accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>다시 시도</Text></Pressable><Pressable accessibilityLabel="이전 화면으로 돌아가기" accessibilityRole="button" onPress={onBack} style={styles.back}><Text style={styles.backText}>이전으로</Text></Pressable></View></SafeAreaView>
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', backgroundColor: mobileColors.surfaceRaised, borderRadius: 40, height: 80, justifyContent: 'center', width: 80 },
  avatarText: { color: mobileColors.ink, fontSize: 30, fontWeight: '700' }, back: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, minWidth: 72 }, backText: { color: mobileColors.ink, fontWeight: '700' }, bio: { color: mobileColors.inkSubtle, lineHeight: 22, textAlign: 'center' }, center: { alignItems: 'center', flex: 1, gap: 16, justifyContent: 'center', padding: 16 }, container: { backgroundColor: mobileColors.surface, flex: 1, paddingHorizontal: 16 }, content: { paddingBottom: 32 }, count: { color: mobileColors.ink, fontWeight: '700', marginTop: 16 }, error: { color: mobileColors.danger, textAlign: 'center' }, followButton: { alignItems: 'center', backgroundColor: mobileColors.primaryAction, borderRadius: 12, justifyContent: 'center', marginTop: 20, minHeight: 48, width: '100%' }, followButtonText: { color: mobileColors.primaryActionText, fontWeight: '700' }, follower: { color: mobileColors.ink, minHeight: 44, paddingVertical: 12 }, followerSection: { borderTopColor: '#333333', borderTopWidth: 1, marginTop: 32, paddingTop: 24 }, followingButton: { backgroundColor: '#191919', borderColor: mobileColors.borderStrong, borderWidth: 1 }, followingButtonText: { color: mobileColors.ink }, muted: { color: mobileColors.inkSubtle }, name: { color: mobileColors.ink, fontSize: 24, fontWeight: '700', marginTop: 16 }, notice: { color: '#BDEACB', textAlign: 'center' }, profileCard: { alignItems: 'center', marginTop: 20 }, reportButton: { alignItems: 'center', justifyContent: 'center', marginTop: 12, minHeight: 44, paddingHorizontal: 16 }, reportButtonText: { color: mobileColors.inkSubtle, fontWeight: '700' }, retry: { alignItems: 'center', borderColor: mobileColors.borderStrong, borderRadius: 12, borderWidth: 1, justifyContent: 'center', marginTop: 12, minHeight: 44, paddingHorizontal: 16 }, retryText: { color: mobileColors.ink, fontWeight: '700' }, sectionTitle: { color: mobileColors.ink, fontSize: 18, fontWeight: '700', marginBottom: 12 },
})
