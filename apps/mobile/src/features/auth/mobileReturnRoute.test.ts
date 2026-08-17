import { describe, expect, it } from 'vitest'

import {
  createMobileAuthenticatedRoute,
  createMobileLoginRoute,
  parseMobileReturnPath,
  type MobileReturnPath,
} from './mobileReturnRoute'

const inviteToken = 'a'.repeat(64)

/** 유효한 초대 토큰으로 만든 테스트 복귀 경로를 타입 안전하게 반환한다. */
function createInvitePath(): MobileReturnPath {
  const invitePath = parseMobileReturnPath(`/rooms/join?invite=${inviteToken}`)
  if (invitePath === null) throw new Error('테스트 초대 경로를 만들지 못했어요.')

  return invitePath
}

describe('mobileReturnRoute', () => {
  it('preserves a verified invite path until required legal consent and onboarding are complete', () => {
    const invitePath = createInvitePath()

    expect(createMobileLoginRoute(invitePath)).toBe(`/?returnTo=${encodeURIComponent(invitePath)}`)
    expect(createMobileAuthenticatedRoute('/legal-consent', invitePath)).toBe(
      `/legal-consent?returnTo=${encodeURIComponent(invitePath)}`,
    )
    expect(createMobileAuthenticatedRoute('/onboarding', invitePath)).toBe(
      `/onboarding?returnTo=${encodeURIComponent(invitePath)}`,
    )
    expect(createMobileAuthenticatedRoute('/rooms', invitePath)).toBe(invitePath)
  })

  it('rejects non-local and malformed return paths before routing', () => {
    const invitePath = createInvitePath()

    expect(parseMobileReturnPath('https://attacker.example')).toBeNull()
    expect(parseMobileReturnPath('/rooms/join?invite=TALK87')).toBeNull()
    expect(parseMobileReturnPath(invitePath)).toBe(invitePath)
  })
})
