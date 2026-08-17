import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FeedbackLauncher } from './FeedbackLauncher'

const { submitFeedback } = vi.hoisted(() => ({ submitFeedback: vi.fn() }))

vi.mock('../../entities/feedback', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../entities/feedback')>()),
  submitFeedback,
}))
vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: vi.fn() }))
vi.mock('../../shared/analytics', () => ({ trackAnalyticsEvent: vi.fn() }))

describe('FeedbackLauncher', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('submits a feature suggestion and confirms that it was received', async () => {
    submitFeedback.mockResolvedValue('ticket-1')
    render(<FeedbackLauncher />)

    fireEvent.click(screen.getByRole('button', { name: '의견 보내기' }))
    fireEvent.click(screen.getByRole('button', { name: '기능 제안' }))
    fireEvent.change(screen.getByLabelText('의견 내용'), {
      target: { value: '독서방 알림을 더 세밀하게 바꾸고 싶어요.' },
    })
    const submitButton = within(screen.getByRole('dialog', { name: '의견 보내기' })).getByRole(
      'button',
      { name: '의견 보내기' },
    )
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(submitFeedback).toHaveBeenCalledWith(undefined, {
        body: '독서방 알림을 더 세밀하게 바꾸고 싶어요.',
        category: 'feature',
      })
    })
    expect(await screen.findByText('의견을 받았어요.')).toBeInTheDocument()
  })

  it('uses SEED controls for the launcher, category toggle, text field, and submit action', () => {
    render(<FeedbackLauncher />)

    expect(screen.getByRole('button', { name: '의견 보내기' })).toHaveClass('seed-action-button')
    fireEvent.click(screen.getByRole('button', { name: '의견 보내기' }))

    expect(screen.getByRole('button', { name: '기능 제안' })).toHaveClass('seed-toggle-button')
    expect(screen.getByRole('textbox', { name: '의견 내용' })).toHaveClass('seed-text-input__value')
    expect(
      within(screen.getByRole('dialog', { name: '의견 보내기' })).getByRole('button', {
        name: '의견 보내기',
      }),
    ).toHaveClass('seed-action-button')
  })
})
