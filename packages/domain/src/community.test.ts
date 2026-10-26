import { describe, expect, it } from 'vitest'

import {
  createCommunityRoomFormSchema,
  parseCommunityRooms,
  parseJoinCommunityRoomResult,
} from './community'

describe('parseCommunityRooms', () => {
  it('팔로우한 생성자의 오픈 책방 정보를 화면 모델로 변환한다', () => {
    expect(
      parseCommunityRooms([
        {
          access: 'password',
          active_member_count: 7,
          capacity: 12,
          created_by: '11111111-1111-4111-8111-111111111111',
          description: '이번 달 고전 읽기',
          id: '22222222-2222-4222-8222-222222222222',
          is_following_creator: true,
          name: '고전 산책',
        },
      ]),
    ).toEqual([
      {
        access: 'password',
        activeMemberCount: 7,
        capacity: 12,
        createdBy: '11111111-1111-4111-8111-111111111111',
        description: '이번 달 고전 읽기',
        id: '22222222-2222-4222-8222-222222222222',
        isFollowingCreator: true,
        name: '고전 산책',
      },
    ])
  })
})

describe('createCommunityRoomFormSchema', () => {
  it('비밀번호 오픈 책방의 정원과 비밀번호를 검증한다', () => {
    expect(
      createCommunityRoomFormSchema.safeParse({
        access: 'password',
        capacity: 100,
        description: '',
        name: '밤의 독서회',
        password: 'safe-pass',
      }).success,
    ).toBe(true)
    expect(
      createCommunityRoomFormSchema.safeParse({
        access: 'password',
        capacity: 101,
        description: '',
        name: '밤의 독서회',
        password: 'short',
      }).success,
    ).toBe(false)
  })
})

describe('parseJoinCommunityRoomResult', () => {
  it('RPC의 단일 입장 결과에서 방 식별자를 반환한다', () => {
    expect(
      parseJoinCommunityRoomResult([
        {
          joined: true,
          member_id: '33333333-3333-4333-8333-333333333333',
          room_id: '22222222-2222-4222-8222-222222222222',
        },
      ]),
    ).toEqual({
      joined: true,
      memberId: '33333333-3333-4333-8333-333333333333',
      roomId: '22222222-2222-4222-8222-222222222222',
    })
  })
})
