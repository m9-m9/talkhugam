import { useCallback, useEffect, useId, useRef, useState } from 'react'

export type SelectMenuOption = {
  badge?: string
  label: string
  value: string
}

type SelectMenuProps = {
  disabled?: boolean
  label: string
  menuTitle?: string
  onChange: (value: string) => void
  options: readonly SelectMenuOption[]
  value: string
}

/** Select 메뉴 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function SelectMenu({
  disabled = false,
  label,
  menuTitle,
  onChange,
  options,
  value,
}: SelectMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef(new Map<string, HTMLButtonElement>())
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  /** 열린 선택 메뉴를 닫고 메뉴를 연 트리거에 키보드 포커스를 복귀시킨다. */
  const closeMenuAndRestoreFocus = useCallback(() => {
    setIsOpen(false)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!isOpen) return
    optionRefs.current.get(selectedOption?.value ?? '')?.focus()
  }, [isOpen, selectedOption?.value])

  useEffect(() => {
    if (!isOpen) return

    /** 외부 포인터 Down 요청이나 사용자 동작을 처리한다. */
    function handleOutsidePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (containerRef.current?.contains(event.target)) return
      closeMenuAndRestoreFocus()
    }

    /** Escape 키 요청이나 사용자 동작을 처리한다. */
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeMenuAndRestoreFocus()
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [closeMenuAndRestoreFocus, isOpen])

  /** Select 요청이나 사용자 동작을 처리한다. */
  function handleSelect(nextValue: string) {
    onChange(nextValue)
    closeMenuAndRestoreFocus()
  }

  /** 선택 메뉴 트리거의 클릭으로 펼침 상태를 전환한다. */
  function handleToggleMenu() {
    setIsOpen((open) => !open)
  }

  /** 트리거의 화살표 키 입력으로 선택 메뉴를 열고 현재 항목에 포커스를 둔다. */
  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    setIsOpen(true)
  }

  /** 옵션 요소 참조를 값별로 저장하거나 해제해 키보드 이동에 사용한다. */
  function handleOptionRef(value: string, element: HTMLButtonElement | null) {
    if (!element) {
      optionRefs.current.delete(value)
      return
    }
    optionRefs.current.set(value, element)
  }

  /** 현재 옵션 위치를 기준으로 다음 키보드 포커스 대상에 이동한다. */
  function focusOptionAt(index: number) {
    const optionValue = options[index]?.value
    if (!optionValue) return
    optionRefs.current.get(optionValue)?.focus()
  }

  /** 옵션 키보드 입력으로 항목 이동, 선택 또는 메뉴 닫기를 처리한다. */
  function handleOptionKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    option: SelectMenuOption,
    optionIndex: number,
  ) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusOptionAt((optionIndex + 1) % options.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusOptionAt((optionIndex - 1 + options.length) % options.length)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      focusOptionAt(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      focusOptionAt(options.length - 1)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleSelect(option.value)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenuAndRestoreFocus()
    }
  }

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`${label}: ${selectedOption?.label ?? ''}`}
        className="border-ink/20 bg-surface text-ink hover:border-primary/60 focus-visible:ring-primary flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={handleToggleMenu}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
      >
        <span className="max-w-24 truncate">{selectedOption?.label}</span>
        <ChevronIcon isOpen={isOpen} />
      </button>
      {isOpen ? (
        <div
          aria-label={label}
          className="border-ink/15 bg-surface absolute top-full right-0 z-30 mt-2 w-52 rounded-lg border p-2 shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {menuTitle ? (
            <p className="text-ink-subtle px-2 pt-1 pb-2 text-xs font-semibold">{menuTitle}</p>
          ) : null}
          {options.map((option, optionIndex) => {
            const isSelected = option.value === value
            return (
              <button
                aria-selected={isSelected}
                className={`focus-visible:ring-primary flex min-h-11 w-full cursor-pointer items-center justify-between rounded-md px-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  isSelected
                    ? 'bg-primary/15 text-ink font-semibold'
                    : 'text-ink-subtle hover:bg-surface-muted'
                }`}
                key={option.value}
                onClick={() => handleSelect(option.value)}
                onKeyDown={(event) => handleOptionKeyDown(event, option, optionIndex)}
                ref={(element) => handleOptionRef(option.value, element)}
                role="option"
                type="button"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {option.badge ? (
                    <span
                      aria-hidden="true"
                      className="bg-surface-muted text-ink-subtle flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    >
                      {option.badge}
                    </span>
                  ) : null}
                  <span className="truncate">{option.label}</span>
                </span>
                {isSelected ? <CheckIcon /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/** 펼침 표시 아이콘 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path d="m7 9 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

/** 선택 표시 아이콘 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="text-primary size-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}
