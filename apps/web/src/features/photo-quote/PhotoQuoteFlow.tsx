import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { ActionButton as SeedActionButton, TextField } from '@seed-design/react'
import {
  applyLineRange,
  findLineAtPoint,
  getLineRangeIds,
  getPhotoQuoteErrorMessage,
  getQuoteDrafts,
  isQuoteWithinLimit,
  ocrEmptyResultMessage,
  ocrQuoteMaxLength,
  recognizePagePhoto,
  splitOcrSentences,
  type LineRangeMode,
  type OcrLine,
  type OcrSentence,
} from '@talkhugam/domain'

import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { trapDialogFocus } from '../../shared/ui/dialogFocus'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'
import { isPhotoDecodeError, unsupportedPhotoFormatMessage } from './photoDecodeError'
import { resizePhotoForOcr } from './photoResize'

export type PhotoQuoteInsert = { page: string | null; quote: string }

type PhotoQuoteFlowProps = {
  bookChatId: string
  /** 문장을 읽을 책 페이지 사진. null이면 사진 없이 문장을 직접 입력하는 확인 화면만 연다. */
  file: File | null
  onClose: () => void
  onInsert: (value: PhotoQuoteInsert) => void
  /** 브라우저가 열 수 없는 사진일 때 흐름을 닫고 다른 사진을 다시 고르게 한다. */
  onPickAnotherPhoto?: () => void
}

type DragState = { anchorId: string; baseIds: string[]; mode: LineRangeMode }

/**
 * 확인 화면 문장이 어디서 왔는지. sentence는 문장 목록에서 고른 문장, aligned는 사진 위에서 고른 줄을
 * 문장 경계에 맞춘 문장, raw는 고른 줄 그대로, manual은 직접 입력이다.
 */
type QuoteSource = 'manual' | 'sentence' | 'aligned' | 'raw'

const titleId = 'photo-quote-title'

/** 사진 파일을 줄여 ocr-page 함수로 보내고 인식한 줄 목록을 반환한다. */
async function recognizePhotoFile(bookChatId: string, file: File): Promise<OcrLine[]> {
  const image = await resizePhotoForOcr(file)
  return recognizePagePhoto(createSupabaseClient(), bookChatId, image)
}

/** 사진 파일의 화면 표시용 object URL을 만들고 화면을 벗어나면 해제한다. 파일이 없으면 null을 반환한다. */
function usePhotoObjectUrl(file: File | null): string | null {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 자원 생성과 해제를 같은 effect에 묶는다.
    setPhotoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return photoUrl
}

/** 고른 문장이 있으면 그 문장, 없으면 문장 경계에 맞춘 문장(없으면 고른 줄 그대로)을 확인 화면 기본값으로 고른다. */
function getDefaultQuote(
  sentence: OcrSentence | undefined,
  lines: OcrLine[],
  selectedIds: string[],
): string {
  if (sentence) return sentence.text
  const drafts = getQuoteDrafts(lines, selectedIds)
  return drafts.alignedQuote ?? drafts.rawQuote
}

/**
 * 책 페이지 사진을 받아 인식 → 줄·문장 선택 → 문장 확인 단계를 전체 화면으로 보여 주고,
 * 사용자가 확인한 인용 문장과 쪽을 onInsert로 넘긴다. 사진이 없으면(직접 입력) 빈 확인 화면만 연다.
 * 사진과 인식 결과는 저장하지 않는다.
 */
export function PhotoQuoteFlow({
  bookChatId,
  file,
  onClose,
  onInsert,
  onPickAnotherPhoto,
}: PhotoQuoteFlowProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [requestKey] = useState(() => crypto.randomUUID())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(null)
  const isManual = file === null
  const [step, setStep] = useState<'select' | 'confirm'>(isManual ? 'confirm' : 'select')
  const [quoteSource, setQuoteSource] = useState<QuoteSource>(isManual ? 'manual' : 'raw')
  const [isKeepingLineBreaks, setIsKeepingLineBreaks] = useState(false)
  const [quoteDraft, setQuoteDraft] = useState('')
  const [pageDraft, setPageDraft] = useState('')
  const photoUrl = usePhotoObjectUrl(file)
  const recognitionQuery = useQuery({
    enabled: file !== null,
    gcTime: 0,
    queryFn: () => (file ? recognizePhotoFile(bookChatId, file) : Promise.resolve([])),
    queryKey: ['photo-quote', 'ocr-page', bookChatId, requestKey],
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: Infinity,
  })
  const lines = recognitionQuery.data ?? []
  const sentences = splitOcrSentences(lines)
  const selectedSentence = sentences.find((sentence) => sentence.id === selectedSentenceId)
  const hasAlignedOption = getQuoteDrafts(lines, selectedIds).alignedQuote !== null

  useEffect(() => {
    /** Escape로 흐름을 닫고 Tab 포커스를 화면 안에 가둔다. */
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'Tab') trapDialogFocus(event, dialogRef.current)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  /** 사진 위에서 줄을 고치면 문장 목록 선택을 풀고 줄 선택만 남긴다. */
  function handleChangeLineSelection(ids: string[]) {
    setSelectedIds(ids)
    setSelectedSentenceId(null)
  }

  /** 문장을 고르면 그 문장에 걸친 줄도 사진 위에 표시하고, 같은 문장을 다시 누르면 선택을 푼다. */
  function handleSelectSentence(sentence: OcrSentence) {
    const isSame = sentence.id === selectedSentenceId
    setSelectedSentenceId(isSame ? null : sentence.id)
    setSelectedIds(isSame ? [] : sentence.lineIds)
  }

  /** 고른 문장 또는 문장 경계에 맞춘 문장(없으면 고른 줄 그대로)으로 확인 화면을 연다. */
  function handleOpenConfirm() {
    const drafts = getQuoteDrafts(lines, selectedIds, { shouldKeepLineBreaks: isKeepingLineBreaks })
    if (selectedSentence) setQuoteSource('sentence')
    else setQuoteSource(drafts.alignedQuote ? 'aligned' : 'raw')
    setQuoteDraft(selectedSentence?.text ?? drafts.alignedQuote ?? drafts.rawQuote)
    setStep('confirm')
  }

  /** 문장 경계에 맞춘 문장과 고른 줄 그대로를 오가며 확인 화면 문장을 다시 만든다. */
  function handleToggleRawLines() {
    const drafts = getQuoteDrafts(lines, selectedIds, { shouldKeepLineBreaks: isKeepingLineBreaks })
    const nextSource: QuoteSource = quoteSource === 'raw' ? 'aligned' : 'raw'
    setQuoteSource(nextSource)
    setQuoteDraft(nextSource === 'raw' ? drafts.rawQuote : (drafts.alignedQuote ?? drafts.rawQuote))
  }

  /** 고른 줄 그대로일 때 원문 줄바꿈 유지 여부를 바꾸고 문장을 다시 만든다. */
  function handleToggleLineBreaks() {
    const nextValue = !isKeepingLineBreaks
    setIsKeepingLineBreaks(nextValue)
    setQuoteDraft(getQuoteDrafts(lines, selectedIds, { shouldKeepLineBreaks: nextValue }).rawQuote)
  }

  /** 확인한 문장과 쪽을 입력창에 넣도록 부모에 전달한다. */
  function handleInsert() {
    if (!isQuoteWithinLimit(quoteDraft)) return
    onInsert({ page: pageDraft.trim() || null, quote: quoteDraft.trim() })
  }

  /** 단계에 맞춰 이전 화면으로 돌아가거나 흐름을 닫는다. 직접 입력은 이전 단계가 없어 바로 닫는다. */
  function handleBack() {
    if (step === 'confirm' && !isManual) {
      setStep('select')
      return
    }
    onClose()
  }

  const title = getFlowTitle(step, isManual)

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="bg-surface text-ink fixed inset-0 z-50 overflow-y-auto"
      ref={dialogRef}
      role="dialog"
    >
      <div className="mx-auto flex min-h-dvh max-w-[640px] flex-col px-4">
        <span className="sr-only" id={titleId}>
          {title}
        </span>
        <AppHeader onBack={handleBack} title={title} />
        {step === 'select' ? (
          <SelectStep
            defaultQuote={getDefaultQuote(selectedSentence, lines, selectedIds)}
            errorMessage={
              recognitionQuery.isError ? getRecognitionErrorMessage(recognitionQuery.error) : null
            }
            isPhotoUnreadable={
              recognitionQuery.isError && isPhotoDecodeError(recognitionQuery.error)
            }
            isRecognizing={recognitionQuery.isPending}
            isRetrying={recognitionQuery.isFetching}
            lines={lines}
            onChangeSelection={handleChangeLineSelection}
            onNext={handleOpenConfirm}
            onPickAnotherPhoto={onPickAnotherPhoto ?? onClose}
            onRetry={() => void recognitionQuery.refetch()}
            onSelectSentence={handleSelectSentence}
            photoUrl={photoUrl}
            selectedIds={selectedIds}
            selectedSentenceId={selectedSentenceId}
            sentences={sentences}
          />
        ) : (
          <ConfirmStep
            hasAlignedOption={quoteSource !== 'sentence' && hasAlignedOption}
            isKeepingLineBreaks={isKeepingLineBreaks}
            onChangePage={setPageDraft}
            onChangeQuote={setQuoteDraft}
            onInsert={handleInsert}
            onToggleLineBreaks={handleToggleLineBreaks}
            onToggleRawLines={handleToggleRawLines}
            pageDraft={pageDraft}
            quoteDraft={quoteDraft}
            quoteSource={quoteSource}
          />
        )}
      </div>
    </div>
  )
}

/** 인식 실패 오류를 받아, 브라우저 사진 디코드 실패와 서버 인식 실패를 구분한 안내 문구를 반환한다. */
function getRecognitionErrorMessage(error: unknown): string {
  if (isPhotoDecodeError(error)) return unsupportedPhotoFormatMessage
  return getPhotoQuoteErrorMessage(error)
}

/** 현재 단계와 직접 입력 여부로 화면 제목을 고른다. */
function getFlowTitle(step: 'select' | 'confirm', isManual: boolean): string {
  if (isManual) return '문장 직접 입력'
  return step === 'select' ? '문장 고르기' : '가져올 문장 확인'
}

type SelectStepProps = {
  defaultQuote: string
  errorMessage: string | null
  isPhotoUnreadable: boolean
  isRecognizing: boolean
  isRetrying: boolean
  lines: OcrLine[]
  onChangeSelection: (ids: string[]) => void
  onNext: () => void
  onPickAnotherPhoto: () => void
  onRetry: () => void
  onSelectSentence: (sentence: OcrSentence) => void
  photoUrl: string | null
  selectedIds: string[]
  selectedSentenceId: string | null
  sentences: OcrSentence[]
}

/** 인식 상태에 맞춰 사진, 줄 박스, 문장 목록과 하단 선택 요약을 렌더링한다. 글자 수는 확인 화면에 넣을 문장 기준이다. */
function SelectStep({
  defaultQuote,
  errorMessage,
  isPhotoUnreadable,
  isRecognizing,
  isRetrying,
  lines,
  onChangeSelection,
  onNext,
  onPickAnotherPhoto,
  onRetry,
  onSelectSentence,
  photoUrl,
  selectedIds,
  selectedSentenceId,
  sentences,
}: SelectStepProps) {
  const quoteLength = defaultQuote.length
  const isOverLimit = quoteLength > ocrQuoteMaxLength
  const isEmptyResult = !isRecognizing && !errorMessage && lines.length === 0

  return (
    <>
      <div className="flex-1 py-4">
        <PhotoLineOverlay
          isDimmed={isRecognizing}
          lines={lines}
          onChangeSelection={onChangeSelection}
          photoUrl={isPhotoUnreadable ? null : photoUrl}
          selectedIds={selectedIds}
        />
        {isRecognizing ? (
          <div className="mt-4">
            <BookLoadingIndicator label="문장을 읽고 있어요" size="xs" />
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-6">
            <RetryState
              isRetrying={isRetrying}
              message={errorMessage}
              onRetry={isPhotoUnreadable ? onPickAnotherPhoto : onRetry}
              retryLabel={isPhotoUnreadable ? '다른 사진 고르기' : '다시 시도'}
            />
          </div>
        ) : null}
        {isEmptyResult ? (
          <p className="text-ink-subtle talkhugam-balanced-copy mt-6 text-center text-sm">
            {ocrEmptyResultMessage}
          </p>
        ) : null}
        {sentences.length > 0 ? (
          <SentencePicker
            onSelect={onSelectSentence}
            selectedSentenceId={selectedSentenceId}
            sentences={sentences}
          />
        ) : null}
      </div>
      <div className="border-border bg-surface sticky bottom-0 -mx-4 border-t px-4 py-3">
        {isOverLimit ? (
          <p className="text-danger mb-2 text-sm" role="alert">
            {ocrQuoteMaxLength}자까지 가져올 수 있어요.
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p aria-live="polite" className="text-ink-subtle text-sm tabular-nums">
            {selectedIds.length}줄 · {quoteLength}자
          </p>
          <SeedActionButton
            className="talkhugam-foundation-action--outline min-h-11"
            disabled={selectedIds.length === 0 || isOverLimit}
            onClick={onNext}
            size="medium"
            type="button"
            variant="neutralOutline"
          >
            다음
          </SeedActionButton>
        </div>
      </div>
    </>
  )
}

type PhotoLineOverlayProps = {
  isDimmed: boolean
  lines: OcrLine[]
  onChangeSelection: (ids: string[]) => void
  photoUrl: string | null
  selectedIds: string[]
}

/** 사진 위에 인식한 줄 박스를 겹쳐 그리고, 포인터 탭·끌기로 줄을 고르게 한다. */
function PhotoLineOverlay({
  isDimmed,
  lines,
  onChangeSelection,
  photoUrl,
  selectedIds,
}: PhotoLineOverlayProps) {
  const dragRef = useRef<DragState | null>(null)
  const [brokenPhotoUrl, setBrokenPhotoUrl] = useState<string | null>(null)

  /** 포인터 위치를 사진 비율 좌표로 바꿔 그 아래 줄을 찾는다. */
  function getLineAtPointer(event: ReactPointerEvent<HTMLDivElement>): OcrLine | null {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    return findLineAtPoint(
      lines,
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    )
  }

  /** 누른 줄을 기준으로 선택(이미 고른 줄이면 해제) 끌기를 시작한다. */
  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const line = getLineAtPointer(event)
    if (!line) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const mode: LineRangeMode = selectedIds.includes(line.id) ? 'remove' : 'add'
    dragRef.current = { anchorId: line.id, baseIds: selectedIds, mode }
    onChangeSelection(applyLineRange(selectedIds, [line.id], mode))
  }

  /** 끄는 동안 시작 줄부터 현재 줄까지 연속 범위를 선택에 반영한다. */
  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const line = drag ? getLineAtPointer(event) : null
    if (!drag || !line) return
    const rangeIds = getLineRangeIds(lines, drag.anchorId, line.id)
    onChangeSelection(applyLineRange(drag.baseIds, rangeIds, drag.mode))
  }

  /** 끌기를 끝낸다. */
  function handlePointerEnd() {
    dragRef.current = null
  }

  if (!photoUrl || brokenPhotoUrl === photoUrl) return null

  return (
    <div className="relative mx-auto w-fit">
      <img
        alt="고른 책 페이지 사진"
        className={`block max-h-[70dvh] w-auto max-w-full select-none ${isDimmed ? 'opacity-40 blur-sm' : ''}`}
        draggable={false}
        onError={() => setBrokenPhotoUrl(photoUrl)}
        src={photoUrl}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 touch-none"
        data-testid="photo-quote-overlay"
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
      >
        {lines.map((line) => (
          <span
            className={`pointer-events-none absolute rounded-sm ${
              selectedIds.includes(line.id)
                ? 'bg-accent/35 ring-accent ring-2'
                : 'bg-surface/5 ring-surface/50 ring-1'
            }`}
            key={line.id}
            style={{
              height: `${line.box.height * 100}%`,
              left: `${line.box.x * 100}%`,
              top: `${line.box.y * 100}%`,
              width: `${line.box.width * 100}%`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * 사진 위 탭·끌기를 주 방식으로 안내하고, 본문 줄을 이어 붙여 나눈 문장 목록을 보조로 보여 준다.
 * 문장을 누르면 그 문장만 고르고, 걸친 줄은 사진 위에도 표시된다. 목록은 기본으로 접어 둔다.
 */
function SentencePicker({
  onSelect,
  selectedSentenceId,
  sentences,
}: {
  onSelect: (sentence: OcrSentence) => void
  selectedSentenceId: string | null
  sentences: OcrSentence[]
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <section aria-label="문장 목록" className="mt-4">
      <p className="text-ink-subtle talkhugam-balanced-copy text-sm">
        사진 위 줄을 누르거나 끌어서 고르세요.
      </p>
      <SeedActionButton
        aria-controls="photo-quote-sentence-list"
        aria-expanded={isExpanded}
        className="mt-3 min-h-11"
        onClick={() => setIsExpanded((value) => !value)}
        size="medium"
        type="button"
        variant="ghost"
      >
        문장으로 고르기
      </SeedActionButton>
      {isExpanded ? (
        <ul className="border-border mt-2 border-t" id="photo-quote-sentence-list">
          {sentences.map((sentence) => {
            const isSelected = sentence.id === selectedSentenceId
            return (
              <li className="border-border border-b" key={sentence.id}>
                <button
                  aria-pressed={isSelected}
                  className={`min-h-11 w-full px-2 py-2 text-left text-sm ${
                    isSelected ? 'bg-ink text-surface' : 'text-ink'
                  }`}
                  onClick={() => onSelect(sentence)}
                  type="button"
                >
                  {sentence.text}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

type ConfirmStepProps = {
  hasAlignedOption: boolean
  isKeepingLineBreaks: boolean
  onChangePage: (value: string) => void
  onChangeQuote: (value: string) => void
  onInsert: () => void
  onToggleLineBreaks: () => void
  onToggleRawLines: () => void
  pageDraft: string
  quoteDraft: string
  quoteSource: QuoteSource
}

/**
 * 인용 문장을 고치거나 직접 적고 쪽을 적은 뒤 입력창에 넣는 확인 화면을 렌더링한다. 사진 위에서 줄로 고른 경우
 * 문장 경계에 맞춘 문장을 기본으로 보여 주고 "고른 줄 그대로"로 바꿀 수 있다. 사진 전용 안내는 사진 흐름에서만 보인다.
 */
function ConfirmStep({
  hasAlignedOption,
  isKeepingLineBreaks,
  onChangePage,
  onChangeQuote,
  onInsert,
  onToggleLineBreaks,
  onToggleRawLines,
  pageDraft,
  quoteDraft,
  quoteSource,
}: ConfirmStepProps) {
  const quoteLength = quoteDraft.trim().length
  const isManual = quoteSource === 'manual'

  return (
    <>
      <div className="flex-1 space-y-4 py-4">
        <div>
          <TextField.Root className="talkhugam-information-field">
            <TextField.Textarea
              aria-label="인용할 문장"
              autoFocus={isManual}
              className="min-h-40 text-base"
              onChange={(event) => onChangeQuote(event.target.value)}
              value={quoteDraft}
            />
          </TextField.Root>
          <p
            className={`mt-1 text-right text-xs tabular-nums ${quoteLength > ocrQuoteMaxLength ? 'text-danger' : 'text-ink-subtle'}`}
          >
            {quoteLength}/{ocrQuoteMaxLength}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-ink text-sm" htmlFor="photo-quote-page">
            쪽
          </label>
          <TextField.Root className="talkhugam-information-field w-24">
            <TextField.Input
              aria-label="쪽 번호"
              id="photo-quote-page"
              inputMode="numeric"
              maxLength={10}
              onChange={(event) => onChangePage(event.target.value)}
              placeholder="예: 87"
              value={pageDraft}
            />
          </TextField.Root>
        </div>
        {isManual ? null : (
          <div className="flex flex-col items-start gap-3">
            {quoteSource === 'aligned' ? (
              <p className="text-ink-subtle talkhugam-balanced-copy text-sm">
                앞뒤 잘린 문장 조각은 뺐어요.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {hasAlignedOption ? (
                <SeedActionButton
                  aria-pressed={quoteSource === 'raw'}
                  className="talkhugam-foundation-toggle min-h-11"
                  onClick={onToggleRawLines}
                  size="medium"
                  type="button"
                  variant="neutralOutline"
                >
                  고른 줄 그대로
                </SeedActionButton>
              ) : null}
              {quoteSource === 'raw' ? (
                <SeedActionButton
                  aria-pressed={isKeepingLineBreaks}
                  className="talkhugam-foundation-toggle min-h-11"
                  onClick={onToggleLineBreaks}
                  size="medium"
                  type="button"
                  variant="neutralOutline"
                >
                  원문 줄바꿈 유지
                </SeedActionButton>
              ) : null}
            </div>
            <p className="text-ink-subtle talkhugam-balanced-copy text-sm">
              사진은 저장되지 않아요.
            </p>
          </div>
        )}
        <p className="text-ink-subtle talkhugam-balanced-copy text-xs">
          책 속 문장은 짧게 인용하고 내 생각을 함께 남겨 주세요.
        </p>
      </div>
      <div className="border-border bg-surface sticky bottom-0 -mx-4 border-t px-4 py-3">
        <SeedActionButton
          className="talkhugam-foundation-action--outline min-h-11 w-full"
          disabled={!isQuoteWithinLimit(quoteDraft)}
          onClick={onInsert}
          size="medium"
          type="button"
          variant="neutralOutline"
        >
          글에 넣기
        </SeedActionButton>
      </div>
    </>
  )
}
