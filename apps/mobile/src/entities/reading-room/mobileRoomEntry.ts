import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createRoomFormSchema,
  joinRoomFormSchema,
  type CreateRoomForm,
  type JoinRoomForm,
} from '@talkhugam/domain'
import { z } from 'zod'

import { getMobileProfile } from '../profile'

const createRoomResultSchema = z.array(z.object({ room_id: z.string().uuid() })).length(1)
const inviteResultSchema = z
  .array(
    z.object({
      code: z.string().length(6),
      expires_at: z.string().datetime({ offset: true }),
      token: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  )
  .length(1)
const joinRoomResultSchema = z.array(z.object({ room_id: z.string().uuid() })).length(1)

export type MobileCreatedRoomInvite = {
  code: string
  expiresAt: string
  roomId: string
  token: string
}

/** 외부 생성 입력을 검증하고 현재 회원 이름으로 비공개 책방과 일회용 초대를 발급한다. */
export async function createMobileRoomWithInvite(
  client: SupabaseClient,
  input: unknown,
): Promise<MobileCreatedRoomInvite> {
  const values = createRoomFormSchema.parse(input)
  const profile = await getMobileProfile(client)
  const roomId = await createMobileReadingRoom(client, values, profile.displayName)
  const invite = await createMobileRoomInvite(client, roomId)

  return { code: invite.code, expiresAt: invite.expiresAt, roomId, token: invite.token }
}

/** 외부 초대 입력을 검증하고 현재 회원의 표시명으로 서버 참여 RPC를 호출한다. */
export async function joinMobileRoomByCode(
  client: SupabaseClient,
  input: unknown,
): Promise<string> {
  const values = joinRoomFormSchema.parse(input)
  const profile = await getMobileProfile(client)
  const response = await client.rpc('join_room_by_invite', {
    p_code_or_token: values.code,
    p_room_display_name: profile.displayName,
  })
  if (response.error) throw response.error

  return getSingleResult(joinRoomResultSchema.parse(response.data)).room_id
}

/** 검증된 제목과 소개를 서버 생성 RPC로 전달하고 새 책방 식별자를 반환한다. */
async function createMobileReadingRoom(
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

/** 책방의 일회용 초대 값만 서버 RPC(방장·운영자만 허용)에서 받아 반환한다. */
export async function createMobileRoomInvite(
  client: SupabaseClient,
  roomId: string,
): Promise<Omit<MobileCreatedRoomInvite, 'roomId'>> {
  const response = await client.rpc('create_room_invite', { p_room_id: roomId })
  if (response.error) throw response.error

  const invite = getSingleResult(inviteResultSchema.parse(response.data))
  return { code: invite.code, expiresAt: invite.expires_at, token: invite.token }
}

/** 서버 RPC가 반환한 단일 행 배열에서 첫 결과를 안전하게 꺼낸다. */
function getSingleResult<T>(results: readonly T[]): T {
  const result = results.at(0)
  if (!result) throw new Error('RPC returned no result')

  return result
}

export type { CreateRoomForm, JoinRoomForm }
