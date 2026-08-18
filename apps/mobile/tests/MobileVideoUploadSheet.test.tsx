import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(), requestMediaLibraryPermissionsAsync: jest.fn(),
}))
jest.mock('expo-file-system', () => ({ File: jest.fn() }))
jest.mock('../src/entities/video')
jest.mock('../src/shared/api/mobileSupabaseClient')

import * as ImagePicker from 'expo-image-picker'
import { File } from 'expo-file-system'
import { createMobileVideoUpload } from '../src/entities/video'
import { MobileVideoUploadSheet } from '../src/features/video/MobileVideoUploadSheet'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const bookChatId = '00000000-0000-4000-8000-000000000001'
const uploadClientId = '00000000-0000-4000-8000-000000000002'

const mockCameraPermission = jest.mocked(ImagePicker.requestCameraPermissionsAsync)
const mockLibraryPermission = jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
const mockLaunchCamera = jest.mocked(ImagePicker.launchCameraAsync)
const mockLaunchLibrary = jest.mocked(ImagePicker.launchImageLibraryAsync)
const mockCreateUpload = jest.mocked(createMobileVideoUpload)
const mockFile = jest.mocked(File)

/** native File 생성자 mock에 업로드 결과를 안전하게 주입한다. */
function mockNativeFileUpload(upload: () => Promise<{ status: number }>): void {
  ;(mockFile as unknown as { mockImplementation(factory: () => unknown): void }).mockImplementation(
    () => ({ upload }),
  )
}

/** 테스트별 Query cache와 cache invalidation spy를 함께 생성한다. */
function createTestContext(): { queryClient: QueryClient; wrapper: ({ children }: PropsWithChildren) => React.JSX.Element } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
  return { queryClient, wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> }
}

describe('MobileVideoUploadSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: jest.fn(() => uploadClientId) } })
    jest.mocked(createMobileSupabaseClient).mockReturnValue({} as never)
    mockCreateUpload.mockResolvedValue({ postId: '00000000-0000-4000-8000-000000000003', uploadUrl: 'https://upload.example.test/video' })
    mockCameraPermission.mockResolvedValue({ granted: true } as never)
    mockLibraryPermission.mockResolvedValue({ granted: true } as never)
    mockLaunchCamera.mockResolvedValue({ assets: [{ duration: 10_000, mimeType: 'video/mp4', uri: 'file:///video.mp4' }], canceled: false } as never)
    mockLaunchLibrary.mockResolvedValue({ canceled: true } as never)
    mockNativeFileUpload(async () => ({ status: 200 }))
  })

  it('shows a permission message and does not create an upload when camera access is denied', async () => {
    mockCameraPermission.mockResolvedValue({ granted: false } as never)
    render(<MobileVideoUploadSheet bookChatId={bookChatId} onClose={jest.fn()} roomId="room" />, { wrapper: createTestContext().wrapper })
    fireEvent.press(screen.getByRole('button', { name: '카메라로 영상 촬영' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('카메라 권한을 허용해 주세요.')
    expect(mockCreateUpload).not.toHaveBeenCalled()
  })

  it('does not create an upload when the picker is cancelled', async () => {
    render(<MobileVideoUploadSheet bookChatId={bookChatId} onClose={jest.fn()} roomId="room" />, { wrapper: createTestContext().wrapper })
    fireEvent.press(screen.getByRole('button', { name: '갤러리에서 영상 선택' }))
    await waitFor(() => expect(mockLaunchLibrary).toHaveBeenCalled())
    expect(mockCreateUpload).not.toHaveBeenCalled()
  })

  it('blocks long or unsupported selected media before creating an upload', async () => {
    mockLaunchCamera.mockResolvedValue({ assets: [{ duration: 30_001, mimeType: 'video/mp4', uri: 'file:///long.mp4' }], canceled: false } as never)
    render(<MobileVideoUploadSheet bookChatId={bookChatId} onClose={jest.fn()} roomId="room" />, { wrapper: createTestContext().wrapper })
    fireEvent.press(screen.getByRole('button', { name: '카메라로 영상 촬영' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('30초 이하의 영상만 올릴 수 있어요.')
    expect(mockCreateUpload).not.toHaveBeenCalled()
  })

  it('reuses the exact client id after a PUT failure', async () => {
    let uploadAttempt = 0
    const failedUpload = async () => ({ status: uploadAttempt++ === 0 ? 500 : 200 })
    mockNativeFileUpload(failedUpload)
    render(<MobileVideoUploadSheet bookChatId={bookChatId} onClose={jest.fn()} roomId="room" />, { wrapper: createTestContext().wrapper })
    fireEvent.press(screen.getByRole('button', { name: '카메라로 영상 촬영' }))
    expect(await screen.findByRole('button', { name: '영상 업로드 다시 시도' })).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '영상 업로드 다시 시도' }))
    await waitFor(() => expect(mockCreateUpload).toHaveBeenCalledTimes(2))
    expect(mockCreateUpload).toHaveBeenNthCalledWith(1, expect.anything(), bookChatId, uploadClientId)
    expect(mockCreateUpload).toHaveBeenNthCalledWith(2, expect.anything(), bookChatId, uploadClientId)
  })

  it('closes after a successful upload and invalidates video and room caches', async () => {
    const onClose = jest.fn()
    const { queryClient, wrapper } = createTestContext()
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')
    render(<MobileVideoUploadSheet bookChatId={bookChatId} onClose={onClose} roomId="room" />, { wrapper })
    fireEvent.press(screen.getByRole('button', { name: '카메라로 영상 촬영' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['video-posts', bookChatId] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['reading-rooms'] })
  })
})
