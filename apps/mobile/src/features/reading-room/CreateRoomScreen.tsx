import { createRoomFormSchema, readingRoomKeys, type CreateRoomForm } from '@talkhugam/domain'
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

import { createMobileRoomWithInvite } from '../../entities/reading-room'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'

type CreateRoomScreenProps = {
  onFinished(): void
}

type CreatedRoomInvite = {
  code: string
}

const initialForm: CreateRoomForm = { description: '', name: '' }

/** 비공개 책방 생성 입력을 검증하고 생성 직후 발급된 초대 코드만 한 번 표시한다. */
export function CreateRoomScreen({ onFinished }: CreateRoomScreenProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CreateRoomForm>(initialForm)
  const [createdInvite, setCreatedInvite] = useState<CreatedRoomInvite | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmitLockedRef = useRef(false)

  /** 책방 이름을 저장하고 이전 입력 오류를 지운다. */
  function handleChangeName(name: string): void {
    setForm((current) => ({ ...current, name }))
    setErrorMessage(null)
  }

  /** 선택 소개를 저장하고 이전 입력 오류를 지운다. */
  function handleChangeDescription(description: string): void {
    setForm((current) => ({ ...current, description }))
    setErrorMessage(null)
  }

  /** 유효한 생성 입력만 서버 RPC에 전달하고 일회용 초대를 메모리에 보관한다. */
  async function handleSubmit(): Promise<void> {
    if (isSubmitting || isSubmitLockedRef.current) return

    const parsedForm = createRoomFormSchema.safeParse(form)
    if (!parsedForm.success) {
      setErrorMessage(parsedForm.error.issues[0]?.message ?? '입력 내용을 확인해 주세요.')
      return
    }

    isSubmitLockedRef.current = true
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const invite = await createMobileRoomWithInvite(createMobileSupabaseClient(), parsedForm.data)
      await queryClient.invalidateQueries({ queryKey: readingRoomKeys.all })
      setCreatedInvite({ code: invite.code })
    } catch {
      setErrorMessage('책방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      isSubmitLockedRef.current = false
      setIsSubmitting(false)
    }
  }

  if (createdInvite)
    return <CreatedRoomInviteScreen invite={createdInvite} onFinished={onFinished} />

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={styles.eyebrow}>새 비공개 책방</Text>
            <Text style={styles.title}>함께 읽을 공간을{`\n`}만들어 볼까요?</Text>
            <Text style={styles.description}>초대받은 사람만 참여할 수 있어요.</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>책방 이름</Text>
              <TextInput
                accessibilityLabel="책방 이름"
                editable={!isSubmitting}
                maxLength={40}
                onChangeText={handleChangeName}
                placeholder="예: 금요일 아침 책방"
                placeholderTextColor="#8D8D8D"
                style={styles.textInput}
                value={form.name}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>한 줄 소개 (선택)</Text>
              <TextInput
                accessibilityLabel="한 줄 소개"
                editable={!isSubmitting}
                maxLength={120}
                multiline
                onChangeText={handleChangeDescription}
                placeholder="예: 이번 달 함께 읽는 책들"
                placeholderTextColor="#8D8D8D"
                style={[styles.textInput, styles.descriptionInput]}
                textAlignVertical="top"
                value={form.description}
              />
            </View>
            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {errorMessage}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel={isSubmitting ? '책방을 만들고 있어요.' : '책방 만들기'}
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
            {isSubmitting ? <ActivityIndicator color="#000000" /> : null}
            <Text style={styles.primaryActionText}>
              {isSubmitting ? '책방을 만들고 있어요.' : '책방 만들기'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

type CreatedRoomInviteScreenProps = {
  invite: CreatedRoomInvite
  onFinished(): void
}

/** 생성 직후 메모리에만 있는 초대 코드를 안내하고 책방 목록으로 돌아가는 완료 화면을 표시한다. */
function CreatedRoomInviteScreen({
  invite,
  onFinished,
}: CreatedRoomInviteScreenProps): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.completedContent}>
        <Text style={styles.eyebrow}>책방 만들기 완료</Text>
        <Text style={styles.title}>책방이 만들어졌어요!</Text>
        <Text style={styles.description}>초대 코드를 친구에게 보내고 함께 읽어 보세요.</Text>
        <View style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>초대 코드</Text>
          <Text style={styles.inviteCode}>{invite.code}</Text>
          <Text style={styles.inviteNotice}>지금 한 번만 확인할 수 있는 초대 코드예요.</Text>
        </View>
      </View>
      <Pressable
        accessibilityLabel="내 책방으로 가기"
        accessibilityRole="button"
        onPress={onFinished}
        style={({ pressed }) => [styles.primaryAction, pressed && styles.primaryActionPressed]}
      >
        <Text style={styles.primaryActionText}>내 책방으로 가기</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  completedContent: { flex: 1, justifyContent: 'center' },
  container: { backgroundColor: '#000000', flex: 1, padding: 16 },
  description: { color: '#C7C7C7', fontSize: 15, lineHeight: 22, marginTop: 12 },
  descriptionInput: { minHeight: 112, paddingTop: 12 },
  errorText: { color: '#FF8A8A', fontSize: 14, lineHeight: 20, marginTop: 16 },
  eyebrow: { color: '#FF835F', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  fieldGroup: { gap: 8, marginTop: 24 },
  fieldLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', lineHeight: 22 },
  inviteCard: {
    backgroundColor: '#101010',
    borderColor: '#393939',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 32,
    padding: 24,
  },
  inviteCode: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 4,
    lineHeight: 40,
    marginTop: 8,
  },
  inviteLabel: { color: '#C7C7C7', fontSize: 13, lineHeight: 20 },
  inviteNotice: { color: '#FFB5A3', fontSize: 13, lineHeight: 20, marginTop: 16 },
  keyboardContainer: { flex: 1 },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: '#FF835F',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryActionDisabled: { backgroundColor: '#6F4B41' },
  primaryActionPressed: { backgroundColor: '#E46845' },
  primaryActionText: { color: '#000000', fontSize: 16, fontWeight: '700', lineHeight: 24 },
  scrollContent: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: 24 },
  textInput: {
    backgroundColor: '#101010',
    borderColor: '#393939',
    borderRadius: 12,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', lineHeight: 38, marginTop: 8 },
})
