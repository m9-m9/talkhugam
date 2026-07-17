import { useEffect, useId, useRef, useState } from 'react'

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
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!isOpen) return

    /** 외부 포인터 Down 요청이나 사용자 동작을 처리한다. */
    function handleOutsidePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (containerRef.current?.contains(event.target)) return
      setIsOpen(false)
    }

    /** Escape 키 요청이나 사용자 동작을 처리한다. */
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  /** Select 요청이나 사용자 동작을 처리한다. */
  function handleSelect(nextValue: string) {
    onChange(nextValue)
    setIsOpen(false)
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
        onClick={() => setIsOpen((open) => !open)}
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
          {options.map((option) => {
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
