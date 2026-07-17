import { useEffect, useId, useRef, useState } from 'react'

export type SelectMenuOption = {
  label: string
  value: string
}

type SelectMenuProps = {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  options: readonly SelectMenuOption[]
  value: string
}

export function SelectMenu({ disabled = false, label, onChange, options, value }: SelectMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!isOpen) return

    function handleOutsidePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (containerRef.current?.contains(event.target)) return
      setIsOpen(false)
    }

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
          className="border-ink/15 bg-surface absolute top-full right-0 z-30 mt-2 min-w-full overflow-hidden rounded-lg border p-1 shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                aria-selected={isSelected}
                className={`focus-visible:ring-primary flex min-h-11 w-full cursor-pointer items-center justify-between rounded-md px-3 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  isSelected
                    ? 'bg-primary/15 text-ink font-semibold'
                    : 'text-ink-subtle hover:bg-surface-muted'
                }`}
                key={option.value}
                onClick={() => handleSelect(option.value)}
                role="option"
                type="button"
              >
                {option.label}
                {isSelected ? <CheckIcon /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

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
