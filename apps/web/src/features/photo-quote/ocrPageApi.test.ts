import { describe, expect, it, vi } from 'vitest'

import { getPhotoQuoteErrorMessage, recognizePagePhoto } from './ocrPageApi'

const bookChatId = '11111111-1111-4111-8111-111111111111'

describe('recognizePagePhoto', () => {
  it('책 대화방 ID와 base64 사진을 ocr-page 함수에 보내고 줄 목록을 검증한다', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        data: {
          lines: [{ box: { height: 0.1, width: 0.5, x: 0, y: 0 }, id: 'line-0', text: '책' }],
        },
        ok: true,
      },
      error: null,
    })

    const lines = await recognizePagePhoto({ functions: { invoke } }, bookChatId, 'aW1hZ2U=')

    expect(invoke).toHaveBeenCalledWith('ocr-page', { body: { bookChatId, image: 'aW1hZ2U=' } })
    expect(lines).toEqual([
      { box: { height: 0.1, width: 0.5, x: 0, y: 0 }, id: 'line-0', text: '책' },
    ])
  })

  it('함수 오류를 그대로 던진다', async () => {
    const error = { context: new Response(null, { status: 429 }) }
    const invoke = vi.fn().mockResolvedValue({ data: null, error })

    await expect(recognizePagePhoto({ functions: { invoke } }, bookChatId, 'aW1h')).rejects.toBe(
      error,
    )
  })
})

describe('getPhotoQuoteErrorMessage', () => {
  it.each([
    [401, '로그인이 만료되었어요. 다시 로그인해 주세요.'],
    [403, '이 책방 구성원만 사진에서 문장을 가져올 수 있어요.'],
    [429, '오늘 사진 인식 횟수를 모두 썼어요. 내일 다시 시도해 주세요.'],
    [503, '사진 인식을 아직 쓸 수 없어요. 잠시 후 다시 시도해 주세요.'],
    [502, '문장을 읽지 못했어요. 다시 시도해 주세요.'],
  ])('status %i를 안내 문구로 바꾼다', (status, expected) => {
    expect(getPhotoQuoteErrorMessage({ context: new Response(null, { status }) })).toBe(expected)
  })

  it('알 수 없는 오류는 일반 문구로 둔다', () => {
    expect(getPhotoQuoteErrorMessage(new Error('network'))).toBe(
      '문장을 읽지 못했어요. 다시 시도해 주세요.',
    )
  })
})
