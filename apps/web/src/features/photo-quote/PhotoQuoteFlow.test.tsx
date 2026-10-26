import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PhotoDecodeError } from './photoDecodeError'
import { PhotoQuoteFlow } from './PhotoQuoteFlow'

const { recognizePagePhoto, resizePhotoForOcr } = vi.hoisted(() => ({
  recognizePagePhoto: vi.fn(),
  resizePhotoForOcr: vi.fn(),
}))

vi.mock('@talkhugam/domain', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@talkhugam/domain')>()),
  recognizePagePhoto,
}))
vi.mock('./photoResize', () => ({ resizePhotoForOcr }))
vi.mock('../../shared/api/supabaseClient', () => ({ createSupabaseClient: () => ({}) }))

const bookChatId = '11111111-1111-4111-8111-111111111111'
const firstSentence = '앞에서 이어진 말이다.'
const secondSentence = '우리는 늘 떠나는 쪽이었고 남는 쪽의 마음을 헤아린 적도 없었다.'
const thirdSentence = '그래서 오늘은 조금 오래 머물기로 했다.'
const lines = [
  '앞에서 이어진 말이다. 우리는',
  '늘 떠나는 쪽이었고 남는 쪽의 마음을',
  '헤아린 적도 없었다. 그래서 오늘은',
  '조금 오래 머물기로 했다.',
].map((text, index) => ({
  box: { height: 0.05, width: 0.8, x: 0.1, y: 0.1 + index * 0.1 },
  id: `line-${index}`,
  text,
}))

/** 사진 인식 흐름을 새 QueryClient와 함께 렌더링한다. */
function renderFlow(
  overrides: {
    file?: File | null
    onClose?: () => void
    onInsert?: () => void
    onPickAnotherPhoto?: () => void
  } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onClose = overrides.onClose ?? vi.fn()
  const onInsert = overrides.onInsert ?? vi.fn()
  const onPickAnotherPhoto = overrides.onPickAnotherPhoto ?? vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <PhotoQuoteFlow
        bookChatId={bookChatId}
        file={
          overrides.file === undefined
            ? new File(['jpeg'], 'page.jpg', { type: 'image/jpeg' })
            : overrides.file
        }
        onClose={onClose}
        onInsert={onInsert}
        onPickAnotherPhoto={onPickAnotherPhoto}
      />
    </QueryClientProvider>,
  )
  return { onClose, onInsert, onPickAnotherPhoto }
}

/** 인식이 끝나길 기다려 접힌 문장 목록을 펼친다. */
async function openSentenceList() {
  const toggle = await screen.findByRole('button', { name: '문장으로 고르기' })
  if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle)
}

/** 사진 줄 박스 위를 위에서 아래로 끌어 비율 y 구간의 줄을 고른다. */
async function dragOverPhoto(fromY: number, toY: number) {
  await screen.findByRole('button', { name: '문장으로 고르기' })
  const overlay = screen.getByTestId('photo-quote-overlay')
  overlay.getBoundingClientRect = () => DOMRect.fromRect({ height: 100, width: 100, x: 0, y: 0 })
  fireEvent.pointerDown(overlay, { clientX: 50, clientY: fromY, pointerId: 1 })
  fireEvent.pointerMove(overlay, { clientX: 50, clientY: toY, pointerId: 1 })
  fireEvent.pointerUp(overlay, { clientX: 50, clientY: toY, pointerId: 1 })
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
    expect(await screen.findByRole('button', { name: '문장으로 고르기' })).toBeVisible()
    expect(recognizePagePhoto).toHaveBeenCalledWith({}, bookChatId, 'aW1hZ2U=')
  })

  it('문장 목록은 기본으로 접어 두고 사진 위 끌기·탭을 먼저 안내한다', async () => {
    renderFlow()
    const toggle = await screen.findByRole('button', { name: '문장으로 고르기' })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('사진 위 줄을 누르거나 끌어서 고르세요.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: firstSentence })).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(
      [firstSentence, secondSentence, thirdSentence].map(
        (name) => screen.getByRole('button', { name }).textContent,
      ),
    ).toEqual([firstSentence, secondSentence, thirdSentence])
  })

  it('문장을 누르면 걸친 줄이 사진 위에도 표시되고 확인 화면에는 그 문장만 들어간다', async () => {
    const { onInsert } = renderFlow()
    await openSentenceList()
    const sentence = screen.getByRole('button', { name: secondSentence })

    fireEvent.click(sentence)

    expect(sentence).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(`3줄 · ${secondSentence.length}자`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByRole('textbox', { name: '인용할 문장' })).toHaveValue(secondSentence)
    expect(screen.queryByRole('button', { name: '고른 줄 그대로' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '쪽 번호' }), { target: { value: '87' } })
    fireEvent.click(screen.getByRole('button', { name: '글에 넣기' }))

    expect(onInsert).toHaveBeenCalledWith({ page: '87', quote: secondSentence })
  })

  it('같은 문장을 다시 누르면 선택을 푼다', async () => {
    renderFlow()
    await openSentenceList()
    const sentence = screen.getByRole('button', { name: firstSentence })

    fireEvent.click(sentence)
    fireEvent.click(sentence)

    expect(sentence).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
  })

  it('사진 위에서 끌어 고른 줄은 문장 경계에 맞추고 "고른 줄 그대로"로 바꿀 수 있다', async () => {
    renderFlow()
    await dragOverPhoto(12, 32)

    expect(screen.getByText(`3줄 · ${`${firstSentence} ${secondSentence}`.length}자`)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    const quoteInput = screen.getByRole('textbox', { name: '인용할 문장' })
    expect(quoteInput).toHaveValue(`${firstSentence} ${secondSentence}`)
    expect(screen.getByText('앞뒤 잘린 문장 조각은 뺐어요.')).toBeInTheDocument()

    const rawToggle = screen.getByRole('button', { name: '고른 줄 그대로' })
    fireEvent.click(rawToggle)
    expect(rawToggle).toHaveAttribute('aria-pressed', 'true')
    expect(quoteInput).toHaveValue(`${firstSentence} ${secondSentence} 그래서 오늘은`)

    fireEvent.click(screen.getByRole('button', { name: '원문 줄바꿈 유지' }))
    expect(quoteInput).toHaveValue(
      '앞에서 이어진 말이다. 우리는\n늘 떠나는 쪽이었고 남는 쪽의 마음을\n헤아린 적도 없었다. 그래서 오늘은',
    )

    fireEvent.click(rawToggle)
    expect(quoteInput).toHaveValue(`${firstSentence} ${secondSentence}`)
  })

  it('온전한 문장이 없는 줄 선택은 고른 줄 그대로를 보여 준다', async () => {
    renderFlow()
    await dragOverPhoto(22, 22)

    fireEvent.click(screen.getByRole('button', { name: '다음' }))

    expect(screen.getByRole('textbox', { name: '인용할 문장' })).toHaveValue(
      '늘 떠나는 쪽이었고 남는 쪽의 마음을',
    )
    expect(screen.queryByRole('button', { name: '고른 줄 그대로' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '원문 줄바꿈 유지' })).toBeInTheDocument()
  })

  it('사진 위에서 줄을 고치면 문장 목록 선택을 푼다', async () => {
    renderFlow()
    await openSentenceList()
    fireEvent.click(screen.getByRole('button', { name: firstSentence }))

    await dragOverPhoto(42, 42)

    expect(screen.getByRole('button', { name: firstSentence })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('300자를 넘게 고르면 다음으로 넘어가지 않는다', async () => {
    recognizePagePhoto.mockResolvedValue([
      { ...lines[0], text: '가'.repeat(200) },
      { ...lines[1], text: '나'.repeat(200) },
    ])
    renderFlow()
    await openSentenceList()
    fireEvent.click(screen.getByRole('button', { name: `${'가'.repeat(200)}${'나'.repeat(200)}` }))

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
    expect(await screen.findByRole('button', { name: '문장으로 고르기' })).toBeInTheDocument()
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
    await screen.findByRole('button', { name: '문장으로 고르기' })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    cleanup()
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:page'))
  })

  it('직접 입력은 사진 인식 없이 빈 확인 화면을 열고 글에 넣는다', () => {
    const { onInsert } = renderFlow({ file: null })

    expect(screen.getByRole('dialog', { name: '문장 직접 입력' })).toBeInTheDocument()
    expect(recognizePagePhoto).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '원문 줄바꿈 유지' })).not.toBeInTheDocument()
    expect(screen.queryByText('사진은 저장되지 않아요.')).not.toBeInTheDocument()
    const quoteInput = screen.getByRole('textbox', { name: '인용할 문장' })
    expect(quoteInput).toHaveValue('')
    expect(screen.getByRole('button', { name: '글에 넣기' })).toBeDisabled()

    fireEvent.change(quoteInput, { target: { value: '남는 쪽의 마음' } })
    fireEvent.change(screen.getByRole('textbox', { name: '쪽 번호' }), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: '글에 넣기' }))

    expect(onInsert).toHaveBeenCalledWith({ page: '12', quote: '남는 쪽의 마음' })
  })

  it('직접 입력에서 뒤로 가면 흐름을 닫는다', () => {
    const { onClose } = renderFlow({ file: null })

    fireEvent.click(screen.getByRole('button', { name: '이전 화면으로' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('브라우저가 열 수 없는 사진(HEIC 등)은 서버로 보내지 않고 다른 사진을 고르게 한다', async () => {
    resizePhotoForOcr.mockRejectedValue(new PhotoDecodeError())
    const { onPickAnotherPhoto } = renderFlow({
      file: new File(['heic'], 'IMG_0001.HEIC', { type: 'image/heic' }),
    })

    expect(
      await screen.findByText(
        '이 사진 형식은 이 브라우저에서 열 수 없어요. JPG나 PNG로 바꿔 다시 골라 주세요.',
      ),
    ).toBeInTheDocument()
    expect(recognizePagePhoto).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: '고른 책 페이지 사진' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다른 사진 고르기' }))
    expect(onPickAnotherPhoto).toHaveBeenCalled()
  })

  it('미리보기 이미지를 그리지 못하면 깨진 사진 대신 자리를 비운다', async () => {
    renderFlow()
    const photo = screen.getByRole('img', { name: '고른 책 페이지 사진' })

    fireEvent.error(photo)

    expect(screen.queryByRole('img', { name: '고른 책 페이지 사진' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '문장으로 고르기' })).toBeInTheDocument()
  })
})
