import { useState } from 'react'

import {
  parseFeedbackSubmission,
  submitFeedback,
  type FeedbackCategory,
} from '../../entities/feedback'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { trackAnalyticsEvent } from '../../shared/analytics'
import { BottomSheet } from '../../shared/ui/BottomSheet'
import { BrandSymbol } from '../../shared/ui/BrandSymbol'

const feedbackCategories: readonly { label: string; value: FeedbackCategory }[] = [
  { label: '불편한 점', value: 'issue' },
  { label: '기능 제안', value: 'feature' },
  { label: '기타', value: 'other' },
]

/** 앱 전역에서 이용자가 운영자에게 의견을 남길 수 있는 런처와 제출 시트를 렌더링한다. */
export function FeedbackLauncher() {
  const [isOpen, setIsOpen] = useState(false)
  const [category, setCategory] = useState<FeedbackCategory>('issue')
  const [body, setBody] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  /** 의견 시트를 닫되 입력 중인 내용은 다음 제출을 위해 유지한다. */
  function handleClose() {
    setIsOpen(false)
    setErrorMessage(null)
  }

  /** 의견 시트를 열고 마지막 제출 성공 안내는 새 입력 흐름을 위해 초기화한다. */
  function handleOpen() {
    setIsSubmitted(false)
    setIsOpen(true)
  }

  /** 선택한 의견 유형을 저장하고 이전 검증 오류는 제거한다. */
  function handleCategoryChange(nextCategory: FeedbackCategory) {
    setCategory(nextCategory)
    setErrorMessage(null)
  }

  /** 이용자 입력을 검증해 운영함에 제출하고 성공 여부를 화면에 반영한다. */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let values
    try {
      values = parseFeedbackSubmission({ body, category })
    } catch {
      setErrorMessage('의견 내용을 한 글자 이상 적어 주세요.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await submitFeedback(createSupabaseClient(), values)
      trackAnalyticsEvent('feedback_submitted')
      setBody('')
      setIsSubmitted(true)
    } catch {
      setErrorMessage('의견을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        aria-label="의견 보내기"
        className="bg-primary focus-visible:outline-primary fixed right-4 bottom-24 z-30 flex size-12 cursor-pointer items-center justify-center rounded-full shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={handleOpen}
        type="button"
      >
        <BrandSymbol alt="" className="size-7" tone="inverse" />
      </button>
      {isOpen ? (
        <BottomSheet onClose={handleClose} title="의견 보내기">
          {isSubmitted ? (
            <section className="pt-6 pb-2 text-center" aria-live="polite">
              <p className="text-ink text-lg font-bold">의견을 받았어요.</p>
              <p className="text-ink-subtle mt-2 text-sm leading-6">
                확인이 필요하면 로그인 이메일로 답변드릴게요.
              </p>
              <button
                className="bg-primary mt-6 min-h-11 w-full cursor-pointer rounded-md px-4 text-sm font-bold text-white"
                onClick={handleClose}
                type="button"
              >
                닫기
              </button>
            </section>
          ) : (
            <form className="pt-6" onSubmit={handleSubmit}>
              <fieldset>
                <legend className="text-ink text-sm font-semibold">어떤 의견인가요?</legend>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {feedbackCategories.map((item) => (
                    <button
                      aria-pressed={category === item.value}
                      className={`min-h-11 cursor-pointer rounded-md border px-2 text-sm font-semibold ${
                        category === item.value
                          ? 'border-primary bg-primary text-white'
                          : 'border-border text-ink bg-white'
                      }`}
                      key={item.value}
                      onClick={() => handleCategoryChange(item.value)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="text-ink mt-6 block text-sm font-semibold" htmlFor="feedback-body">
                의견 내용
              </label>
              <textarea
                className="border-border text-ink focus-visible:outline-primary mt-3 min-h-32 w-full resize-y rounded-md border bg-white p-3 text-sm leading-6 focus-visible:outline-2 focus-visible:outline-offset-2"
                id="feedback-body"
                maxLength={2000}
                onChange={(event) => setBody(event.target.value)}
                placeholder="불편했던 점이나 바라는 기능을 편하게 알려 주세요."
                value={body}
              />
              <p className="text-ink-subtle mt-2 text-xs leading-5">
                답변이 필요하면 로그인에 사용한 이메일로 연락드려요. 비밀번호·인증 코드는 적지
                마세요.
              </p>
              {errorMessage ? (
                <p className="text-danger mt-3 text-sm" role="alert">
                  {errorMessage}
                </p>
              ) : null}
              <button
                className="bg-primary mt-6 min-h-11 w-full cursor-pointer rounded-md px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? '보내고 있어요…' : '의견 보내기'}
              </button>
            </form>
          )}
        </BottomSheet>
      ) : null}
    </>
  )
}
