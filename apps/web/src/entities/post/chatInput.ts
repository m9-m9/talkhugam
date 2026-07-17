/** 제출 메시지 조건을 충족하는지 판별한다. */
export function shouldSubmitMessage(key: string, shiftKey: boolean): boolean {
  return key === 'Enter' && !shiftKey
}
