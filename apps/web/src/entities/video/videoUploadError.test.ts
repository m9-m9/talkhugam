import { describe, expect, it } from 'vitest'

import { getVideoUploadErrorMessage } from './videoUploadError'

describe('getVideoUploadErrorMessage', () => {
  it.each([
    [401, '로그인이 만료되었어요. 다시 로그인한 뒤 영상을 올려 주세요.'],
    [403, '이 독서방에 영상을 올릴 권한이 없어요.'],
    [502, '영상 업로드 설정을 확인하고 있어요. 잠시 후 다시 시도해 주세요.'],
  ])('maps a function response status of %i to a useful message', (status, expected) => {
    expect(getVideoUploadErrorMessage({ context: new Response(null, { status }) })).toBe(expected)
  })

  it('keeps an unknown failure generic', () => {
    expect(getVideoUploadErrorMessage(new Error('network'))).toBe(
      '영상 업로드를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
  })
})
