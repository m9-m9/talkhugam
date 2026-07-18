import { useState, type ChangeEvent, type FormEvent } from 'react'

import type { ReadingProgressInput } from '../../entities/reading-progress'

type ReadingProgressFormProps = {
  bookChatId: string
  initialCurrentPage: number | null
  initialTotalPages: number | null
  isSaving: boolean
  onCancel: () => void
  onSave: (input: ReadingProgressInput) => void
}

/** 현재 읽은 페이지와 전체 페이지를 입력받아 개인 진행률 저장 요청으로 전달한다. */
export function ReadingProgressForm({
  bookChatId,
  initialCurrentPage,
  initialTotalPages,
  isSaving,
  onCancel,
  onSave,
}: ReadingProgressFormProps) {
  const [currentPage, setCurrentPage] = useState(String(initialCurrentPage ?? ''))
  const [totalPages, setTotalPages] = useState(String(initialTotalPages ?? ''))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  /** 입력 이벤트에서 숫자 필드 값을 독립적으로 갱신하고 오류 안내를 지운다. */
  function handleChangeCurrentPage(event: ChangeEvent<HTMLInputElement>) {
    setCurrentPage(event.target.value)
    setErrorMessage(null)
  }

  /** 전체 페이지 입력값을 갱신하고 기존 검증 오류를 지운다. */
  function handleChangeTotalPages(event: ChangeEvent<HTMLInputElement>) {
    setTotalPages(event.target.value)
    setErrorMessage(null)
  }

  /** 입력값이 유효한 페이지 범위인지 검증한 뒤 저장 요청으로 전달한다. */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedCurrentPage = Number(currentPage)
    const parsedTotalPages = Number(totalPages)
    if (!Number.isInteger(parsedCurrentPage) || !Number.isInteger(parsedTotalPages)) {
      setErrorMessage('현재 페이지와 전체 페이지를 숫자로 입력해 주세요.')
      return
    }
    if (parsedCurrentPage < 0 || parsedTotalPages <= 0 || parsedCurrentPage > parsedTotalPages) {
      setErrorMessage('현재 페이지는 0 이상, 전체 페이지 이하로 입력해 주세요.')
      return
    }
    onSave({ bookChatId, currentPage: parsedCurrentPage, totalPages: parsedTotalPages })
  }

  return (
    <form className="mt-4" onSubmit={handleSubmit}>
      <p className="text-ink-subtle text-sm">읽은 페이지를 남기면 내 진행률에만 반영돼요.</p>
      <label className="text-ink mt-4 block text-sm font-medium" htmlFor="current-reading-page">
        현재 읽은 페이지
      </label>
      <input
        className="border-ink/10 focus:border-primary mt-2 min-h-11 w-full rounded-md border px-3 text-sm outline-none"
        id="current-reading-page"
        inputMode="numeric"
        min="0"
        name="currentPage"
        onChange={handleChangeCurrentPage}
        type="number"
        value={currentPage}
      />
      <label className="text-ink mt-4 block text-sm font-medium" htmlFor="total-reading-pages">
        전체 페이지
      </label>
      <input
        className="border-ink/10 focus:border-primary mt-2 min-h-11 w-full rounded-md border px-3 text-sm outline-none"
        id="total-reading-pages"
        inputMode="numeric"
        min="1"
        name="totalPages"
        onChange={handleChangeTotalPages}
        type="number"
        value={totalPages}
      />
      {errorMessage ? (
        <p className="text-danger mt-2 text-sm" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="border-ink/10 text-ink min-h-11 cursor-pointer rounded-md border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          disabled={isSaving}
          onClick={onCancel}
          type="button"
        >
          취소
        </button>
        <button
          className="bg-primary min-h-11 cursor-pointer rounded-md px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={isSaving}
          type="submit"
        >
          진행률 저장
        </button>
      </div>
    </form>
  )
}
