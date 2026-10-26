import { joinRoomFormSchema, readingRoomKeys } from '@talkhugam/domain'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
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

import { joinMobileRoomByCode } from '../../entities/reading-room'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'
import { MobileBackButton } from '../../shared/ui/MobileBackButton'
import { mobileColors } from '../../shared/ui/mobileTheme'

type JoinRoomScreenProps = {
  inviteToken: string | null
  onBack?: () => void
  onJoined(): void
}

/** 초대 코드 또는 이미 검증된 링크 토큰으로 비공개 책방 참여를 요청한다. */
export function JoinRoomScreen({ inviteToken, onBack, onJoined }: JoinRoomScreenProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmitLockedRef = useRef(false)
  const hasInviteToken = inviteToken !== null
  const actionLabel = hasInviteToken ? '초대받은 책방에 참여하기' : '함께 읽기 시작하기'

  /** 직접 입력한 초대 코드를 보관하고 이전 오류 메시지를 지운다. */
  function handleChangeCode(value: string): void {
    setCode(value)
    setErrorMessage(null)
  }

  /** 유효한 초대 값만 참여 RPC에 전달하고 성공 뒤 책방 목록 이동을 요청한다. */
  async function handleSubmit(): Promise<void> {
    if (isSubmitting || isSubmitLockedRef.current) return

    const parsedCode = joinRoomFormSchema.safeParse({ code: inviteToken ?? code })
    if (!parsedCode.success) {
      setErrorMessage(parsedCode.error.issues[0]?.message ?? '초대 코드를 확인해 주세요.')
      return
    }

    isSubmitLockedRef.current = true
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await joinMobileRoomByCode(createMobileSupabaseClient(), parsedCode.data)
      await queryClient.invalidateQueries({ queryKey: readingRoomKeys.all })
      onJoined()
    } catch {
      setErrorMessage('앗, 이 코드로는 못 들어가요. 만료됐거나 잘못 입력된 코드 같아요.')
    } finally {
      isSubmitLockedRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {onBack ? <MobileBackButton onPress={onBack} /> : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={styles.title}>책방 초대장을{`\n`}받았어요</Text>
            <Text style={styles.description}>
              {hasInviteToken
                ? '친구가 보낸 초대 링크예요. 참여하면 책방 목록에 바로 추가돼요.'
                : '친구가 보낸 6자리 초대 코드를 입력해 주세요.'}
            </Text>
            {hasInviteToken ? null : (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>6자리 초대 코드</Text>
                <TextInput
                  accessibilityLabel="6자리 초대 코드"
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  editable={!isSubmitting}
                  maxLength={6}
                  onChangeText={handleChangeCode}
                  placeholder="ABC123"
                  placeholderTextColor={mobileColors.placeholder}
                  style={styles.textInput}
                  value={code}
                />
                <Text style={styles.helpText}>대문자·소문자는 안 가려도 돼요.</Text>
              </View>
            )}
            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {errorMessage}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel={isSubmitting ? '책방에 들어가고 있어요.' : actionLabel}
            accessibilityRole="button"
            accessibilityState={{ busy: isSubmitting, disabled: isSubmitting }}
            disabled={isSubmitting}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.primaryAction,
              isSubmitting && styles.primaryActionDisabled,
              pressed && !isSubmitting && styles.primaryActionPressed,
            ]}
          >
            {isSubmitting ? <ActivityIndicator color={mobileColors.primaryActionText} /> : null}
            <Text style={styles.primaryActionText}>
              {isSubmitting ? '책방에 들어가고 있어요.' : actionLabel}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: mobileColors.surface, flex: 1, padding: 16 },
  description: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22, marginTop: 12 },
  errorText: { color: mobileColors.danger, fontSize: 14, lineHeight: 20, marginTop: 16 },
  fieldGroup: { gap: 8, marginTop: 32 },
  fieldLabel: { color: mobileColors.ink, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  helpText: { color: mobileColors.inkSubtle, fontSize: 13, lineHeight: 20 },
  keyboardContainer: { flex: 1 },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: mobileColors.primaryAction,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryActionDisabled: { backgroundColor: mobileColors.borderStrong },
  primaryActionPressed: { backgroundColor: mobileColors.primaryActionPressed },
  primaryActionText: { color: mobileColors.primaryActionText, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  scrollContent: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: 24 },
  textInput: {
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    color: mobileColors.ink,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
    lineHeight: 28,
    minHeight: 52,
    paddingHorizontal: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: { color: mobileColors.ink, fontSize: 28, fontWeight: '700', lineHeight: 38, marginTop: 8 },
})
