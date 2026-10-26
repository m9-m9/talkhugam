import { z } from 'zod'

const uuid = z.string().uuid()

/** 푸시 데이터의 내부 UUID 경로만 허용해 임의 외부 이동을 차단한다. */
export function parseMobileNotificationTargetPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^\/rooms\/([^/]+)(?:\/books\/([^/]+)|\/manage)?$/.exec(value)
  if (!match) return null
  const roomId = uuid.safeParse(match[1])
  if (!roomId.success) return null
  if (value.endsWith('/manage')) return '/rooms/' + roomId.data + '/manage'
  const bookId = match[2] === undefined ? null : uuid.safeParse(match[2])
  if (bookId !== null && !bookId.success) return null
  return bookId?.success ? '/rooms/' + roomId.data + '/books/' + bookId.data : '/rooms/' + roomId.data
}
