import { profileFormSchema, type ProfileForm } from '@talkhugam/domain'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { completeMobileOnboarding, getMobileProfile } from '../../entities/profile'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'
import { mobileColors } from '../../shared/ui/mobileTheme'

type OnboardingScreenProps = {
  onCompleted(): void
}

const initialProfileForm: ProfileForm = { bio: '', displayName: '' }

/** 필수 프로필을 준비하고 저장해 책방 진입을 요청하는 네이티브 온보딩 화면을 표시한다. */
export function OnboardingScreen({ onCompleted }: OnboardingScreenProps): React.JSX.Element {
  const [profileForm, setProfileForm] = useState<ProfileForm>(initialProfileForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const [validationErrorMessage, setValidationErrorMessage] = useState<string | null>(null)
  const isSubmitLockedRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    /** 현재 회원의 기존 프로필을 불러와 수정 가능한 온보딩 필드를 채운다. */
    async function loadProfile(): Promise<void> {
      setIsLoading(true)
      setLoadErrorMessage(null)

      try {
        const profile = await getMobileProfile(createMobileSupabaseClient())
        if (!isMounted) return

        setProfileForm({ bio: profile.bio ?? '', displayName: profile.displayName })
      } catch {
        if (isMounted) setLoadErrorMessage('프로필 정보를 불러오지 못했어요. 다시 시도해 주세요.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadProfile()

    return () => {
      isMounted = false
    }
  }, [loadAttempt])

  /** 이름 입력을 최신 폼 상태에 반영하고 이전 검증 오류를 제거한다. */
  function handleChangeDisplayName(displayName: string): void {
    setProfileForm((current) => ({ ...current, displayName }))
    setValidationErrorMessage(null)
  }

  /** 소개 입력을 최신 폼 상태에 반영하고 이전 검증 오류를 제거한다. */
  function handleChangeBio(bio: string): void {
    setProfileForm((current) => ({ ...current, bio }))
    setValidationErrorMessage(null)
  }

  /** 일시적인 프로필 조회 실패 뒤 같은 인증된 회원 정보를 다시 요청한다. */
  function handleRetryLoad(): void {
    setLoadAttempt((attempt) => attempt + 1)
  }

  /** 검증된 프로필을 저장한 뒤에만 다음 책방 화면으로의 이동을 요청한다. */
  async function handleSubmit(): Promise<void> {
    if (isSaving || isSubmitLockedRef.current) return

    const parsedProfile = profileFormSchema.safeParse(profileForm)
    if (!parsedProfile.success) {
      setValidationErrorMessage(parsedProfile.error.issues[0]?.message ?? '입력 내용을 확인해 주세요.')
      return
    }

    setSaveErrorMessage(null)
    setValidationErrorMessage(null)
    isSubmitLockedRef.current = true
    setIsSaving(true)
    try {
      await completeMobileOnboarding(createMobileSupabaseClient(), parsedProfile.data)
      onCompleted()
    } catch {
      setSaveErrorMessage('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      isSubmitLockedRef.current = false
      setIsSaving(false)
    }
  }

  if (isLoading) return <OnboardingLoadingState />
  if (loadErrorMessage)
    return <OnboardingLoadErrorState message={loadErrorMessage} onRetry={handleRetryLoad} />

  const errorMessage = validationErrorMessage ?? saveErrorMessage

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          accessibilityLabel="온보딩 입력"
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.eyebrow}>Talk후감 시작하기</Text>
            <Text style={styles.title}>나를 간단히{`\n`}소개해 주세요</Text>
            <Text style={styles.description}>책방에서 함께 읽을 사람들이 볼 프로필이에요.</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>이름</Text>
              <TextInput
                accessibilityLabel="이름"
                autoCapitalize="none"
                editable={!isSaving}
                maxLength={30}
                onChangeText={handleChangeDisplayName}
                placeholder="이름을 입력해 주세요"
                placeholderTextColor={mobileColors.placeholder}
                style={styles.textInput}
                value={profileForm.displayName}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>한 줄 소개 (선택)</Text>
              <TextInput
                accessibilityLabel="한 줄 소개"
                editable={!isSaving}
                maxLength={80}
                multiline
                onChangeText={handleChangeBio}
                placeholder="함께 읽고 싶은 이야기를 알려 주세요"
                placeholderTextColor={mobileColors.placeholder}
                style={[styles.textInput, styles.bioInput]}
                textAlignVertical="top"
                value={profileForm.bio ?? ''}
              />
            </View>
            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.errorMessage}>
                {errorMessage}
              </Text>
            ) : null}
          </View>
          {isSaving ? (
            <View
              accessibilityLabel="프로필을 저장하고 있어요."
              accessibilityRole="progressbar"
              style={styles.saveStatus}
            >
              <ActivityIndicator color={mobileColors.accent} />
              <Text style={styles.saveStatusText}>프로필을 저장하고 있어요.</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityLabel={isSaving ? '저장하고 있어요.' : '시작하기'}
            accessibilityRole="button"
            accessibilityState={{ busy: isSaving, disabled: isSaving }}
            disabled={isSaving}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.submitButton,
              isSaving && styles.submitButtonDisabled,
              pressed && !isSaving && styles.submitButtonPressed,
            ]}
          >
            <Text style={styles.submitButtonText}>
              {isSaving ? '저장하고 있어요.' : '시작하기'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

/** 프로필 기본값을 준비하는 동안 읽을 수 있는 전체 화면 진행 상태를 표시한다. */
function OnboardingLoadingState(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View accessibilityLabel="프로필을 준비하고 있어요." accessibilityRole="progressbar" style={styles.centered}>
        <ActivityIndicator color={mobileColors.accent} />
        <Text style={styles.loadingText}>프로필을 준비하고 있어요.</Text>
      </View>
    </SafeAreaView>
  )
}

type OnboardingLoadErrorStateProps = {
  message: string
  onRetry(): void
}

/** 프로필 초기 조회 오류와 같은 요청을 다시 시작할 수 있는 조작을 표시한다. */
function OnboardingLoadErrorState({
  message,
  onRetry,
}: OnboardingLoadErrorStateProps): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <Text accessibilityRole="alert" style={styles.errorMessage}>
          {message}
        </Text>
        <Pressable
          accessibilityLabel="프로필 다시 불러오기"
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
        >
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  bioInput: { minHeight: 112, paddingTop: 12 },
  centered: { alignItems: 'center', flex: 1, gap: 16, justifyContent: 'center' },
  container: { backgroundColor: mobileColors.surface, flex: 1, padding: 16 },
  content: { flex: 1, paddingTop: 32 },
  description: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22, marginTop: 12 },
  eyebrow: { color: mobileColors.accentText, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  errorMessage: { color: mobileColors.danger, fontSize: 14, lineHeight: 20, marginTop: 16 },
  fieldGroup: { gap: 8, marginTop: 24 },
  fieldLabel: { color: mobileColors.ink, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  keyboardContainer: { flex: 1 },
  loadingText: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22 },
  retryButton: {
    alignItems: 'center',
    borderColor: mobileColors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  retryButtonPressed: { backgroundColor: mobileColors.surfacePressed },
  retryButtonText: { color: mobileColors.ink, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  saveStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 12,
  },
  saveStatusText: { color: mobileColors.inkSubtle, fontSize: 14, lineHeight: 20 },
  scrollContent: { flexGrow: 1 },
  submitButton: {
    alignItems: 'center',
    backgroundColor: mobileColors.primaryAction,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonDisabled: { backgroundColor: mobileColors.borderStrong },
  submitButtonPressed: { backgroundColor: mobileColors.primaryActionPressed },
  submitButtonText: { color: mobileColors.primaryActionText, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  textInput: {
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    color: mobileColors.ink,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  title: { color: mobileColors.ink, fontSize: 28, fontWeight: '700', lineHeight: 38, marginTop: 8 },
})
