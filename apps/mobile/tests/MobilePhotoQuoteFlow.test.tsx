import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'

jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }))
jest.mock('expo-image-picker', () => ({}))
jest.mock('../src/shared/api/mobileSupabaseClient')
jest.mock('../src/features/photo-quote/mobilePhotoSource', () => ({ preparePhotoForOcr: jest.fn() }))
jest.mock('@talkhugam/domain', () => ({
  ...jest.requireActual<typeof import('@talkhugam/domain')>('@talkhugam/domain'),
  recognizePagePhoto: jest.fn(),
}))

import { PhotoDecodeError, recognizePagePhoto } from '@talkhugam/domain'
import { preparePhotoForOcr } from '../src/features/photo-quote/mobilePhotoSource'
import { MobilePhotoQuoteFlow } from '../src/features/photo-quote/MobilePhotoQuoteFlow'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const bookChatId = '3f1c2a4e-7b5d-4e6a-9c8b-1a2b3c4d5e02'
const photo = { height: 4000, uri: 'file:///original.jpg', width: 3000 }
const preparedPhoto = { base64: 'aW1hZ2U=', height: 2000, uri: 'file:///small.jpg', width: 1500 }
const lines = [
  { box: { height: 0.05, width: 0.8, x: 0.1, y: 0.1 }, id: 'line-0', text: '우리는 늘 떠나는 쪽이었고' },
  { box: { height: 0.05, width: 0.8, x: 0.1, y: 0.2 }, id: 'line-1', text: '남는 쪽의 마음을 헤아린' },
  { box: { height: 0.05, width: 0.8, x: 0.1, y: 0.3 }, id: 'line-2', text: '적이 없었다.' },
]

const mockPrepare = jest.mocked(preparePhotoForOcr)
const mockRecognize = jest.mocked(recognizePagePhoto)
const mockClient = jest.mocked(createMobileSupabaseClient)
const supabaseClient = { functions: { invoke: jest.fn() } }

/** 테스트마다 독립된 Query cache로 흐름을 렌더링하고 콜백 mock을 돌려준다. */
function renderFlow(selectedPhoto: typeof photo | null = photo) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
  const callbacks = { onClose: jest.fn(), onInsert: jest.fn(), onPickAnotherPhoto: jest.fn() }
  /** 흐름이 쓰는 Query Provider를 감싼다. */
  function Wrapper({ children }: PropsWithChildren): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  render(<MobilePhotoQuoteFlow bookChatId={bookChatId} photo={selectedPhoto} {...callbacks} />, { wrapper: Wrapper })
  return callbacks
}

/** 인식이 끝나길 기다려 접힌 줄 목록을 펼친다. */
async function openLineList(): Promise<void> {
  fireEvent.press(await screen.findByRole('button', { name: '줄 목록으로 고르기' }))
}

describe('MobilePhotoQuoteFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockClient.mockReturnValue(supabaseClient as never)
    mockPrepare.mockResolvedValue(preparedPhoto)
    mockRecognize.mockResolvedValue(lines)
  })

  it('sends only the resized JPEG to ocr-page and shows the line overlay', async () => {
    renderFlow()

    expect(screen.getByText('문장을 읽고 있어요')).toBeVisible()
    expect(await screen.findByLabelText('고른 책 페이지 사진')).toBeVisible()
    expect(mockPrepare).toHaveBeenCalledWith(photo)
    expect(mockRecognize).toHaveBeenCalledWith(supabaseClient, bookChatId, 'aW1hZ2U=')
    expect(screen.queryByRole('button', { name: '적이 없었다.' })).toBeNull()
  })

  it('selects a continuous range by dragging over the photo', async () => {
    renderFlow()
    await screen.findByLabelText('고른 책 페이지 사진')
    const overlay = screen.getByTestId('photo-quote-overlay')
    fireEvent(overlay, 'layout', { nativeEvent: { layout: { height: 100, width: 100, x: 0, y: 0 } } })

    fireEvent(overlay, 'responderGrant', { nativeEvent: { locationX: 50, locationY: 12 } })
    fireEvent(overlay, 'responderMove', { nativeEvent: { locationX: 50, locationY: 32 } })
    fireEvent(overlay, 'responderRelease', { nativeEvent: { locationX: 50, locationY: 32 } })

    expect(screen.getByText('3줄 · 36자')).toBeVisible()
  })

  it('confirms the picked lines with a page and inserts the quote', async () => {
    const { onInsert } = renderFlow()
    await openLineList()
    fireEvent.press(screen.getByRole('button', { name: '우리는 늘 떠나는 쪽이었고' }))
    fireEvent.press(screen.getByRole('button', { name: '남는 쪽의 마음을 헤아린' }))
    fireEvent.press(screen.getByRole('button', { name: '다음' }))

    expect(screen.getByLabelText('인용할 문장').props.value).toBe('우리는 늘 떠나는 쪽이었고 남는 쪽의 마음을 헤아린')
    expect(screen.getByText('사진은 저장되지 않아요.')).toBeVisible()
    fireEvent.changeText(screen.getByLabelText('쪽 번호'), '87')
    fireEvent.press(screen.getByRole('button', { name: '글에 넣기' }))

    expect(onInsert).toHaveBeenCalledWith({ page: '87', quote: '우리는 늘 떠나는 쪽이었고 남는 쪽의 마음을 헤아린' })
  })

  it('blocks a selection longer than 300 characters', async () => {
    mockRecognize.mockResolvedValue([
      { ...lines[0]!, text: '가'.repeat(200) },
      { ...lines[1]!, text: '나'.repeat(200) },
    ])
    renderFlow()
    await openLineList()
    fireEvent.press(screen.getByRole('button', { name: '가'.repeat(200) }))
    fireEvent.press(screen.getByRole('button', { name: '나'.repeat(200) }))

    expect(screen.getByText('300자까지 가져올 수 있어요.')).toBeVisible()
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
  })

  it('explains a rate limit and retries recognition', async () => {
    mockRecognize.mockRejectedValueOnce({ context: { status: 429 } })
    renderFlow()

    expect(await screen.findByText('오늘 사진 인식 횟수를 모두 썼어요. 내일 다시 시도해 주세요.')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('button', { name: '줄 목록으로 고르기' })).toBeVisible()
  })

  it.each([
    [503, '사진 인식을 아직 쓸 수 없어요. 잠시 후 다시 시도해 주세요.'],
    [502, '문장을 읽지 못했어요. 다시 시도해 주세요.'],
  ])('shows status %i with a retry action', async (status, message) => {
    mockRecognize.mockRejectedValueOnce({ context: { status } })
    renderFlow()

    expect(await screen.findByText(message)).toBeVisible()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible()
  })

  it('suggests another shot when no text was found and can retry', async () => {
    mockRecognize.mockResolvedValueOnce([])
    renderFlow()

    expect(await screen.findByText('사진에서 글자를 찾지 못했어요. 글자가 잘 보이게 다시 찍어 주세요.')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('button', { name: '줄 목록으로 고르기' })).toBeVisible()
  })

  it('stops before ocr-page when the photo cannot be opened and offers another photo', async () => {
    mockPrepare.mockRejectedValueOnce(new PhotoDecodeError())
    const { onPickAnotherPhoto } = renderFlow()

    expect(await screen.findByText('이 사진을 열지 못했어요. 다른 사진을 골라 주세요.')).toBeVisible()
    expect(mockRecognize).not.toHaveBeenCalled()
    fireEvent.press(screen.getByRole('button', { name: '다른 사진 고르기' }))
    expect(onPickAnotherPhoto).toHaveBeenCalled()
  })

  it('opens an empty confirmation for direct quote input without recognition', () => {
    const { onClose, onInsert } = renderFlow(null)

    expect(screen.getByText('문장 직접 입력')).toBeVisible()
    expect(mockPrepare).not.toHaveBeenCalled()
    expect(screen.queryByText('사진은 저장되지 않아요.')).toBeNull()
    expect(screen.getByRole('button', { name: '글에 넣기' })).toBeDisabled()
    fireEvent.changeText(screen.getByLabelText('인용할 문장'), '남는 쪽의 마음')
    fireEvent.press(screen.getByRole('button', { name: '글에 넣기' }))
    expect(onInsert).toHaveBeenCalledWith({ page: null, quote: '남는 쪽의 마음' })

    fireEvent.press(screen.getByRole('button', { name: '이전 화면으로' }))
    expect(onClose).toHaveBeenCalled()
  })
})
