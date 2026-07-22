import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InviteShareSheet } from './InviteShareSheet'

describe('InviteShareSheet', () => {
  afterEach(cleanup)

  it('offers the four invitation platforms and a separate link copy action', () => {
    render(<InviteShareSheetHarness />)

    fireEvent.click(screen.getByRole('button', { name: '초대 시트 열기' }))

    expect(screen.getByRole('button', { name: '카카오톡으로 초대 보내기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '문자로 초대 보내기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '인스타그램으로 초대 보내기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '페이스북으로 초대 보내기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '초대 링크와 코드 복사' })).toBeInTheDocument()
  })

  it('passes the chosen platform back to the sharing boundary', () => {
    const onShare = vi.fn()
    render(<InviteShareSheet onClose={vi.fn()} onCopyInvite={vi.fn()} onShare={onShare} />)

    fireEvent.click(screen.getByRole('button', { name: '카카오톡으로 초대 보내기' }))

    expect(onShare).toHaveBeenCalledWith('kakao')
  })

  it('closes with Escape and returns focus to the sheet trigger', () => {
    render(<InviteShareSheetHarness />)

    const trigger = screen.getByRole('button', { name: '초대 시트 열기' })
    fireEvent.click(trigger)
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: '책방 초대하기' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})

/** 초대 시트의 접근성과 닫힘 동작을 확인하는 상태 기반 테스트 화면을 렌더링한다. */
function InviteShareSheetHarness() {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  /** 초대 시트를 닫고 이를 연 버튼으로 키보드 포커스를 되돌린다. */
  function handleClose() {
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} ref={triggerRef} type="button">
        초대 시트 열기
      </button>
      {isOpen ? (
        <InviteShareSheet onClose={handleClose} onCopyInvite={vi.fn()} onShare={vi.fn()} />
      ) : null}
    </>
  )
}
