import { describe, expect, it } from 'vitest'

import { findPastedImageFile } from './imageFileSelection'

const image = new File(['jpeg'], 'page.jpg', { type: 'image/jpeg' })
const text = new File(['memo'], 'memo.txt', { type: 'text/plain' })

describe('findPastedImageFile', () => {
  it('붙여넣거나 끌어 놓은 파일 중 첫 이미지 파일을 고른다', () => {
    expect(findPastedImageFile([text, image])).toEqual({ file: image, status: 'image' })
  })

  it('파일이 있지만 이미지가 없으면 지원하지 않는 파일로 알린다', () => {
    expect(findPastedImageFile([text])).toEqual({ status: 'unsupported' })
  })

  it('파일이 없으면 가로채지 않도록 none을 돌려준다', () => {
    expect(findPastedImageFile([])).toEqual({ status: 'none' })
    expect(findPastedImageFile(undefined)).toEqual({ status: 'none' })
  })
})
