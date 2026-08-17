import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

jest.mock('../src/entities/profile/mobileProfile')
jest.mock('../src/shared/api/mobileSupabaseClient')

import {
  completeMobileOnboarding,
  getMobileProfile,
} from '../src/entities/profile/mobileProfile'
import { OnboardingScreen } from '../src/features/onboarding/OnboardingScreen'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const mockCompleteMobileOnboarding = jest.mocked(completeMobileOnboarding)
const mockGetMobileProfile = jest.mocked(getMobileProfile)
const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)
const mobileClient = {} as never

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue(mobileClient)
    mockGetMobileProfile.mockResolvedValue({
      avatarPath: null,
      bio: '느리게 읽어요.',
      displayName: '민규',
      onboardingCompletedAt: null,
      updatedAt: '2026-08-18T00:00:00.000Z',
    })
  })

  it('prepares the authenticated member profile as editable onboarding fields', async () => {
    render(<OnboardingScreen onCompleted={jest.fn()} />)

    expect(await screen.findByDisplayValue('민규')).toBeVisible()
    expect(screen.getByDisplayValue('느리게 읽어요.')).toBeVisible()
  })

  it('does not submit an empty display name and announces the validation error', async () => {
    render(<OnboardingScreen onCompleted={jest.fn()} />)
    const nameInput = await screen.findByLabelText('이름')

    fireEvent.changeText(nameInput, '   ')
    fireEvent.press(screen.getByRole('button', { name: '시작하기' }))

    expect(await screen.findByRole('alert', { name: '이름을 입력해 주세요.' })).toBeVisible()
    expect(mockCompleteMobileOnboarding).not.toHaveBeenCalled()
  })

  it('keeps inputs in place and exposes a retryable error when saving fails', async () => {
    mockCompleteMobileOnboarding.mockRejectedValue(new Error('write failed'))
    render(<OnboardingScreen onCompleted={jest.fn()} />)

    fireEvent.press(await screen.findByRole('button', { name: '시작하기' }))

    expect(
      await screen.findByRole('alert', {
        name: '저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
      }),
    ).toBeVisible()
    expect(screen.getByDisplayValue('민규')).toBeVisible()
  })

  it('finishes onboarding only after the profile save completes', async () => {
    const onCompleted = jest.fn()
    mockCompleteMobileOnboarding.mockResolvedValue(undefined)
    render(<OnboardingScreen onCompleted={onCompleted} />)

    fireEvent.press(await screen.findByRole('button', { name: '시작하기' }))

    await waitFor(() => {
      expect(mockCompleteMobileOnboarding).toHaveBeenCalledWith(mobileClient, {
        bio: '느리게 읽어요.',
        displayName: '민규',
      })
      expect(onCompleted).toHaveBeenCalledTimes(1)
    })
  })

  it('starts only one profile save when the start action is pressed twice before rendering', async () => {
    let resolveSave: (() => void) | undefined
    const onCompleted = jest.fn()
    mockCompleteMobileOnboarding.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSave = resolve
      }),
    )
    render(<OnboardingScreen onCompleted={onCompleted} />)
    const submitButton = await screen.findByRole('button', { name: '시작하기' })

    act(() => {
      fireEvent.press(submitButton)
      fireEvent.press(submitButton)
    })

    expect(mockCompleteMobileOnboarding).toHaveBeenCalledTimes(1)
    resolveSave?.()
    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1))
  })

  it('keeps the onboarding form keyboard-scrollable while it is saving', async () => {
    mockCompleteMobileOnboarding.mockReturnValue(new Promise(() => undefined))
    render(<OnboardingScreen onCompleted={jest.fn()} />)

    fireEvent.press(await screen.findByRole('button', { name: '시작하기' }))

    expect(await screen.findByLabelText('온보딩 입력')).toBeVisible()
    expect(screen.getByLabelText('프로필을 저장하고 있어요.')).toBeVisible()
  })
})
