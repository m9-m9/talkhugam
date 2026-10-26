import { describe, expect, it } from 'vitest'

import {
  canBanCommunityMember,
  canManageRoomContent,
  canManageRoomMembers,
  formatRoomRoleLabel,
  parseRoomRole,
  roomRoleKeys,
} from './roomPermission'

describe('roomPermission', () => {
  it('allows owners and managers to manage invites and book chats', () => {
    expect(canManageRoomContent('owner')).toBe(true)
    expect(canManageRoomContent('manager')).toBe(true)
    expect(canManageRoomContent('member')).toBe(false)
    expect(canManageRoomContent(null)).toBe(false)
  })

  it('reserves member management for the owner', () => {
    expect(canManageRoomMembers('owner')).toBe(true)
    expect(canManageRoomMembers('manager')).toBe(false)
    expect(canManageRoomMembers('member')).toBe(false)
    expect(canManageRoomMembers(null)).toBe(false)
  })

  it('lets a manager ban only regular members in an open bookstore', () => {
    expect(canBanCommunityMember('owner', 'manager')).toBe(true)
    expect(canBanCommunityMember('owner', 'member')).toBe(true)
    expect(canBanCommunityMember('owner', 'owner')).toBe(false)
    expect(canBanCommunityMember('manager', 'member')).toBe(true)
    expect(canBanCommunityMember('manager', 'manager')).toBe(false)
    expect(canBanCommunityMember('manager', 'owner')).toBe(false)
    expect(canBanCommunityMember('member', 'member')).toBe(false)
    expect(canBanCommunityMember(null, 'member')).toBe(false)
  })

  it('labels each role with the product wording', () => {
    expect(formatRoomRoleLabel('owner')).toBe('방장')
    expect(formatRoomRoleLabel('manager')).toBe('운영자')
    expect(formatRoomRoleLabel('member')).toBe('멤버')
  })

  it('parses a server role and keeps null for non-members', () => {
    expect(parseRoomRole('manager')).toBe('manager')
    expect(parseRoomRole(null)).toBeNull()
    expect(() => parseRoomRole('admin')).toThrow()
  })

  it('builds a stable query key per room', () => {
    expect(roomRoleKeys.mine('f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e')).toEqual([
      'room-role',
      'f17c0d6d-3e6e-4b7f-a1f1-5d652aa2a85e',
    ])
  })
})
