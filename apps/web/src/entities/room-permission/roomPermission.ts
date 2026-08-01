export const roomRoles = ['owner', 'manager', 'member'] as const

export type RoomRole = (typeof roomRoles)[number]

/** 책방 역할이 초대와 읽을 책 관리 권한을 갖는지 반환한다. */
export function canManageRoomContent(role: RoomRole): boolean {
  return role === 'owner' || role === 'manager'
}

/** 책방 역할이 멤버 권한과 구성원을 관리할 수 있는지 반환한다. */
export function canManageRoomMembers(role: RoomRole): boolean {
  return role === 'owner'
}

/** 책방 역할이 읽을 책 또는 초대를 요청해야 하는지 반환한다. */
export function canRequestRoomContent(role: RoomRole): boolean {
  return role === 'member'
}
