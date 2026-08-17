import { useState, type ChangeEvent } from 'react'

import { ActionButton, TextField } from '@seed-design/react'

import type { BookCompletionInput } from '../../entities/book-completion'
import { FormField } from '../../shared/ui/FormField'

type CompletionReviewFormProps = {
  bookChatId: string
  initialRating: number | null
  initialReview: string | null
  isSaving: boolean
  onCancel: () => void
  onSave: (input: BookCompletionInput) => void
  submitLabel: string
}

/** 별점과 총평을 입력받아 완독 기록 저장 요청으로 변환하는 공용 폼을 렌더링한다. */
export function CompletionReviewForm({
  bookChatId,
  initialRating,
  initialReview,
  isSaving,
  onCancel,
  onSave,
  submitLabel,
}: CompletionReviewFormProps) {
  const [rating, setRating] = useState<number | null>(initialRating)
  const [review, setReview] = useState(initialReview ?? '')

  /** 선택한 별점 값을 현재 완독 기록 작성 상태에 반영한다. */
  function handleSelectRating(value: number) {
    setRating(value)
  }

  /** 입력한 총평 문구를 현재 완독 기록 작성 상태에 반영한다. */
  function handleChangeReview(event: ChangeEvent<HTMLTextAreaElement>) {
    setReview(event.target.value)
  }

  /** 작성 중인 별점과 총평을 검증된 완독 기록 저장 요청으로 전달한다. */
  function handleSaveReview() {
    onSave({
      bookChatId,
      rating,
      review: review || null,
    })
  }

  return (
    <div className="mt-4">
      <p className="text-ink-subtle text-sm">완독일은 오늘로 기록돼요. 별점과 총평은 선택이에요.</p>
      <fieldset className="mt-4">
        <legend className="text-ink text-sm font-medium">별점 (선택)</legend>
        <div className="mt-2 flex gap-2" role="group" aria-label="별점 선택">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              aria-label={`${value}점`}
              aria-pressed={rating === value}
              className={`min-h-11 min-w-11 cursor-pointer rounded-md text-lg font-bold ${
                rating !== null && value <= rating
                  ? 'border-primary text-primary border bg-white'
                  : 'border-border text-ink-subtle border bg-white'
              }`}
              key={value}
              onClick={() => handleSelectRating(value)}
              type="button"
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-4">
        <FormField label="총평 (선택)" name="completion-review">
          <TextField.Root>
            <TextField.Textarea
              autoresize={false}
              id="completion-review"
              maxLength={1000}
              onChange={handleChangeReview}
              placeholder="이 책을 읽고 남은 생각을 적어 보세요."
              value={review}
            />
          </TextField.Root>
        </FormField>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <ActionButton disabled={isSaving} onClick={onCancel} type="button" variant="neutralOutline">
          취소
        </ActionButton>
        <ActionButton
          className="talkhugam-primary-action"
          disabled={isSaving}
          loading={isSaving}
          onClick={handleSaveReview}
          type="button"
        >
          {submitLabel}
        </ActionButton>
      </div>
    </div>
  )
}
