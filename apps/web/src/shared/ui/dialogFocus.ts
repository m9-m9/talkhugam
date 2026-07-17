/** 대화상자 안에서 Tab 키가 첫·마지막 조작 요소를 벗어나지 않도록 순환시킨다. */
export function trapDialogFocus(event: KeyboardEvent, dialog: HTMLElement | null) {
  if (!dialog) return
  const focusableElements = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
  const firstElement = focusableElements[0]
  const lastElement = focusableElements.at(-1)
  if (!firstElement || !lastElement) return

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
    return
  }
  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}
