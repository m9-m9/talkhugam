import { ActionButton, SwipeableMenuSheet } from '@seed-design/react'
import { useRef, type ReactNode, type RefObject } from 'react'

/** 화면 하단에서 열리는 보조 작업을 SEED 스와이프 시트로 렌더링한다. */
export function BottomSheet({
  children,
  onClose,
  returnFocusRef,
  shouldRestoreFocus = () => true,
  title,
}: BottomSheetProps) {
  const triggerElementRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  )

  /** 시트를 닫은 뒤 Drawer 정리 이후에 원래 트리거로 키보드 포커스를 복귀한다. */
  function handleClose() {
    onClose()
    if (shouldRestoreFocus()) {
      const returnFocusTarget = returnFocusRef?.current ?? triggerElementRef.current
      window.setTimeout(() => returnFocusTarget?.focus(), 200)
    }
  }

  /** SEED 시트의 닫힘 요청을 부모가 관리하는 열린 상태에 반영한다. */
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) handleClose()
  }

  return (
    <SwipeableMenuSheet.Root
      closeOnEscape
      closeOnInteractOutside
      onOpenChange={handleOpenChange}
      open
    >
      <SwipeableMenuSheet.Positioner>
        <SwipeableMenuSheet.Backdrop data-testid="bottom-sheet-backdrop" />
        <SwipeableMenuSheet.Content className="talkhugam-bottom-sheet max-w-[640px]">
          <SwipeableMenuSheet.Handle />
          <SwipeableMenuSheet.Header className="relative">
            <SwipeableMenuSheet.Title>{title}</SwipeableMenuSheet.Title>
            <ActionButton
              aria-label={`${title} 닫기`}
              className="absolute top-0 right-0"
              onClick={handleClose}
              size="small"
              type="button"
              variant="ghost"
            >
              닫기
            </ActionButton>
          </SwipeableMenuSheet.Header>
          {children}
        </SwipeableMenuSheet.Content>
      </SwipeableMenuSheet.Positioner>
    </SwipeableMenuSheet.Root>
  )
}

type BottomSheetProps = {
  children: ReactNode
  onClose: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
  shouldRestoreFocus?: () => boolean
  title: string
}
