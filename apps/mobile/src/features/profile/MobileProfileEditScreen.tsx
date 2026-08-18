import { profileFormSchema, type ProfileForm } from '@talkhugam/domain'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getMobileProfile, updateMobileProfile } from '../../entities/profile'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'

type MobileProfileEditScreenProps = { onBack(): void; onSaved(): void }
const initialProfileForm: ProfileForm = { bio: '', displayName: '' }

/** 현재 회원의 이름과 소개를 편집하며 검증된 저장 완료 후 이전 화면 이동을 요청한다. */
export function MobileProfileEditScreen({ onBack, onSaved }: MobileProfileEditScreenProps): React.JSX.Element {
  const [profileForm, setProfileForm] = useState<ProfileForm>(initialProfileForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const saveLockedRef = useRef(false)
  useEffect(() => {
    let isMounted = true
    /** 현재 로그인 회원의 프로필만 편집 폼에 채운다. */
    async function loadProfile(): Promise<void> {
      setIsLoading(true); setErrorMessage(null)
      try {
        const profile = await getMobileProfile(createMobileSupabaseClient())
        if (isMounted) setProfileForm({ bio: profile.bio ?? '', displayName: profile.displayName })
      } catch { if (isMounted) setErrorMessage('내 정보를 불러오지 못했어요. 다시 시도해 주세요.') } finally { if (isMounted) setIsLoading(false) }
    }
    void loadProfile()
    return () => { isMounted = false }
  }, [loadAttempt])

  /** 검증된 프로필 입력을 한 번만 저장하고 성공 후 부모 라우팅을 요청한다. */
  async function handleSubmit(): Promise<void> {
    if (isSaving || saveLockedRef.current) return
    const parsed = profileFormSchema.safeParse(profileForm)
    if (!parsed.success) { setErrorMessage(parsed.error.issues[0]?.message ?? '입력 내용을 확인해 주세요.'); return }
    saveLockedRef.current = true; setIsSaving(true); setErrorMessage(null)
    try { await updateMobileProfile(createMobileSupabaseClient(), parsed.data); onSaved() } catch { setErrorMessage('저장하지 못했어요. 잠시 후 다시 시도해 주세요.') } finally { saveLockedRef.current = false; setIsSaving(false) }
  }

  /** 이름 수정 값을 폼에 반영한다. */
  function handleChangeDisplayName(displayName: string): void { setProfileForm((current) => ({ ...current, displayName })); setErrorMessage(null) }
  /** 소개 수정 값을 폼에 반영한다. */
  function handleChangeBio(bio: string): void { setProfileForm((current) => ({ ...current, bio })); setErrorMessage(null) }
  /** 실패한 자기 프로필 조회를 반복한다. */
  function handleRetryLoad(): void { setLoadAttempt((attempt) => attempt + 1) }

  if (isLoading) return <SafeAreaView style={styles.container}><View accessibilityLabel="프로필을 준비하고 있어요." accessibilityRole="progressbar" style={styles.centered}><ActivityIndicator color="#FF835F" /><Text style={styles.subtle}>프로필을 준비하고 있어요.</Text></View></SafeAreaView>
  if (errorMessage && profileForm.displayName.length === 0) return <SafeAreaView style={styles.container}><View style={styles.centered}><Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text><Pressable accessibilityLabel="프로필 다시 불러오기" accessibilityRole="button" onPress={handleRetryLoad} style={styles.outlineButton}><Text style={styles.outlineText}>다시 시도</Text></Pressable></View></SafeAreaView>
  return <SafeAreaView style={styles.container}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><Pressable accessibilityLabel="내 정보로 돌아가기" accessibilityRole="button" onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹ 내 정보</Text></Pressable><Text accessibilityRole="header" style={styles.title}>내 정보 수정</Text><Text style={styles.subtle}>책방에서 함께 읽을 사람들이 볼 프로필이에요.</Text><View style={styles.field}><Text style={styles.label}>이름</Text><TextInput accessibilityLabel="이름" editable={!isSaving} maxLength={30} onChangeText={handleChangeDisplayName} placeholder="이름을 입력해 주세요" placeholderTextColor="#8D8D8D" style={styles.input} value={profileForm.displayName} /></View><View style={styles.field}><Text style={styles.label}>한 줄 소개 (선택)</Text><TextInput accessibilityLabel="한 줄 소개" editable={!isSaving} maxLength={80} multiline onChangeText={handleChangeBio} placeholder="함께 읽고 싶은 이야기를 알려 주세요" placeholderTextColor="#8D8D8D" style={[styles.input, styles.bioInput]} textAlignVertical="top" value={profileForm.bio ?? ''} /></View>{errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}<Pressable accessibilityLabel={isSaving ? '저장하고 있어요.' : '저장하기'} accessibilityRole="button" disabled={isSaving} onPress={() => void handleSubmit()} style={({ pressed }) => [styles.saveButton, isSaving && styles.disabled, pressed && !isSaving && styles.savePressed]}>{isSaving ? <ActivityIndicator color="#000000" /> : <Text style={styles.saveText}>저장하기</Text>}</Pressable></ScrollView></KeyboardAvoidingView></SafeAreaView>
}

const styles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }, backText: { color: '#FF835F', fontSize: 15, fontWeight: '700' }, bioInput: { minHeight: 112, paddingTop: 12 }, centered: { alignItems: 'center', flex: 1, gap: 16, justifyContent: 'center', padding: 16 }, container: { backgroundColor: '#000000', flex: 1, paddingHorizontal: 16 }, disabled: { opacity: 0.5 }, error: { color: '#FF8A8A', fontSize: 14, lineHeight: 20 }, field: { gap: 8, marginTop: 24 }, input: { backgroundColor: '#101010', borderColor: '#393939', borderRadius: 12, borderWidth: 1, color: '#FFFFFF', fontSize: 16, minHeight: 48, paddingHorizontal: 12 }, keyboard: { flex: 1 }, label: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' }, outlineButton: { alignItems: 'center', borderColor: '#FF835F', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 }, outlineText: { color: '#FF835F', fontSize: 15, fontWeight: '700' }, saveButton: { alignItems: 'center', backgroundColor: '#FF835F', borderRadius: 12, justifyContent: 'center', marginTop: 32, minHeight: 52 }, savePressed: { backgroundColor: '#E46845' }, saveText: { color: '#000000', fontSize: 16, fontWeight: '700' }, scroll: { paddingBottom: 32 }, subtle: { color: '#C7C7C7', fontSize: 15, lineHeight: 22, marginTop: 8 }, title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', lineHeight: 38, marginTop: 20 },
})
