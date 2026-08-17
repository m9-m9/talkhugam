import type { AuthDestination } from '@talkhugam/domain'
import { parseInviteToken } from '@talkhugam/domain'

const roomsPath = '/rooms'
const createRoomPath = '/rooms/create'
const joinRoomPath = '/rooms/join'

export type MobileReturnPath = typeof roomsPath | typeof createRoomPath | `${typeof joinRoomPath}?invite=${string}`

/** 외부 쿼리에서 받은 복귀 경로가 앱 내부의 허용된 책방 경로인지 검증한다. */
export function parseMobileReturnPath(value: unknown): MobileReturnPath | null {
  if (value === roomsPath || value === createRoomPath) return value
  if (typeof value !== 'string') return null

  const joinPath = new URL(value, 'talkhugam://local')
  if (joinPath.origin !== 'null' || joinPath.pathname !== joinRoomPath) return null
  if (joinPath.searchParams.size !== 1) return null

  const inviteToken = parseInviteToken(joinPath.searchParams.get('invite'))
  return inviteToken === null ? null : `${joinRoomPath}?invite=${inviteToken}`
}

/** 인증이 없는 사용자를 로그인 화면으로 보내면서 검증된 내부 복귀 경로만 URL에 보존한다. */
export function createMobileLoginRoute(returnPath: MobileReturnPath | null): string {
  if (returnPath === null) return '/'

  return `/?returnTo=${encodeURIComponent(returnPath)}`
}

/** 계정 상태별 중간 화면을 거친 뒤 최종 책방 복귀 경로를 안전하게 결정한다. */
export function createMobileAuthenticatedRoute(
  destination: AuthDestination,
  returnPath: MobileReturnPath | null,
): string {
  if (destination === roomsPath && returnPath !== null) return returnPath
  if (returnPath === null) return destination

  return `${destination}?returnTo=${encodeURIComponent(returnPath)}`
}
