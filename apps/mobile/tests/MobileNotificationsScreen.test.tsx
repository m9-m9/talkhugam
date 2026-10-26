import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { describe, expect, it, jest } from '@jest/globals'
import { MobileNotificationsScreen } from '../src/features/notification/MobileNotificationsScreen'

jest.mock('../src/entities/notification/mobileNotification', () => ({
  getMobileNotifications: jest.fn(), markMobileNotificationRead: jest.fn(), mobileNotificationKeys: { all: ['mobile-notifications'] },
}))
jest.mock('../src/shared/api/mobileSupabaseClient', () => ({ createMobileSupabaseClient: jest.fn(() => ({})) }))
import { getMobileNotifications, markMobileNotificationRead } from '../src/entities/notification/mobileNotification'
const getNotifications = jest.mocked(getMobileNotifications)
const markRead = jest.mocked(markMobileNotificationRead)
const id = '00000000-0000-4000-8000-000000000001'
const roomId = '00000000-0000-4000-8000-000000000002'

function renderScreen(onOpen = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
  render(<MobileNotificationsScreen onOpen={onOpen} />, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> })
  return onOpen
}
describe('MobileNotificationsScreen', () => {
  it('shows loading, empty, and retryable error states', async () => {
    getNotifications.mockImplementation(() => new Promise(() => undefined))
    renderScreen()
    expect(screen.getByRole('progressbar')).toBeVisible()
  })
  it('shows empty state', async () => {
    getNotifications.mockResolvedValue([])
    renderScreen()
    expect(await screen.findByText('아직 새로운 알림이 없어요')).toBeVisible()
  })
  it('retries an error', async () => {
    getNotifications.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([])
    renderScreen()
    fireEvent.press(await screen.findByRole('button', { name: '알림 다시 불러오기' }))
    expect(await screen.findByText('아직 새로운 알림이 없어요')).toBeVisible()
  })
  it('marks read then safely navigates and ignores malformed paths', async () => {
    const onOpen = jest.fn()
    getNotifications.mockResolvedValue([
      { id, isRead: false, message: '안전', targetPath: '/rooms/' + roomId },
      { id: '00000000-0000-4000-8000-000000000003', isRead: true, message: '위험', targetPath: 'https://evil.example' },
    ])
    markRead.mockResolvedValue(undefined)
    renderScreen(onOpen)
    fireEvent.press(await screen.findByRole('button', { name: '안전' }))
    await waitFor(() => expect(markRead).toHaveBeenCalledWith(expect.anything(), id))
    expect(onOpen).toHaveBeenCalledWith('/rooms/' + roomId)
    fireEvent.press(screen.getByRole('button', { name: '위험' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
  it('keeps the user on the list with a message when marking read fails', async () => {
    const onOpen = jest.fn()
    getNotifications.mockResolvedValue([{ id, isRead: false, message: '실패', targetPath: '/rooms/' + roomId }])
    markRead.mockRejectedValueOnce(new Error('offline'))
    renderScreen(onOpen)
    fireEvent.press(await screen.findByRole('button', { name: '실패' }))
    expect(await screen.findByText('알림을 읽음으로 바꾸지 못했어요. 다시 눌러 주세요.')).toBeVisible()
    expect(onOpen).not.toHaveBeenCalled()
  })
})
