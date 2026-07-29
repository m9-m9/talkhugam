import { useEffect, useRef } from 'react'
import { ActionButton, Dialog } from '@seed-design/react'

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
  const dialogRef = useRef<HTMLDivElement>(null)
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

  /** SEED 대화상자가 닫힘을 요청했을 때 진행 중이 아닌 경우에만 부모 상태를 갱신한다. */
  function handleOpenChange(open: boolean) {
    if (open || isConfirming) return
    onClose()
  }

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open>
      <Dialog.Positioner onMouseDown={handleBackdropMouseDown}>
        <Dialog.Backdrop />
        <Dialog.Content ref={dialogRef}>
          <Dialog.Header>
            <p className="text-danger text-sm font-semibold">되돌릴 수 없는 작업</p>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>{description}</Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer className="talkhugam-dialog-actions">
            <ActionButton
              disabled={isConfirming}
              onClick={onClose}
              ref={cancelButtonRef}
              size="large"
              type="button"
              variant="neutralOutline"
            >
              취소
            </ActionButton>
            <ActionButton
              disabled={isConfirming}
              loading={isConfirming}
              onClick={onConfirm}
              size="large"
              type="button"
              variant="criticalSolid"
            >
              {confirmLabel}
            </ActionButton>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
