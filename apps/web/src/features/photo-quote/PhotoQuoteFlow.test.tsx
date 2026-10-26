import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PhotoQuoteFlow } from './PhotoQuoteFlow'

const { recognizePagePhoto, resizePhotoForOcr } = vi.hoisted(() => ({
  recognizePagePhoto: vi.fn(),
  resizePhotoForOcr: vi.fn(),
}))

vi.mock('./ocrPageApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ocrPageApi')>()),
  recognizePagePhoto,
}))
vi.mock('./photoResize', () => ({ resizePhotoForOcr }))
vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: () => ({}) }))

const bookChatId = '11111111-1111-4111-8111-111111111111'
const lines = [
  {
    box: { height: 0.05, width: 0.8, x: 0.1, y: 0.1 },
    id: 'line-0',
    text: '우리는 늘 떠나는 쪽이었고',
  },
  {
    box: { height: 0.05, width: 0.8, x: 0.1, y: 0.2 },
    id: 'line-1',
    text: '남는 쪽의 마음을 헤아린',
  },
  { box: { height: 0.05, width: 0.8, x: 0.1, y: 0.3 }, id: 'line-2', text: '적이 없었다.' },
]

/** 사진 인식 흐름을 새 QueryClient와 함께 렌더링한다. */
function renderFlow(overrides: { onClose?: () => void; onInsert?: () => void } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onClose = overrides.onClose ?? vi.fn()
  const onInsert = overrides.onInsert ?? vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <PhotoQuoteFlow
        bookChatId={bookChatId}
        file={new File(['jpeg'], 'page.jpg', { type: 'image/jpeg' })}
        onClose={onClose}
        onInsert={onInsert}
      />
    </QueryClientProvider>,
  )
  return { onClose, onInsert }
}

beforeEach(() => {
  resizePhotoForOcr.mockResolvedValue('aW1hZ2U=')
  recognizePagePhoto.mockResolvedValue(lines)
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:page'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PhotoQuoteFlow', () => {
  it('줄여 만든 사진만 서버로 보내고 읽는 동안 안내를 보여 준다', async () => {
    renderFlow()

    expect(screen.getByRole('dialog', { name: '문장 고르기' })).toBeInTheDocument()
    expect(screen.getByText('문장을 읽고 있어요')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '우리는 늘 떠나는 쪽이었고' })).toBeVisible()
    expect(recognizePagePhoto).toHaveBeenCalledWith({}, bookChatId, 'aW1hZ2U=')
  })

  it('줄을 탭해 켜고 끄며 줄 수와 글자 수를 보여 준다', async () => {
    renderFlow()
    const firstLine = await screen.findByRole('button', { name: '우리는 늘 떠나는 쪽이었고' })

    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
    fireEvent.click(firstLine)
    expect(firstLine).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1줄 · 14자')).toBeInTheDocument()
    fireEvent.click(firstLine)
    expect(firstLine).toHaveAttribute('aria-pressed', 'false')
  })

  it('사진 위에서 끌면 시작 줄부터 끝 줄까지 연속으로 고른다', async () => {
    renderFlow()
    await screen.findByRole('button', { name: '적이 없었다.' })
    const overlay = screen.getByTestId('photo-quote-overlay')
    overlay.getBoundingClientRect = () => DOMRect.fromRect({ height: 100, width: 100, x: 0, y: 0 })

    fireEvent.pointerDown(overlay, { clientX: 50, clientY: 12, pointerId: 1 })
    fireEvent.pointerMove(overlay, { clientX: 50, clientY: 32, pointerId: 1 })
    fireEvent.pointerUp(overlay, { clientX: 50, clientY: 32, pointerId: 1 })

    expect(screen.getByText('3줄 · 36자')).toBeInTheDocument()
  })

  it('확인 화면에서 문장을 고치고 쪽을 적어 글에 넣는다', async () => {
    const { onInsert } = renderFlow()
    fireEvent.click(await screen.findByRole('button', { name: '우리는 늘 떠나는 쪽이었고' }))
    fireEvent.click(screen.getByRole('button', { name: '남는 쪽의 마음을 헤아린' }))
    fireEvent.click(screen.getByRole('button', { name: '다음' }))

    expect(screen.getByRole('dialog', { name: '가져올 문장 확인' })).toBeInTheDocument()
    expect(screen.getByText('사진은 저장되지 않아요.')).toBeInTheDocument()
    const quoteInput = screen.getByRole('textbox', { name: '가져올 문장' })
    expect(quoteInput).toHaveValue('우리는 늘 떠나는 쪽이었고 남는 쪽의 마음을 헤아린')

    fireEvent.click(screen.getByRole('button', { name: '원문 줄바꿈 유지' }))
    expect(quoteInput).toHaveValue('우리는 늘 떠나는 쪽이었고\n남는 쪽의 마음을 헤아린')

    fireEvent.change(quoteInput, { target: { value: '우리는 늘 떠나는 쪽이었다' } })
    fireEvent.change(screen.getByRole('textbox', { name: '쪽 번호' }), { target: { value: '87' } })
    fireEvent.click(screen.getByRole('button', { name: '글에 넣기' }))

    expect(onInsert).toHaveBeenCalledWith({ page: '87', quote: '우리는 늘 떠나는 쪽이었다' })
  })

  it('300자를 넘게 고르면 다음으로 넘어가지 않는다', async () => {
    recognizePagePhoto.mockResolvedValue([
      { ...lines[0], text: '가'.repeat(200) },
      { ...lines[1], text: '나'.repeat(200) },
    ])
    renderFlow()
    fireEvent.click(await screen.findByRole('button', { name: '가'.repeat(200) }))
    fireEvent.click(screen.getByRole('button', { name: '나'.repeat(200) }))

    expect(screen.getByText('300자까지 가져올 수 있어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
  })

  it('인식에 실패하면 이유를 알리고 다시 시도할 수 있다', async () => {
    recognizePagePhoto.mockRejectedValueOnce({ context: new Response(null, { status: 429 }) })
    renderFlow()

    expect(
      await screen.findByText('오늘 사진 인식 횟수를 모두 썼어요. 내일 다시 시도해 주세요.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('button', { name: '적이 없었다.' })).toBeInTheDocument()
  })

  it('글자를 찾지 못하면 다른 사진을 권한다', async () => {
    recognizePagePhoto.mockResolvedValue([])
    renderFlow()

    expect(
      await screen.findByText('사진에서 글자를 찾지 못했어요. 글자가 잘 보이게 다시 찍어 주세요.'),
    ).toBeInTheDocument()
  })

  it('Escape로 닫고 사진 주소를 해제한다', async () => {
    const { onClose } = renderFlow()
    await screen.findByRole('button', { name: '적이 없었다.' })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    cleanup()
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:page'))
  })
})
