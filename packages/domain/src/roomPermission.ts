import { z } from 'zod'

export const roomRoleSchema = z.enum(['owner', 'manager', 'member'])

export type RoomRole = z.infer<typeof roomRoleSchema>

const roomRoleLabels: Record<RoomRole, string> = {
  manager: '운영자',
  member: '멤버',
  owner: '방장',
}

/** 웹과 모바일이 같은 키로 현재 사용자의 책방 역할을 캐시하도록 Query Key를 제공한다. */
export const roomRoleKeys = {
  /** 책방 식별자로 현재 사용자 역할 query key를 만든다. */
  mine: (roomId: string) => ['room-role', roomId] as const,
}

/** 서버가 돌려준 현재 역할 값을 검증하고, 활성 멤버가 아니면 null로 반환한다. */
export function parseRoomRole(value: unknown): RoomRole | null {
  return roomRoleSchema.nullable().parse(value)
}

/** 역할이 초대와 책 대화 추가·보관 같은 콘텐츠 관리 권한을 갖는지 반환한다. */
export function canManageRoomContent(role: RoomRole | null): boolean {
  return role === 'owner' || role === 'manager'
}

/** 역할이 역할 변경·내보내기·방장 이양·책방 설정 같은 구성원 관리 권한을 갖는지 반환한다. */
export function canManageRoomMembers(role: RoomRole | null): boolean {
  return role === 'owner'
}

/** 오픈 책방에서 제재하는 사람과 대상의 역할을 비교해 퇴장·차단 허용 여부를 반환한다. */
export function canBanCommunityMember(actorRole: RoomRole | null, targetRole: RoomRole): boolean {
  if (actorRole === 'owner') return targetRole !== 'owner'
  if (actorRole === 'manager') return targetRole === 'member'
  return false
}

/** 책방 역할을 화면에 보여 줄 한글 이름으로 바꾼다. */
export function formatRoomRoleLabel(role: RoomRole): string {
  return roomRoleLabels[role]
}
