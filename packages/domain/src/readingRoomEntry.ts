import { z } from 'zod'

const inviteCodeSchema = z.string().length(6, '6자리 초대 코드를 입력해 주세요.')
const inviteTokenSchema = z.string().regex(/^[a-f0-9]{64}$/)

export const createRoomFormSchema = z.object({
  description: z.string().trim().max(120, '소개는 120자 이내로 작성해 주세요.'),
  name: z
    .string()
    .trim()
    .min(1, '책방 이름을 입력해 주세요.')
    .max(40, '책방 이름은 40자 이내로 작성해 주세요.'),
})

export const joinRoomFormSchema = z.object({
  code: z
    .string()
    .trim()
    .transform(normalizeInviteValue)
    .pipe(z.union([inviteCodeSchema, inviteTokenSchema])),
})

export type CreateRoomForm = z.infer<typeof createRoomFormSchema>
export type JoinRoomForm = z.infer<typeof joinRoomFormSchema>

/** URL 쿼리 값이 서버가 발급한 초대 토큰 형식인지 검증해 반환한다. */
export function parseInviteToken(value: unknown): string | null {
  const parsedToken = inviteTokenSchema.safeParse(value)
  return parsedToken.success ? parsedToken.data : null
}

/** 여섯 자리 초대 코드는 대문자로 맞추고 링크 토큰은 원문 그대로 반환한다. */
function normalizeInviteValue(value: string): string {
  return value.length === 6 ? value.toUpperCase() : value
}
