import { useQuery } from '@tanstack/react-query'
import {
  applyLineRange,
  findLineAtPoint,
  getLineRangeIds,
  getLineSelectionSummary,
  getPhotoQuoteErrorMessage,
  isPhotoDecodeError,
  isQuoteWithinLimit,
  joinOcrLines,
  ocrEmptyResultMessage,
  ocrQuoteMaxLength,
  recognizePagePhoto,
  toggleLineId,
  type LineRangeMode,
  type OcrLine,
} from '@talkhugam/domain'
import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'
import { MobileButton } from '../../shared/ui/MobileButton'
import { mobileColors, mobileRadius, mobileSpacing, mobileTouchTarget } from '../../shared/ui/mobileTheme'
import { preparePhotoForOcr, type PreparedOcrPhoto } from './mobilePhotoSource'
import type { PickedPhoto } from './pickedPhoto'

export type MobilePhotoQuoteInsert = { page: string | null; quote: string }

/** 기기에서 사진을 열거나 줄이지 못했을 때 보여 줄 문구. */
export const mobileUnreadablePhotoMessage = '이 사진을 열지 못했어요. 다른 사진을 골라 주세요.'

type MobilePhotoQuoteFlowProps = {
  bookChatId: string
  onClose(): void
  onInsert(value: MobilePhotoQuoteInsert): void
  /** 사진을 열지 못했을 때 흐름을 닫고 다른 사진을 다시 고르게 한다. */
  onPickAnotherPhoto(): void
  /** 문장을 읽을 사진. null이면 사진 없이 문장을 직접 적는 확인 화면만 연다. */
  photo: PickedPhoto | null
}

type Recognition = { lines: OcrLine[]; photo: PreparedOcrPhoto }

type DragState = { anchorId: string; baseIds: string[]; mode: LineRangeMode }

type OverlaySize = { height: number; width: number }

/** 사진을 긴 변 2000px JPEG로 줄여 ocr-page로 보내고, 미리보기용 사진과 인식한 줄을 함께 반환한다. */
async function recognizePickedPhoto(bookChatId: string, photo: PickedPhoto): Promise<Recognition> {
  const prepared = await preparePhotoForOcr(photo)
  const lines = await recognizePagePhoto(createMobileSupabaseClient(), bookChatId, prepared.base64)
  return { lines, photo: prepared }
}

/** 인식 실패 오류를 사진 열기 실패와 서버 인식 실패로 구분해 안내 문구로 바꾼다. */
function getRecognitionErrorMessage(error: unknown): string {
  if (isPhotoDecodeError(error)) return mobileUnreadablePhotoMessage
  return getPhotoQuoteErrorMessage(error)
}

/** 현재 단계와 직접 입력 여부로 화면 제목을 고른다. */
function getFlowTitle(step: 'select' | 'confirm', isManual: boolean): string {
  if (isManual) return '문장 직접 입력'
  return step === 'select' ? '문장 고르기' : '가져올 문장 확인'
}

/**
 * 책 페이지 사진을 받아 인식 → 줄 선택 → 문장 확인 단계를 전체 화면 모달로 보여 주고,
 * 확인한 인용 문장과 쪽을 onInsert로 넘긴다. 사진이 없으면 빈 확인 화면만 연다.
 * 사진과 인식 결과는 저장·기록하지 않는다.
 */
export function MobilePhotoQuoteFlow({
  bookChatId,
  onClose,
  onInsert,
  onPickAnotherPhoto,
  photo,
}: MobilePhotoQuoteFlowProps): React.JSX.Element {
  const isManual = photo === null
  const [requestKey] = useState(() => `${Date.now()}-${Math.random()}`)
  const [step, setStep] = useState<'select' | 'confirm'>(isManual ? 'confirm' : 'select')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isKeepingLineBreaks, setIsKeepingLineBreaks] = useState(false)
  const [quoteDraft, setQuoteDraft] = useState('')
  const [pageDraft, setPageDraft] = useState('')
  const recognitionQuery = useQuery({
    enabled: photo !== null,
    gcTime: 0,
    queryFn: () => (photo ? recognizePickedPhoto(bookChatId, photo) : Promise.reject(new Error('no photo'))),
    queryKey: ['photo-quote', 'ocr-page', bookChatId, requestKey],
    refetchOnReconnect: false,
    retry: false,
    staleTime: Infinity,
  })
  const lines = recognitionQuery.data?.lines ?? []
  const selectedTexts = getLineSelectionSummary(lines, selectedIds).texts

  /** 고른 줄을 정리한 문장으로 확인 화면을 연다. */
  function handleOpenConfirm(): void {
    setQuoteDraft(joinOcrLines(selectedTexts, { shouldKeepLineBreaks: isKeepingLineBreaks }))
    setStep('confirm')
  }

  /** 원문 줄바꿈 유지 여부를 바꾸고 고른 줄로 문장을 다시 만든다. */
  function handleToggleLineBreaks(): void {
    const nextValue = !isKeepingLineBreaks
    setIsKeepingLineBreaks(nextValue)
    setQuoteDraft(joinOcrLines(selectedTexts, { shouldKeepLineBreaks: nextValue }))
  }

  /** 확인한 문장과 쪽을 입력창에 넣도록 부모에 전달한다. */
  function handleInsert(): void {
    if (!isQuoteWithinLimit(quoteDraft)) return
    onInsert({ page: pageDraft.trim() || null, quote: quoteDraft.trim() })
  }

  /** 확인 단계면 줄 선택으로 돌아가고, 줄 선택·직접 입력이면 흐름을 닫는다. */
  function handleBack(): void {
    if (step === 'confirm' && !isManual) {
      setStep('select')
      return
    }
    onClose()
  }

  const title = getFlowTitle(step, isManual)

  return (
    <Modal animationType="slide" onRequestClose={handleBack} presentationStyle="fullScreen" visible>
      <SafeAreaView accessibilityLabel={title} accessibilityViewIsModal style={styles.container}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="이전 화면으로" accessibilityRole="button" onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        {step === 'select' ? (
          <SelectStep
            errorMessage={recognitionQuery.isError ? getRecognitionErrorMessage(recognitionQuery.error) : null}
            isPhotoUnreadable={recognitionQuery.isError && isPhotoDecodeError(recognitionQuery.error)}
            isRecognizing={recognitionQuery.isPending}
            isRetrying={recognitionQuery.isFetching}
            lines={lines}
            onChangeSelection={setSelectedIds}
            onNext={handleOpenConfirm}
            onPickAnotherPhoto={onPickAnotherPhoto}
            onRetry={() => void recognitionQuery.refetch()}
            preparedPhoto={recognitionQuery.data?.photo ?? null}
            selectedIds={selectedIds}
          />
        ) : (
          <ConfirmStep
            isKeepingLineBreaks={isKeepingLineBreaks}
            isManual={isManual}
            onChangePage={setPageDraft}
            onChangeQuote={setQuoteDraft}
            onInsert={handleInsert}
            onToggleLineBreaks={handleToggleLineBreaks}
            pageDraft={pageDraft}
            quoteDraft={quoteDraft}
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

type SelectStepProps = {
  errorMessage: string | null
  isPhotoUnreadable: boolean
  isRecognizing: boolean
  isRetrying: boolean
  lines: OcrLine[]
  onChangeSelection(ids: string[]): void
  onNext(): void
  onPickAnotherPhoto(): void
  onRetry(): void
  preparedPhoto: PreparedOcrPhoto | null
  selectedIds: string[]
}

/** 인식 상태에 맞춰 사진·줄 박스·줄 목록과 하단 선택 요약을 표시한다. */
function SelectStep({
  errorMessage,
  isPhotoUnreadable,
  isRecognizing,
  isRetrying,
  lines,
  onChangeSelection,
  onNext,
  onPickAnotherPhoto,
  onRetry,
  preparedPhoto,
  selectedIds,
}: SelectStepProps): React.JSX.Element {
  const summary = getLineSelectionSummary(lines, selectedIds)
  const isEmptyResult = !isRecognizing && !errorMessage && lines.length === 0

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {preparedPhoto ? (
          <PhotoLineOverlay
            lines={lines}
            onChangeSelection={onChangeSelection}
            photo={preparedPhoto}
            selectedIds={selectedIds}
          />
        ) : null}
        {isRecognizing ? (
          <View accessibilityLabel="문장을 읽고 있어요" accessibilityRole="progressbar" style={styles.state}>
            <ActivityIndicator color={mobileColors.accent} />
            <Text style={styles.stateText}>문장을 읽고 있어요</Text>
          </View>
        ) : null}
        {errorMessage ? (
          <RecoveryState
            actionLabel={isPhotoUnreadable ? '다른 사진 고르기' : '다시 시도'}
            isBusy={isRetrying}
            message={errorMessage}
            onPress={isPhotoUnreadable ? onPickAnotherPhoto : onRetry}
          />
        ) : null}
        {isEmptyResult ? (
          <RecoveryState actionLabel="다시 시도" isBusy={isRetrying} message={ocrEmptyResultMessage} onPress={onRetry} />
        ) : null}
        {lines.length > 0 ? (
          <LineToggleList
            lines={lines}
            onToggle={(lineId) => onChangeSelection(toggleLineId(selectedIds, lineId))}
            selectedIds={selectedIds}
          />
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        {summary.isOverLimit ? (
          <Text accessibilityRole="alert" style={styles.dangerText}>
            {ocrQuoteMaxLength}자까지 가져올 수 있어요.
          </Text>
        ) : null}
        <View style={styles.footerRow}>
          <Text accessibilityLiveRegion="polite" style={styles.summaryText}>
            {summary.lineCount}줄 · {summary.quoteLength}자
          </Text>
          <MobileButton
            isDisabled={summary.lineCount === 0 || summary.isOverLimit}
            label="다음"
            onPress={onNext}
            variant="primary"
          />
        </View>
      </View>
    </>
  )
}

/** 실패·빈 결과를 한 문장과 회복 행동 하나로 보여 준다. */
function RecoveryState({
  actionLabel,
  isBusy,
  message,
  onPress,
}: {
  actionLabel: string
  isBusy: boolean
  message: string
  onPress(): void
}): React.JSX.Element {
  return (
    <View style={styles.state}>
      <Text accessibilityRole="alert" style={styles.errorText}>
        {message}
      </Text>
      <MobileButton isLoading={isBusy} label={actionLabel} onPress={onPress} />
    </View>
  )
}

type PhotoLineOverlayProps = {
  lines: OcrLine[]
  onChangeSelection(ids: string[]): void
  photo: PreparedOcrPhoto
  selectedIds: string[]
}

/** 줄인 사진 위에 줄 박스를 겹쳐 그리고, 손가락 탭·끌기로 줄을 고르게 한다. */
function PhotoLineOverlay({ lines, onChangeSelection, photo, selectedIds }: PhotoLineOverlayProps): React.JSX.Element {
  const dragRef = useRef<DragState | null>(null)
  const [size, setSize] = useState<OverlaySize | null>(null)

  /** 사진 영역의 실제 화면 크기를 기억해 터치 좌표를 비율로 바꿀 수 있게 한다. */
  function handleLayout(event: LayoutChangeEvent): void {
    const { height, width } = event.nativeEvent.layout
    setSize({ height, width })
  }

  /** 터치 위치를 사진 비율 좌표로 바꿔 그 아래 줄을 찾는다. */
  function getLineAtTouch(event: GestureResponderEvent): OcrLine | null {
    if (!size || size.width === 0 || size.height === 0) return null
    const { locationX, locationY } = event.nativeEvent
    return findLineAtPoint(lines, locationX / size.width, locationY / size.height)
  }

  /** 누른 줄을 기준으로 선택(이미 고른 줄이면 해제) 끌기를 시작한다. */
  function handleGrant(event: GestureResponderEvent): void {
    const line = getLineAtTouch(event)
    if (!line) return
    const mode: LineRangeMode = selectedIds.includes(line.id) ? 'remove' : 'add'
    dragRef.current = { anchorId: line.id, baseIds: selectedIds, mode }
    onChangeSelection(applyLineRange(selectedIds, [line.id], mode))
  }

  /** 끄는 동안 시작 줄부터 현재 줄까지 연속 범위를 선택에 반영한다. */
  function handleMove(event: GestureResponderEvent): void {
    const drag = dragRef.current
    const line = drag ? getLineAtTouch(event) : null
    if (!drag || !line) return
    onChangeSelection(applyLineRange(drag.baseIds, getLineRangeIds(lines, drag.anchorId, line.id), drag.mode))
  }

  /** 끌기를 끝낸다. */
  function handleEnd(): void {
    dragRef.current = null
  }

  return (
    <View style={[styles.photoFrame, { aspectRatio: photo.width / photo.height }]}>
      <Image accessibilityIgnoresInvertColors accessibilityLabel="고른 책 페이지 사진" source={{ uri: photo.uri }} style={styles.photo} />
      <View
        onLayout={handleLayout}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleGrant}
        onResponderMove={handleMove}
        onResponderRelease={handleEnd}
        onResponderTerminate={handleEnd}
        onResponderTerminationRequest={() => false}
        onStartShouldSetResponder={() => true}
        style={StyleSheet.absoluteFill}
        testID="photo-quote-overlay"
      >
        {lines.map((line) => (
          <View
            key={line.id}
            pointerEvents="none"
            style={[
              styles.lineBox,
              selectedIds.includes(line.id) && styles.lineBoxSelected,
              {
                height: `${line.box.height * 100}%`,
                left: `${line.box.x * 100}%`,
                top: `${line.box.y * 100}%`,
                width: `${line.box.width * 100}%`,
              },
            ]}
          />
        ))}
      </View>
    </View>
  )
}

/** 사진 위 고르기를 먼저 안내하고, 인식한 줄 전체를 고를 수 있는 접힌 보조 목록을 표시한다. */
function LineToggleList({
  lines,
  onToggle,
  selectedIds,
}: {
  lines: OcrLine[]
  onToggle(lineId: string): void
  selectedIds: string[]
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <View accessibilityLabel="인식한 줄" style={styles.lineSection}>
      <Text style={styles.stateText}>사진 위 줄을 누르거나 끌어서 고르세요.</Text>
      <Pressable
        accessibilityLabel="줄 목록으로 고르기"
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onPress={() => setIsExpanded((value) => !value)}
        style={styles.listToggle}
      >
        <Text style={styles.listToggleText}>줄 목록으로 고르기</Text>
      </Pressable>
      {isExpanded
        ? lines.map((line) => {
            const isSelected = selectedIds.includes(line.id)
            return (
              <Pressable
                accessibilityLabel={line.text}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={line.id}
                onPress={() => onToggle(line.id)}
                style={[styles.lineRow, isSelected && styles.lineRowSelected]}
              >
                <Text style={[styles.lineRowText, isSelected && styles.lineRowTextSelected]}>{line.text}</Text>
              </Pressable>
            )
          })
        : null}
    </View>
  )
}

type ConfirmStepProps = {
  isKeepingLineBreaks: boolean
  isManual: boolean
  onChangePage(value: string): void
  onChangeQuote(value: string): void
  onInsert(): void
  onToggleLineBreaks(): void
  pageDraft: string
  quoteDraft: string
}

/** 인용 문장을 고치거나 직접 적고 쪽을 적은 뒤 입력창에 넣는 확인 화면을 표시한다. */
function ConfirmStep({
  isKeepingLineBreaks,
  isManual,
  onChangePage,
  onChangeQuote,
  onInsert,
  onToggleLineBreaks,
  pageDraft,
  quoteDraft,
}: ConfirmStepProps): React.JSX.Element {
  const quoteLength = quoteDraft.trim().length

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          accessibilityLabel="인용할 문장"
          autoFocus={isManual}
          multiline
          onChangeText={onChangeQuote}
          placeholder="책 속 문장을 적어 주세요"
          placeholderTextColor={mobileColors.inkSubtle}
          style={styles.quoteInput}
          value={quoteDraft}
        />
        <Text style={[styles.counterText, quoteLength > ocrQuoteMaxLength && styles.dangerText]}>
          {quoteLength}/{ocrQuoteMaxLength}
        </Text>
        <View style={styles.pageRow}>
          <Text style={styles.pageLabel}>쪽</Text>
          <TextInput
            accessibilityLabel="쪽 번호"
            keyboardType="number-pad"
            maxLength={10}
            onChangeText={onChangePage}
            placeholder="예: 87"
            placeholderTextColor={mobileColors.inkSubtle}
            style={styles.pageInput}
            value={pageDraft}
          />
        </View>
        {isManual ? null : (
          <>
            <Pressable
              accessibilityLabel="원문 줄바꿈 유지"
              accessibilityRole="switch"
              accessibilityState={{ checked: isKeepingLineBreaks }}
              onPress={onToggleLineBreaks}
              style={styles.listToggle}
            >
              <Text style={styles.listToggleText}>원문 줄바꿈 유지 {isKeepingLineBreaks ? '켬' : '끔'}</Text>
            </Pressable>
            <Text style={styles.stateText}>사진은 저장되지 않아요.</Text>
          </>
        )}
        <Text style={styles.noteText}>책 속 문장은 짧게 인용하고 내 생각을 함께 남겨 주세요.</Text>
      </ScrollView>
      <View style={styles.footer}>
        <MobileButton isDisabled={!isQuoteWithinLimit(quoteDraft)} label="글에 넣기" onPress={onInsert} variant="primary" />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', justifyContent: 'center', minHeight: mobileTouchTarget, minWidth: mobileTouchTarget },
  backButtonText: { color: mobileColors.ink, fontSize: 32, lineHeight: 36 },
  container: { backgroundColor: mobileColors.surface, flex: 1 },
  content: { gap: mobileSpacing.sm, padding: mobileSpacing.md },
  counterText: { alignSelf: 'flex-end', color: mobileColors.inkSubtle, fontSize: 12, lineHeight: 18 },
  dangerText: { color: mobileColors.danger, fontSize: 14, lineHeight: 20 },
  errorText: { color: mobileColors.danger, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  footer: {
    backgroundColor: mobileColors.surface,
    borderColor: mobileColors.border,
    borderTopWidth: 1,
    gap: mobileSpacing.xs,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
  },
  footerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: mobileColors.border,
    flexDirection: 'row',
    paddingHorizontal: mobileSpacing.xs,
  },
  headerSpacer: { minWidth: mobileTouchTarget },
  lineBox: {
    backgroundColor: mobileColors.lineOverlay,
    borderColor: mobileColors.lineOverlayBorder,
    borderRadius: 2,
    borderWidth: 1,
    position: 'absolute',
  },
  lineBoxSelected: { backgroundColor: mobileColors.lineOverlaySelected, borderColor: mobileColors.accent, borderWidth: 2 },
  lineRow: {
    borderBottomWidth: 1,
    borderColor: mobileColors.border,
    justifyContent: 'center',
    minHeight: mobileTouchTarget,
    paddingHorizontal: mobileSpacing.xs,
    paddingVertical: mobileSpacing.xs,
  },
  lineRowSelected: { backgroundColor: mobileColors.ink },
  lineRowText: { color: mobileColors.ink, fontSize: 14, lineHeight: 20 },
  lineRowTextSelected: { color: mobileColors.surface },
  lineSection: { gap: mobileSpacing.xs, marginTop: mobileSpacing.xs },
  listToggle: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: mobileTouchTarget },
  listToggleText: { color: mobileColors.ink, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  noteText: { color: mobileColors.inkSubtle, fontSize: 12, lineHeight: 18 },
  pageInput: {
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    color: mobileColors.ink,
    fontSize: 16,
    minHeight: mobileTouchTarget,
    paddingHorizontal: mobileSpacing.sm,
    width: 96,
  },
  pageLabel: { color: mobileColors.ink, fontSize: 14 },
  pageRow: { alignItems: 'center', flexDirection: 'row', gap: mobileSpacing.sm },
  photo: { height: '100%', width: '100%' },
  photoFrame: { alignSelf: 'center', maxWidth: '100%', width: '100%' },
  quoteInput: {
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    color: mobileColors.ink,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 160,
    padding: mobileSpacing.sm,
    textAlignVertical: 'top',
  },
  state: { alignItems: 'center', gap: mobileSpacing.sm, paddingVertical: mobileSpacing.lg },
  stateText: { color: mobileColors.inkSubtle, fontSize: 14, lineHeight: 20 },
  summaryText: { color: mobileColors.inkSubtle, fontSize: 14, fontVariant: ['tabular-nums'] },
  title: { color: mobileColors.ink, flex: 1, fontSize: 16, fontWeight: '600', textAlign: 'center' },
})
