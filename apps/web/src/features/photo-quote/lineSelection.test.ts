import { describe, expect, it } from 'vitest'

import {
  applyLineRange,
  findLineAtPoint,
  getLineRangeIds,
  getSelectedLineTexts,
  toggleLineId,
} from './lineSelection'

const lines = [
  { box: { height: 0.05, width: 0.8, x: 0.1, y: 0.1 }, id: 'line-0', text: '첫째 줄' },
  { box: { height: 0.05, width: 0.8, x: 0.1, y: 0.2 }, id: 'line-1', text: '둘째 줄' },
  { box: { height: 0.05, width: 0.8, x: 0.1, y: 0.3 }, id: 'line-2', text: '셋째 줄' },
  { box: { height: 0.05, width: 0.8, x: 0.1, y: 0.4 }, id: 'line-3', text: '넷째 줄' },
]

describe('lineSelection', () => {
  it('탭한 줄을 켜고 다시 탭하면 끈다', () => {
    expect(toggleLineId([], 'line-1')).toEqual(['line-1'])
    expect(toggleLineId(['line-1', 'line-2'], 'line-1')).toEqual(['line-2'])
  })

  it('끌기 시작 줄과 끝 줄 사이를 방향과 관계없이 연속 범위로 고른다', () => {
    expect(getLineRangeIds(lines, 'line-1', 'line-3')).toEqual(['line-1', 'line-2', 'line-3'])
    expect(getLineRangeIds(lines, 'line-3', 'line-1')).toEqual(['line-1', 'line-2', 'line-3'])
    expect(getLineRangeIds(lines, 'line-1', 'missing')).toEqual([])
  })

  it('끌기 범위를 기존 선택에 더하거나 뺀다', () => {
    expect(applyLineRange(['line-0'], ['line-2', 'line-3'], 'add')).toEqual([
      'line-0',
      'line-2',
      'line-3',
    ])
    expect(applyLineRange(['line-0', 'line-1', 'line-2'], ['line-1', 'line-2'], 'remove')).toEqual([
      'line-0',
    ])
  })

  it('선택한 줄 텍스트를 사진 속 순서대로 돌려준다', () => {
    expect(getSelectedLineTexts(lines, ['line-2', 'line-0'])).toEqual(['첫째 줄', '셋째 줄'])
  })

  it('비율 좌표에 놓인 줄을 찾고 줄 사이 빈 곳은 null을 돌려준다', () => {
    expect(findLineAtPoint(lines, 0.5, 0.22)?.id).toBe('line-1')
    expect(findLineAtPoint(lines, 0.5, 0.27)).toBeNull()
    expect(findLineAtPoint(lines, 0.95, 0.22)).toBeNull()
  })
})
