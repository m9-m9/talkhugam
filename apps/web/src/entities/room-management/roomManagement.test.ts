import { describe, expect, it } from 'vitest'

import {
  parseArchivedRooms,
  parseRoomInvites,
  parseRoomManagement,
  roomManagementKeys,
} from './roomManagement'

const roomId = 'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e'
const ownerProfileId = 'ed0d57f4-2f7a-49bb-9c6b-0d724fcb0e55'

describe('parseRoomManagement', () => {
  it('maps the room and active members to the management domain model', () => {
    expect(
      parseRoomManagement(
        {
          created_by: ownerProfileId,
          description: '이번 달 함께 읽는 책들',
          id: roomId,
          name: '금요일 아침 독서방',
          status: 'active',
        },
        [
          {
            id: '10ff57f4-2f7a-49bb-9c6b-0d724fcb0e55',
            joined_at: '2026-07-17T02:01:30.123+00:00',
            profile_id: ownerProfileId,
            role: 'owner',
            room_avatar_path: null,
            room_display_name: '민규',
            room_id: roomId,
            status: 'active',
          },
        ],
        ownerProfileId,
      ),
    ).toEqual({
      createdBy: ownerProfileId,
      description: '이번 달 함께 읽는 책들',
      id: roomId,
      isCurrentUserOwner: true,
      members: [
        {
          avatarPath: null,
          displayName: '민규',
          id: '10ff57f4-2f7a-49bb-9c6b-0d724fcb0e55',
          isCurrentUser: true,
          joinedAt: '2026-07-17T02:01:30.123+00:00',
          profileId: ownerProfileId,
          role: 'owner',
        },
      ],
      name: '금요일 아침 독서방',
      status: 'active',
    })
  })

  it('rejects a member that is not active', () => {
    expect(() =>
      parseRoomManagement(
        {
          created_by: ownerProfileId,
          description: null,
          id: roomId,
          name: '금요일 아침 독서방',
          status: 'active',
        },
        [
          {
            id: '10ff57f4-2f7a-49bb-9c6b-0d724fcb0e55',
            joined_at: '2026-07-17T02:01:30.123+00:00',
            profile_id: ownerProfileId,
            role: 'owner',
            room_avatar_path: null,
            room_display_name: '민규',
            room_id: roomId,
            status: 'left',
          },
        ],
        ownerProfileId,
      ),
    ).toThrow()
  })
})

describe('parseRoomInvites', () => {
  it('keeps only metadata that is safe to show after an invite is created', () => {
    expect(
      parseRoomInvites([
        {
          created_at: '2026-07-17T02:01:30.123+00:00',
          expires_at: '2026-07-24T02:01:30.123+00:00',
          id: '00ff57f4-2f7a-49bb-9c6b-0d724fcb0e55',
          max_uses: 6,
          revoked_at: null,
          use_count: 2,
        },
      ]),
    ).toEqual([
      {
        createdAt: '2026-07-17T02:01:30.123+00:00',
        expiresAt: '2026-07-24T02:01:30.123+00:00',
        id: '00ff57f4-2f7a-49bb-9c6b-0d724fcb0e55',
        maxUses: 6,
        revokedAt: null,
        useCount: 2,
      },
    ])
  })
})

describe('parseArchivedRooms', () => {
  it('maps archive summaries without exposing raw database names to UI callers', () => {
    expect(
      parseArchivedRooms([
        {
          archived_at: '2026-07-17T02:01:30.123+00:00',
          description: '함께 읽었던 기록',
          id: roomId,
          name: '지난 독서방',
        },
      ]),
    ).toEqual([
      {
        archivedAt: '2026-07-17T02:01:30.123+00:00',
        description: '함께 읽었던 기록',
        id: roomId,
        name: '지난 독서방',
      },
    ])
  })
})

describe('roomManagementKeys', () => {
  it('creates stable keys for room-specific server state', () => {
    expect(roomManagementKeys.detail(roomId)).toEqual(['room-management', roomId])
    expect(roomManagementKeys.archive).toEqual(['room-management', 'archive'])
  })
})
