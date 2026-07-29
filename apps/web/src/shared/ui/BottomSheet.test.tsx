import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BottomSheet } from './BottomSheet'

describe('BottomSheet', () => {
  afterEach(cleanup)

  it('closes from the SEED close action and restores focus to the sheet trigger', async () => {
    render(<BottomSheetHarness />)

    const trigger = screen.getByRole('button', { name: '완독 기록 열기' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog', { name: '완독 기록' })).toHaveClass(
      'seed-menu-sheet__content',
    )
    expect(screen.getByRole('dialog', { name: '완독 기록' })).toHaveClass('talkhugam-bottom-sheet')
    fireEvent.click(screen.getByRole('button', { name: '완독 기록 닫기' }))

    expect(screen.queryByRole('dialog', { name: '완독 기록' })).not.toBeInTheDocument()
    await vi.waitFor(() => expect(trigger).toHaveFocus())
  })

  it('renders the SEED backdrop for outside dismissal', () => {
    render(<BottomSheetHarness />)

    fireEvent.click(screen.getByRole('button', { name: '완독 기록 열기' }))
    expect(screen.getByTestId('bottom-sheet-backdrop')).toHaveClass('seed-menu-sheet__backdrop')
  })
})

/** 공용 하단 시트의 닫힘과 포커스 복귀 동작을 검증하는 화면을 렌더링한다. */
function BottomSheetHarness() {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  /** 하단 시트를 닫고 시트를 연 버튼으로 포커스를 복귀한다. */
  function handleClose() {
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} ref={triggerRef} type="button">
        완독 기록 열기
      </button>
      {isOpen ? (
        <BottomSheet onClose={handleClose} title="완독 기록">
          <p>별점과 총평은 선택이에요.</p>
        </BottomSheet>
      ) : null}
    </>
  )
}
