import { describe, expect, it } from 'vitest'

import { addMissingFunctionDocs, findUndocumentedNamedFunctions } from './functionDocumentation.mjs'

describe('함수 문서화 검사', () => {
  it('JSDoc이 없는 이름 있는 함수만 누락으로 찾는다', () => {
    const source = `
/** 인증된 사용자를 조회해 반환한다. */
export function getAuthenticatedUser() {
  return null
}

export function createRoom() {
  return null
}
`

    expect(findUndocumentedNamedFunctions(source, 'sample.ts')).toEqual([
      { line: 7, name: 'createRoom' },
    ])
  })

  it('영어로만 작성된 JSDoc은 한글 책임 문서로 인정하지 않는다', () => {
    const source = `
/** Returns the current user. */
export function getCurrentUser() {
  return null
}
`

    expect(findUndocumentedNamedFunctions(source, 'sample.ts')).toEqual([
      { line: 3, name: 'getCurrentUser' },
    ])
  })

  it('누락된 함수 바로 위에 한글 책임 JSDoc을 추가한다', () => {
    const source = `export function parseRoom(input: unknown) {
  return input
}
`

    expect(addMissingFunctionDocs(source, 'sample.ts')).toContain(
      '/** 외부 입력을 검증해 독서방 형식으로 변환한다. */\nexport function parseRoom',
    )
  })

  it('함수 이름의 도메인 용어를 자연스러운 한글 책임으로 설명한다', () => {
    const source = `export async function searchBooks(query: string) {
  return query
}
`

    expect(addMissingFunctionDocs(source, 'sample.ts')).toContain(
      '/** 검색어로 책 목록을 조회해 반환한다. */\nexport async function searchBooks',
    )
  })

  it('보안·인증처럼 이름만으로 부족한 함수는 구체적인 책임을 설명한다', () => {
    const source = `function timingSafeEqual(left: string, right: string) {
  return left === right
}
`

    expect(addMissingFunctionDocs(source, 'sample.ts')).toContain(
      '/** 두 문자열을 일정한 실행 시간으로 비교해 timing attack을 방지한다. */',
    )
  })

  it('객체 속성에 할당한 이름 있는 함수도 문서화 대상으로 찾는다', () => {
    const source = `export const roomQueryKeys = {
  byRoom: (roomId: string) => ['rooms', roomId],
}
`

    expect(findUndocumentedNamedFunctions(source, 'sample.ts')).toEqual([
      { line: 2, name: 'byRoom' },
    ])
  })

  it('클래스 생성자도 문서화 대상으로 찾는다', () => {
    const source = `export class ApiError extends Error {
  constructor(message: string) {
    super(message)
  }
}
`

    expect(findUndocumentedNamedFunctions(source, 'sample.ts')).toEqual([
      { line: 2, name: 'constructor' },
    ])
  })
})
