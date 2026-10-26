import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createRoomFormSchema,
  joinRoomFormSchema,
  parseInviteToken,
  type CreateRoomForm,
  type JoinRoomForm,
} from '@talkhugam/domain'
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
      token: z.string().regex(/^[a-f0-9]{64}$/),
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

export { createRoomFormSchema, joinRoomFormSchema, parseInviteToken }
export type { CreateRoomForm, JoinRoomForm }

export type CreatedRoomInvite = {
  code: string
  expiresAt: string
  roomId: string
  token: string
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

  return { code: invite.code, expiresAt: invite.expiresAt, roomId, token: invite.token }
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

/** 검증된 입력과 생성자 표시명을 서버 RPC로 전달해 책방 ID를 반환한다. */
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

/** 생성된 책방 ID로 일회용 초대 데이터를 발급해 반환한다. */
async function createInvite(client: SupabaseClient, roomId: string) {
  const response = await client.rpc('create_room_invite', { p_room_id: roomId })

  if (response.error) throw response.error

  const invite = getSingleResult(inviteResultSchema.parse(response.data))
  return { code: invite.code, expiresAt: invite.expires_at, token: invite.token }
}

/** Supabase RPC 응답 배열에서 검증된 단일 결과를 반환한다. */
function getSingleResult<T>(results: readonly T[]): T {
  const result = results.at(0)
  if (!result) throw new Error('RPC returned no result')

  return result
}
