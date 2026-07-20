import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { getProfile } from '../profile'

const createRoomResultSchema = z
  .array(
    z.object({
      room_id: z.string().uuid(),
    }),
  )
  .length(1)

const inviteResultSchema = z
  .array(
    z.object({
      code: z.string().length(6),
      expires_at: z.string().datetime({ offset: true }),
    }),
  )
  .length(1)

const joinRoomResultSchema = z
  .array(
    z.object({
      room_id: z.string().uuid(),
    }),
  )
  .length(1)

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

export type CreatedRoomInvite = {
  code: string
  expiresAt: string
  roomId: string
}

/** URL 쿼리의 초대 토큰이 서버가 발급한 형태인지 확인한다. */
export function parseInviteToken(value: unknown): string | null {
  const parsedToken = inviteTokenSchema.safeParse(value)
  return parsedToken.success ? parsedToken.data : null
}

/** 책방과 초대 코드를 함께 생성해 반환한다. */
export async function createRoomWithInvite(
  client: SupabaseClient,
  profileId: string,
  values: CreateRoomForm,
): Promise<CreatedRoomInvite> {
  const profile = await getProfile(client, profileId)
  const roomId = await createReadingRoom(client, values, profile.displayName)
  const invite = await createInvite(client, roomId)

  return { code: invite.code, expiresAt: invite.expiresAt, roomId }
}

/** 초대 코드를 검증해 현재 사용자를 책방 멤버로 참여시킨다. */
export async function joinRoomByCode(
  client: SupabaseClient,
  profileId: string,
  values: JoinRoomForm,
): Promise<string> {
  const profile = await getProfile(client, profileId)
  const response = await client.rpc('join_room_by_invite', {
    p_code_or_token: values.code,
    p_room_display_name: profile.displayName,
  })

  if (response.error) throw response.error

  return getSingleResult(joinRoomResultSchema.parse(response.data)).room_id
}

/** 책방 데이터를 생성해 반환한다. */
async function createReadingRoom(
  client: SupabaseClient,
  values: CreateRoomForm,
  roomDisplayName: string,
): Promise<string> {
  const response = await client.rpc('create_reading_room', {
    p_description: values.description,
    p_name: values.name,
    p_room_display_name: roomDisplayName,
  })

  if (response.error) throw response.error

  return getSingleResult(createRoomResultSchema.parse(response.data)).room_id
}

/** 초대 데이터를 생성해 반환한다. */
async function createInvite(client: SupabaseClient, roomId: string) {
  const response = await client.rpc('create_room_invite', { p_room_id: roomId })

  if (response.error) throw response.error

  const invite = getSingleResult(inviteResultSchema.parse(response.data))
  return { code: invite.code, expiresAt: invite.expires_at }
}

/** 6자리 코드는 대문자로 맞추고 링크 토큰은 원문 그대로 유지한다. */
function normalizeInviteValue(value: string): string {
  return value.length === 6 ? value.toUpperCase() : value
}

/** Supabase 응답에서 단일 결과를 검증해 반환한다. */
function getSingleResult<T>(results: readonly T[]): T {
  const result = results.at(0)
  if (!result) throw new Error('RPC returned no result')

  return result
}
