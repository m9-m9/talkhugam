export function shouldSubmitMessage(key: string, shiftKey: boolean): boolean {
  return key === 'Enter' && !shiftKey
}
