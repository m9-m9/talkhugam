const genericMessage = '영상 업로드를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'

export function getVideoUploadErrorMessage(error: unknown): string {
  const status = getFunctionResponseStatus(error)

  if (status === 401) return '로그인이 만료되었어요. 다시 로그인한 뒤 영상을 올려 주세요.'
  if (status === 403) return '이 독서방에 영상을 올릴 권한이 없어요.'
  if (status !== null && status >= 500)
    return '영상 업로드 설정을 확인하고 있어요. 잠시 후 다시 시도해 주세요.'

  return genericMessage
}

function getFunctionResponseStatus(error: unknown): number | null {
  if (!isObject(error) || !('context' in error)) return null

  const context = error.context
  return context instanceof Response ? context.status : null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
