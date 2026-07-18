import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'

import { trapDialogFocus } from './dialogFocus'

/** 화면 하단에서 열리는 보조 작업용 공용 시트를 렌더링한다. */
export function BottomSheet({ children, onClose, title }: BottomSheetProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()

    /** Escape로 시트를 닫고 Tab 포커스가 시트 바깥으로 이동하지 않게 한다. */
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

  /** 시트 밖 배경을 눌렀을 때만 현재 보조 작업을 닫는다. */
  function handleBackdropPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label={`${title} 창 닫기`}
        className="bg-ink/40 absolute inset-0 cursor-default"
        onPointerDown={handleBackdropPointerDown}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby="bottom-sheet-heading"
        aria-modal="true"
        className="bg-surface relative max-h-[80dvh] w-full max-w-[640px] overflow-y-auto rounded-t-lg p-6 shadow-xl"
        ref={dialogRef}
        role="dialog"
      >
        <div aria-hidden="true" className="bg-ink/20 mx-auto h-1 w-12 rounded-full" />
        <div className="mt-4 flex items-start justify-between gap-4">
          <h2 className="text-ink text-xl font-bold" id="bottom-sheet-heading">
            {title}
          </h2>
          <button
            aria-label={`${title} 닫기`}
            className="text-ink hover:bg-surface-muted flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md text-2xl"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

type BottomSheetProps = {
  children: ReactNode
  onClose: () => void
  title: string
}
