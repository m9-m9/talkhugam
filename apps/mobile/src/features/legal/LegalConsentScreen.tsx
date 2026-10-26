import { useState } from 'react'
import { legalDocumentVersion } from '@talkhugam/domain'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { mobileColors } from '../../shared/ui/theme'

type LegalDocument = {
  id: 'terms' | 'privacy'
  shortTitle: string
  url: string
}

type LegalConsentScreenProps = {
  onSubmit(): Promise<void>
}

const requiredLegalDocuments: readonly LegalDocument[] = [
  {
    id: 'terms',
    shortTitle: '이용약관',
    url: 'https://talkhugam.vercel.app/legal/terms',
  },
  {
    id: 'privacy',
    shortTitle: '개인정보처리방침',
    url: 'https://talkhugam.vercel.app/legal/privacy',
  },
]

/** 필수 정책 문서의 동의 여부와 저장 요청을 처리하는 모바일 화면을 표시한다. */
export function LegalConsentScreen({ onSubmit }: LegalConsentScreenProps): React.JSX.Element {
  const [agreedDocumentIds, setAgreedDocumentIds] = useState<Set<LegalDocument['id']>>(
    () => new Set(),
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const hasAgreedToAll = agreedDocumentIds.size === requiredLegalDocuments.length

  /** 선택한 정책 문서의 동의 상태를 바꾼다. */
  function handleToggleDocument(documentId: LegalDocument['id']): void {
    setAgreedDocumentIds((current) => {
      const next = new Set(current)
      if (next.has(documentId)) next.delete(documentId)
      else next.add(documentId)
      return next
    })
  }

  /** 웹에서 유지되는 최신 정책 문서를 기기 브라우저로 연다. */
  function handleOpenDocument(url: string): void {
    void Linking.openURL(url)
  }

  /** 모든 필수 문서에 동의한 경우에만 서버 저장과 다음 화면 전환을 요청한다. */
  async function handleSubmit(): Promise<void> {
    if (!hasAgreedToAll || isSubmitting) return

    setErrorMessage(null)
    setIsSubmitting(true)
    try {
      await onSubmit()
    } catch {
      setErrorMessage('동의를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Talk후감 시작하기</Text>
        <Text style={styles.title}>함께 읽기 전에{`\n`}약속을 확인해요</Text>
        <Text style={styles.description}>
          서비스 이용에 꼭 필요한 두 가지 약관이에요. 마케팅 알림 동의는 받지 않아요.
        </Text>
        <View accessibilityLabel="필수 정책 동의" style={styles.documentList}>
          {requiredLegalDocuments.map((document) => {
            const isChecked = agreedDocumentIds.has(document.id)
            return (
              <View key={document.id} style={styles.documentRow}>
                <Pressable
                  accessibilityLabel={`${document.shortTitle}에 동의합니다.`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  onPress={() => handleToggleDocument(document.id)}
                  style={styles.documentToggle}
                >
                  <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                    {isChecked ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <View style={styles.documentCopy}>
                    <Text style={styles.documentTitle}>[필수] {document.shortTitle} 동의</Text>
                    <Text style={styles.documentVersion}>시행일 · {legalDocumentVersion}</Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityLabel={`${document.shortTitle} 보기`}
                  accessibilityRole="link"
                  hitSlop={8}
                  onPress={() => handleOpenDocument(document.url)}
                >
                  <Text style={styles.documentLink}>보기</Text>
                </Pressable>
              </View>
            )
          })}
        </View>
        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorMessage}>
            {errorMessage}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel="동의하고 계속하기"
        accessibilityRole="button"
        disabled={!hasAgreedToAll || isSubmitting}
        onPress={() => void handleSubmit()}
        style={({ pressed }) => [
          styles.submitButton,
          (!hasAgreedToAll || isSubmitting) && styles.submitButtonDisabled,
          pressed && hasAgreedToAll && !isSubmitting && styles.submitButtonPressed,
        ]}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? '동의를 저장하고 있어요.' : '동의하고 계속하기'}
        </Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  checkbox: {
    alignItems: 'center',
    borderColor: mobileColors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxChecked: { backgroundColor: mobileColors.primaryAction, borderColor: mobileColors.ink },
  checkmark: { color: mobileColors.primaryActionText, fontSize: 16, fontWeight: '700', lineHeight: 20 },
  container: { backgroundColor: mobileColors.surface, flex: 1, padding: 16 },
  content: { flex: 1, paddingTop: 32 },
  description: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22, marginTop: 12 },
  documentCopy: { flex: 1, gap: 4 },
  documentLink: { color: mobileColors.ink, fontSize: 14, fontWeight: '700', lineHeight: 44 },
  documentList: { gap: 12, marginTop: 32 },
  documentRow: {
    alignItems: 'center',
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 12,
  },
  documentTitle: { color: mobileColors.ink, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  documentToggle: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minHeight: 52 },
  documentVersion: { color: mobileColors.inkSubtle, fontSize: 12, lineHeight: 18 },
  eyebrow: { color: mobileColors.accentText, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  errorMessage: { color: mobileColors.danger, fontSize: 14, lineHeight: 20, marginTop: 16 },
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
  title: { color: mobileColors.ink, fontSize: 28, fontWeight: '700', lineHeight: 38, marginTop: 8 },
})
