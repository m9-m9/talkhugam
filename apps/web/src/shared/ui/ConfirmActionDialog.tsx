import { useEffect, useRef } from 'react'

import { trapDialogFocus } from './dialogFocus'

/** 되돌릴 수 있는 취소와 명시적 확인을 제공하는 공용 위험 작업 대화상자를 렌더링한다. */
export function ConfirmActionDialog({
  confirmLabel,
  description,
  isConfirming,
  onClose,
  onConfirm,
  title,
}: {
  confirmLabel: string
  description: string
  isConfirming: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
}) {
  const dialogRef = useRef<HTMLElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButtonRef.current?.focus()

    /** Escape와 Tab 키로 대화상자를 닫거나 포커스를 내부에 유지한다. */
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

  /** 배경을 눌렀을 때만 대화상자를 닫아 실수로 본문 조작이 취소되지 않게 한다. */
  function handleBackdropMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (event.currentTarget !== event.target) return
    event.preventDefault()
    onClose()
  }

  return (
    <div
      className="bg-ink/40 fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        aria-labelledby="confirm-action-dialog-heading"
        aria-modal="true"
        className="bg-surface w-full max-w-md rounded-lg p-6 shadow-xl"
        ref={dialogRef}
        role="dialog"
      >
        <p className="text-danger text-sm font-semibold">되돌릴 수 없는 작업</p>
        <h2 className="text-ink mt-2 text-xl font-bold" id="confirm-action-dialog-heading">
          {title}
        </h2>
        <p className="text-ink-subtle mt-3 text-sm">{description}</p>
        <div className="mt-6 flex gap-3">
          <button
            className="border-ink/10 text-ink min-h-11 flex-1 cursor-pointer rounded-md border bg-white px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isConfirming}
            onClick={onClose}
            ref={cancelButtonRef}
            type="button"
          >
            취소
          </button>
          <button
            className="bg-danger min-h-11 flex-1 cursor-pointer rounded-md px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isConfirming}
            onClick={onConfirm}
            type="button"
          >
            {isConfirming ? '삭제하고 있어요…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
