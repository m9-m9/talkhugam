import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { describe, expect, it, jest } from '@jest/globals'

import { LegalConsentScreen } from '../src/features/legal/LegalConsentScreen'

describe('LegalConsentScreen', () => {
  it('requires every mandatory document before saving consent', async () => {
    const onSubmit = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    render(<LegalConsentScreen onSubmit={onSubmit} />)

    const submitButton = screen.getByRole('button', { name: '동의하고 계속하기' })
    expect(submitButton).toBeDisabled()

    fireEvent.press(screen.getByRole('checkbox', { name: '이용약관에 동의합니다.' }))
    expect(submitButton).toBeDisabled()

    fireEvent.press(screen.getByRole('checkbox', { name: '개인정보처리방침에 동의합니다.' }))
    fireEvent.press(submitButton)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  })

  it('keeps consent choices selected when saving fails', async () => {
    const onSubmit = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('rpc'))
    render(<LegalConsentScreen onSubmit={onSubmit} />)

    fireEvent.press(screen.getByRole('checkbox', { name: '이용약관에 동의합니다.' }))
    fireEvent.press(screen.getByRole('checkbox', { name: '개인정보처리방침에 동의합니다.' }))
    fireEvent.press(screen.getByRole('button', { name: '동의하고 계속하기' }))

    expect(
      await screen.findByRole('alert', {
        name: '동의를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
      }),
    ).toBeVisible()
    expect(screen.getByRole('checkbox', { name: '이용약관에 동의합니다.' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '개인정보처리방침에 동의합니다.' })).toBeChecked()
  })
})
