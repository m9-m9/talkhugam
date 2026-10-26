import { parseOcrPageResponse, type OcrLine } from '@talkhugam/domain'

type FunctionsInvoker = {
  functions: {
    invoke: (
      name: string,
      options: { body: Record<string, unknown> },
    ) => Promise<{ data: unknown; error: unknown }>
  }
}

const genericMessage = '문장을 읽지 못했어요. 다시 시도해 주세요.'

/** Supabase client와 책 대화방 ID, base64 사진을 받아 ocr-page 함수로 인식한 줄 목록을 반환한다. */
export async function recognizePagePhoto(
  client: FunctionsInvoker,
  bookChatId: string,
  image: string,
): Promise<OcrLine[]> {
  const response = await client.functions.invoke('ocr-page', { body: { bookChatId, image } })
  if (response.error) throw response.error
  return parseOcrPageResponse(response.data)
}

/** Edge Function 실패 응답에서 HTTP status를 꺼내고, 없으면 null을 반환한다. */
function getFunctionResponseStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('context' in error)) return null
  return error.context instanceof Response ? error.context.status : null
}

/** 사진 인식 실패 오류를 받아 사용자에게 보여 줄 안내 문구를 반환한다. */
export function getPhotoQuoteErrorMessage(error: unknown): string {
  const status = getFunctionResponseStatus(error)
  if (status === 401) return '로그인이 만료되었어요. 다시 로그인해 주세요.'
  if (status === 403) return '이 책방 구성원만 사진에서 문장을 가져올 수 있어요.'
  if (status === 429) return '오늘 사진 인식 횟수를 모두 썼어요. 내일 다시 시도해 주세요.'
  if (status === 503) return '사진 인식을 아직 쓸 수 없어요. 잠시 후 다시 시도해 주세요.'
  return genericMessage
}
