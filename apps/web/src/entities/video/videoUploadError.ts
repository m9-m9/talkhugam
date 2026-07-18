const genericMessage = '영상 업로드를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'

/** 영상 업로드 오류 메시지 데이터를 조회하거나 계산해 반환한다. */
export function getVideoUploadErrorMessage(error: unknown): string {
  const status = getFunctionResponseStatus(error)

  if (status === 401) return '로그인이 만료되었어요. 다시 로그인한 뒤 영상을 올려 주세요.'
  if (status === 403) return '이 책방에 영상을 올릴 권한이 없어요.'
  if (status !== null && status >= 500)
    return '영상 업로드 설정을 확인하고 있어요. 잠시 후 다시 시도해 주세요.'

  return genericMessage
}

/** Edge Function 실패 응답에서 HTTP status를 추출한다. */
function getFunctionResponseStatus(error: unknown): number | null {
  if (!isObject(error) || !('context' in error)) return null

  const context = error.context
  return context instanceof Response ? context.status : null
}

/** 외부 값이 null이 아닌 일반 객체인지 판별한다. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
