import { useState, type ChangeEvent } from 'react'

import { ActionButton, TextField } from '@seed-design/react'

import type { BookRatingInput } from '../../entities/book-rating'
import { FormField } from '../../shared/ui/FormField'
import { StarIcon } from '../../shared/ui/StarIcon'

type RatingFormProps = {
  bookChatId: string
  initialRating: number | null
  initialReview: string | null
  isSaving: boolean
  onCancel: () => void
  onSave: (input: BookRatingInput) => void
  submitLabel: string
}

const STAR_VALUES = [1, 2, 3, 4, 5]

/** 별점과 총평을 입력받아 별점 저장 요청으로 변환하는 공용 폼을 렌더링한다. */
export function RatingForm({
  bookChatId,
  initialRating,
  initialReview,
  isSaving,
  onCancel,
  onSave,
  submitLabel,
}: RatingFormProps) {
  const [rating, setRating] = useState<number | null>(initialRating)
  const [review, setReview] = useState(initialReview ?? '')

  /** 선택한 별점 값을 현재 별점 작성 상태에 반영한다. */
  function handleSelectRating(value: number) {
    setRating(value)
  }

  /** 입력한 총평 문구를 현재 별점 작성 상태에 반영한다. */
  function handleChangeReview(event: ChangeEvent<HTMLTextAreaElement>) {
    setReview(event.target.value)
  }

  /** 별점이 선택된 경우에만 공백을 제거한 총평과 함께 저장 요청을 전달한다. */
  function handleSaveRating() {
    if (rating === null) return
    onSave({ bookChatId, rating, review: review.trim() || null })
  }

  return (
    <div className="mt-4">
      <p className="text-ink-subtle text-sm">별점은 꼭 골라 주세요. 총평은 선택이에요.</p>
      <fieldset className="mt-4">
        <legend className="text-ink text-sm font-medium">별점</legend>
        <div className="mt-2 flex gap-2">
          {STAR_VALUES.map((value) => (
            <button
              aria-label={`${value}점`}
              aria-pressed={rating === value}
              className={`bg-surface-raised flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border ${
                rating !== null && value <= rating
                  ? 'border-ink text-ink'
                  : 'border-border text-ink-subtle'
              }`}
              key={value}
              onClick={() => handleSelectRating(value)}
              type="button"
            >
              <StarIcon filled={rating !== null && value <= rating} />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-4">
        <FormField
          description="1,000자까지 적을 수 있어요."
          label="총평 (선택)"
          name="rating-review"
        >
          <TextField.Root>
            <TextField.Textarea
              autoresize={false}
              id="rating-review"
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
          disabled={isSaving || rating === null}
          loading={isSaving}
          onClick={handleSaveRating}
          type="button"
        >
          {submitLabel}
        </ActionButton>
      </div>
    </div>
  )
}
