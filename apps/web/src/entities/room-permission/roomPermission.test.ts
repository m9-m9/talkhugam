import { describe, expect, it } from 'vitest'

import {
  canManageRoomContent,
  canManageRoomMembers,
  canRequestRoomContent,
} from './roomPermission'

describe('room permission rules', () => {
  it('allows owners and managers to manage invitations and books', () => {
    expect(canManageRoomContent('owner')).toBe(true)
    expect(canManageRoomContent('manager')).toBe(true)
    expect(canManageRoomContent('member')).toBe(false)
  })

  it('reserves member roles and removal actions for the owner', () => {
    expect(canManageRoomMembers('owner')).toBe(true)
    expect(canManageRoomMembers('manager')).toBe(false)
    expect(canManageRoomMembers('member')).toBe(false)
  })

  it('allows a member to request content without granting management authority', () => {
    expect(canRequestRoomContent('owner')).toBe(false)
    expect(canRequestRoomContent('manager')).toBe(false)
    expect(canRequestRoomContent('member')).toBe(true)
  })
})
