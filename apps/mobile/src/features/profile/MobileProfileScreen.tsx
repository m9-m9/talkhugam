import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  getMobileNotificationPreferences,
  getMobileProfileAvatarUrl,
  getMobileProfile,
  requestMobileAccountDeletion,
  updateMobileNotificationPreferences,
  type MobileNotificationPreferences,
} from '../../entities/profile'
import { useMobileSessionProfileId } from '../../shared/api/MobileAppProviders'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'

type MobileProfileScreenProps = {
  onBack(): void
  onEditProfile(): void
  onSignedOut(): void
}

type NotificationPreferenceKey = keyof MobileNotificationPreferences

const notificationLabels: Record<NotificationPreferenceKey, string> = {
  mentionsEnabled: '멘션 알림',
  repliesEnabled: '답글 알림',
  roomEventsEnabled: '책방 알림',
}

/** 자신의 프로필, 알림 수신 설정, 로그아웃을 한 화면에서 관리하는 계정 허브를 표시한다. */
export function MobileProfileScreen({
  onBack,
  onEditProfile,
  onSignedOut,
}: MobileProfileScreenProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const profileId = useMobileSessionProfileId()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isPreferenceSaving, setIsPreferenceSaving] = useState(false)
  const [signOutErrorMessage, setSignOutErrorMessage] = useState<string | null>(null)
  const [deletionMode, setDeletionMode] = useState<'anonymize' | 'delete_content' | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletionError, setDeletionError] = useState<string | null>(null)
  const signOutLockedRef = useRef(false)
  const preferenceLockedRef = useRef(false)
  const profileQuery = useQuery({
    enabled: profileId !== null,
    queryFn: () => getMobileProfile(createMobileSupabaseClient()),
    queryKey: ['mobile-profile', profileId],
  })
  const preferencesQuery = useQuery({
    enabled: profileId !== null,
    queryFn: () => getMobileNotificationPreferences(createMobileSupabaseClient()),
    queryKey: ['notification-preferences', profileId],
  })
  const avatarQuery = useQuery({
    enabled: Boolean(profileQuery.data?.avatarPath),
    queryFn: () => getMobileProfileAvatarUrl(createMobileSupabaseClient(), profileQuery.data?.avatarPath ?? null),
    queryKey: ['mobile-profile-avatar', profileId, profileQuery.data?.avatarPath, profileQuery.data?.updatedAt],
  })
  const preferenceMutation = useMutation({
    mutationFn: (preferences: MobileNotificationPreferences) =>
      updateMobileNotificationPreferences(createMobileSupabaseClient(), preferences),
    onSuccess: (preferences) => {
      queryClient.setQueryData(['notification-preferences', profileId], preferences)
    },
  })

  /** 현재 화면에서만 프로필 편집 경로 진입을 부모 라우터에 요청한다. */
  function handleEditProfile(): void {
    onEditProfile()
  }

  /** 실패한 자기 프로필 조회를 다시 요청한다. */
  function handleRetryProfile(): void {
    void profileQuery.refetch()
  }

  /** 실패한 자기 알림 설정 조회를 다시 요청한다. */
  function handleRetryPreferences(): void {
    void preferencesQuery.refetch()
  }

  /** 활성화된 한 알림 종류만 반전해 저장하며 저장 중 중복 변경을 막는다. */
  async function handleChangePreference(key: NotificationPreferenceKey): Promise<void> {
    const preferences = preferencesQuery.data
    if (!preferences || isPreferenceSaving || preferenceLockedRef.current) return

    preferenceLockedRef.current = true
    setIsPreferenceSaving(true)
    try {
      await preferenceMutation.mutateAsync({ ...preferences, [key]: !preferences[key] })
    } catch {
      // mutation 상태가 사용자에게 저장 오류를 표시한다.
    } finally {
      preferenceLockedRef.current = false
      setIsPreferenceSaving(false)
    }
  }

  /** 기기 세션을 제거한 뒤에만 로그인 시작 화면으로 이동을 요청한다. */
  async function handleSignOut(): Promise<void> {
    if (isSigningOut || signOutLockedRef.current) return

    signOutLockedRef.current = true
    setIsSigningOut(true)
    setSignOutErrorMessage(null)
    try {
      const response = await createMobileSupabaseClient().auth.signOut()
      if (response.error) throw response.error
      onSignedOut()
    } catch {
      setSignOutErrorMessage('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      signOutLockedRef.current = false
      setIsSigningOut(false)
    }
  }

  /** 삭제 방식을 선택해 사용자가 최종 확인할 수 있는 상태로 전환한다. */
  function handleSelectDeletionMode(mode: 'anonymize' | 'delete_content'): void { setDeletionMode(mode); setDeletionError(null) }

  /** 서버 삭제 성공 뒤에만 기기 세션을 지우고 로그인 시작 화면 이동을 요청한다. */
  async function handleConfirmDeletion(): Promise<void> {
    if (!deletionMode || isDeleting) return
    setIsDeleting(true); setDeletionError(null)
    try {
      await requestMobileAccountDeletion(createMobileSupabaseClient(), deletionMode)
      const response = await createMobileSupabaseClient().auth.signOut()
      if (response.error) throw response.error
      queryClient.clear()
      onSignedOut()
    } catch { setDeletionError('계정 삭제를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.') } finally { setIsDeleting(false) }
  }

  if (profileQuery.isPending) return <ProfileLoadingState />
  if (profileQuery.isError || !profileQuery.data)
    return <ProfileLoadErrorState onRetry={handleRetryProfile} />

  const profile = profileQuery.data
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="책방으로 돌아가기" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ 책방</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.heading}>내 정보</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>{avatarQuery.data ? <Image accessibilityLabel="프로필 사진" source={{ uri: avatarQuery.data }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{profile.displayName.slice(0, 1)}</Text>}</View>
          <View style={styles.profileCopy}>
            <Text style={styles.displayName}>{profile.displayName}</Text>
            <Text style={styles.bio}>{profile.bio || '아직 소개를 작성하지 않았어요.'}</Text>
          </View>
        </View>
        <Pressable accessibilityLabel="내 정보 수정" accessibilityRole="button" onPress={handleEditProfile} style={({ pressed }) => [styles.outlineButton, pressed && styles.outlineButtonPressed]}>
          <Text style={styles.outlineButtonText}>내 정보 수정</Text>
        </Pressable>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>알림 설정</Text>
          <Text style={styles.sectionDescription}>원하는 책방 소식만 받아 보세요.</Text>
          <NotificationPreferencesContent
            error={preferencesQuery.isError}
            isLoading={preferencesQuery.isPending}
            isSaving={isPreferenceSaving}
            onChange={handleChangePreference}
            onRetry={handleRetryPreferences}
            preferences={preferencesQuery.data ?? null}
            saveError={preferenceMutation.isError}
          />
        </View>
        {avatarQuery.isError ? <Pressable accessibilityLabel="프로필 사진 다시 불러오기" accessibilityRole="button" onPress={() => void avatarQuery.refetch()} style={styles.retryButton}><Text style={styles.retryText}>프로필 사진 다시 불러오기</Text></Pressable> : null}
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>계정 삭제</Text>
          <Text style={styles.sectionDescription}>삭제 방식은 되돌릴 수 없어요.</Text>
          <Pressable accessibilityLabel="프로필만 익명화하고 계정 삭제" accessibilityRole="button" disabled={isDeleting} onPress={() => handleSelectDeletionMode('anonymize')} style={styles.outlineButton}><Text style={styles.outlineButtonText}>프로필 익명화 후 삭제</Text></Pressable>
          <Pressable accessibilityLabel="콘텐츠까지 삭제하고 계정 삭제" accessibilityRole="button" disabled={isDeleting} onPress={() => handleSelectDeletionMode('delete_content')} style={styles.outlineButton}><Text style={styles.outlineButtonText}>콘텐츠까지 삭제</Text></Pressable>
        </View>
        {signOutErrorMessage ? <Text accessibilityRole="alert" style={styles.errorText}>{signOutErrorMessage}</Text> : null}
        <Pressable accessibilityLabel={isSigningOut ? '로그아웃하고 있어요.' : '로그아웃'} accessibilityRole="button" disabled={isSigningOut} onPress={() => void handleSignOut()} style={({ pressed }) => [styles.signOutButton, isSigningOut && styles.disabledButton, pressed && !isSigningOut && styles.signOutButtonPressed]}>
          {isSigningOut ? <ActivityIndicator color="#FF835F" /> : <Text style={styles.signOutText}>로그아웃</Text>}
        </Pressable>
        {deletionMode ? <View accessibilityLabel="계정 삭제 확인" accessibilityViewIsModal style={styles.deletionSheet}><Text style={styles.sectionTitle}>{deletionMode === 'anonymize' ? '프로필을 익명화하고 삭제할까요?' : '콘텐츠까지 삭제할까요?'}</Text><Text style={styles.sectionDescription}>이 작업은 되돌릴 수 없어요.</Text>{deletionError ? <Text accessibilityRole="alert" style={styles.errorText}>{deletionError}</Text> : null}<Pressable accessibilityLabel="계정 삭제 최종 확인" accessibilityRole="button" disabled={isDeleting} onPress={() => void handleConfirmDeletion()} style={styles.deleteConfirm}><Text style={styles.deleteConfirmText}>{isDeleting ? '삭제 중…' : '삭제하기'}</Text></Pressable><Pressable accessibilityLabel="계정 삭제 취소" accessibilityRole="button" disabled={isDeleting} onPress={() => setDeletionMode(null)} style={styles.closeDeletion}><Text style={styles.closeDeletionText}>취소</Text></Pressable></View> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

type NotificationPreferencesContentProps = {
  error: boolean
  isLoading: boolean
  isSaving: boolean
  onChange(key: NotificationPreferenceKey): void
  onRetry(): void
  preferences: MobileNotificationPreferences | null
  saveError: boolean
}

/** 알림 설정의 로딩·오류·저장 상태를 분리해 세 가지 수신 토글을 표시한다. */
function NotificationPreferencesContent({ error, isLoading, isSaving, onChange, onRetry, preferences, saveError }: NotificationPreferencesContentProps): React.JSX.Element {
  if (isLoading) return <View accessibilityLabel="알림 설정을 불러오고 있어요." accessibilityRole="progressbar" style={styles.inlineStatus}><ActivityIndicator color="#FF835F" /><Text style={styles.statusText}>알림 설정을 불러오고 있어요.</Text></View>
  if (error || !preferences) return <View style={styles.preferenceError}><Text accessibilityRole="alert" style={styles.errorText}>알림 설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</Text><Pressable accessibilityLabel="알림 설정 다시 불러오기" accessibilityRole="button" onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>다시 시도</Text></Pressable></View>

  return <View style={styles.preferenceList}>
    {(Object.keys(notificationLabels) as NotificationPreferenceKey[]).map((key) => <NotificationPreferenceRow isDisabled={isSaving} key={key} label={notificationLabels[key]} onChange={() => onChange(key)} value={preferences[key]} />)}
    {isSaving ? <View accessibilityLabel="알림 설정을 저장하고 있어요." accessibilityRole="progressbar" style={styles.inlineStatus}><ActivityIndicator color="#FF835F" /><Text style={styles.statusText}>알림 설정을 저장하고 있어요.</Text></View> : null}
    {saveError ? <Text accessibilityRole="alert" style={styles.errorText}>알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.</Text> : null}
  </View>
}

/** 한 종류의 알림 수신 여부를 44px 행과 네이티브 switch로 제어한다. */
function NotificationPreferenceRow({ isDisabled, label, onChange, value }: { isDisabled: boolean; label: string; onChange(): void; value: boolean }): React.JSX.Element {
  return <View style={styles.preferenceRow}><Text style={styles.preferenceLabel}>{label}</Text><Switch accessibilityLabel={label} accessibilityRole="switch" accessibilityState={{ busy: isDisabled, disabled: isDisabled }} disabled={isDisabled} onValueChange={onChange} thumbColor="#FFFFFF" trackColor={{ false: '#4A4A4A', true: '#AD3D22' }} value={value} /></View>
}

/** 프로필 정보를 준비하는 동안 전체 화면 진행 상태를 표시한다. */
function ProfileLoadingState(): React.JSX.Element {
  return <SafeAreaView style={styles.container}><View accessibilityLabel="내 정보를 불러오고 있어요." accessibilityRole="progressbar" style={styles.centered}><ActivityIndicator color="#FF835F" /><Text style={styles.statusText}>내 정보를 불러오고 있어요.</Text></View></SafeAreaView>
}

/** 자기 프로필 조회 실패를 안전한 뒤로가기와 재시도로 안내한다. */
function ProfileLoadErrorState({ onRetry }: { onRetry(): void }): React.JSX.Element {
  return <SafeAreaView style={styles.container}><View style={styles.centered}><Text accessibilityRole="alert" style={styles.errorText}>내 정보를 불러오지 못했어요. 다시 시도해 주세요.</Text><Pressable accessibilityLabel="내 정보 다시 불러오기" accessibilityRole="button" onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>다시 시도</Text></Pressable></View></SafeAreaView>
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', backgroundColor: '#AD3D22', borderRadius: 32, height: 64, justifyContent: 'center', width: 64 },
  avatarImage: { borderRadius: 32, height: 64, width: 64 },
  avatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  backButton: { justifyContent: 'center', minHeight: 44, minWidth: 72 },
  backButtonText: { color: '#FF835F', fontSize: 15, fontWeight: '700' },
  bio: { color: '#C7C7C7', fontSize: 15, lineHeight: 22, marginTop: 4 },
  centered: { alignItems: 'center', flex: 1, gap: 16, justifyContent: 'center', padding: 16 },
  container: { backgroundColor: '#000000', flex: 1, paddingHorizontal: 16 },
  disabledButton: { opacity: 0.5 },
  deletionSheet: { backgroundColor: '#101010', borderColor: '#393939', borderRadius: 16, borderWidth: 1, gap: 12, marginTop: 24, padding: 16 },
  deleteConfirm: { alignItems: 'center', backgroundColor: '#FF835F', borderRadius: 12, justifyContent: 'center', minHeight: 48 },
  deleteConfirmText: { color: '#000000', fontWeight: '700' },
  closeDeletion: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  closeDeletionText: { color: '#C7C7C7', fontWeight: '700' },
  displayName: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', lineHeight: 30 },
  errorText: { color: '#FF8A8A', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  heading: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 26 },
  inlineStatus: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 44 },
  outlineButton: { alignItems: 'center', borderColor: '#FF835F', borderRadius: 12, borderWidth: 1, justifyContent: 'center', marginTop: 24, minHeight: 48 },
  outlineButtonPressed: { backgroundColor: '#25130E' },
  outlineButtonText: { color: '#FF835F', fontSize: 16, fontWeight: '700' },
  preferenceError: { alignItems: 'center', gap: 12, marginTop: 16 },
  preferenceLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  preferenceList: { gap: 4, marginTop: 16 },
  preferenceRow: { alignItems: 'center', borderBottomColor: '#2A2A2A', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52 },
  profileCard: { alignItems: 'center', flexDirection: 'row', gap: 16, marginTop: 32 },
  profileCopy: { flex: 1 },
  retryButton: { alignItems: 'center', borderColor: '#FF835F', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 },
  retryText: { color: '#FF835F', fontSize: 15, fontWeight: '700' },
  scrollContent: { paddingBottom: 32 },
  section: { marginTop: 40 },
  sectionDescription: { color: '#C7C7C7', fontSize: 14, lineHeight: 20, marginTop: 4 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 26 },
  signOutButton: { alignItems: 'center', borderColor: '#5B3029', borderRadius: 12, borderWidth: 1, justifyContent: 'center', marginTop: 40, minHeight: 48 },
  signOutButtonPressed: { backgroundColor: '#241110' },
  signOutText: { color: '#FFB5A3', fontSize: 16, fontWeight: '700' },
  statusText: { color: '#C7C7C7', fontSize: 14, lineHeight: 20 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 56 },
  topBarSpacer: { minWidth: 72 },
})
