import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

jest.mock('../src/entities/profile')
jest.mock('../src/shared/api/mobileSupabaseClient')

import { getMobileProfile, updateMobileProfile } from '../src/entities/profile'
import { MobileProfileEditScreen } from '../src/features/profile/MobileProfileEditScreen'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const mockGetMobileProfile = jest.mocked(getMobileProfile)
const mockUpdateMobileProfile = jest.mocked(updateMobileProfile)
const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)
const mobileClient = {} as never

describe('MobileProfileEditScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue(mobileClient)
    mockGetMobileProfile.mockResolvedValue({
      avatarPath: null,
      bio: '느리게 읽어요.',
      displayName: '민규',
      onboardingCompletedAt: '2026-08-18T00:00:00.000Z',
      updatedAt: '2026-08-18T00:00:00.000Z',
    })
    mockUpdateMobileProfile.mockResolvedValue({ bio: '느리게 읽어요.', displayName: '민규' })
  })

  it('prepares the authenticated member profile for editing and returns after a saved form', async () => {
    const onSaved = jest.fn()
    render(<MobileProfileEditScreen onBack={jest.fn()} onSaved={onSaved} />)

    fireEvent.changeText(await screen.findByLabelText('이름'), '  지민  ')
    fireEvent.press(screen.getByRole('button', { name: '저장하기' }))

    await waitFor(() => {
      expect(mockUpdateMobileProfile).toHaveBeenCalledWith(mobileClient, {
        bio: '느리게 읽어요.',
        displayName: '지민',
      })
      expect(onSaved).toHaveBeenCalledTimes(1)
    })
  })

  it('does not write an invalid profile form', async () => {
    render(<MobileProfileEditScreen onBack={jest.fn()} onSaved={jest.fn()} />)

    fireEvent.changeText(await screen.findByLabelText('이름'), '   ')
    fireEvent.press(screen.getByRole('button', { name: '저장하기' }))

    expect(await screen.findByRole('alert', { name: '이름을 입력해 주세요.' })).toBeVisible()
    expect(mockUpdateMobileProfile).not.toHaveBeenCalled()
  })
})
