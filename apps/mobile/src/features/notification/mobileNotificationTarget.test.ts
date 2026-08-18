import { describe, expect, it } from 'vitest'
import { parseMobileNotificationTargetPath } from './mobileNotificationTarget'

const roomId = '00000000-0000-4000-8000-000000000001'
const bookId = '00000000-0000-4000-8000-000000000002'

describe('parseMobileNotificationTargetPath', () => {
  it('allows only UUID room, book, and manage routes', () => {
    expect(parseMobileNotificationTargetPath('/rooms/' + roomId + '/books/' + bookId))
      .toBe('/rooms/' + roomId + '/books/' + bookId)
    expect(parseMobileNotificationTargetPath('/rooms/' + roomId + '/manage')).toBe('/rooms/' + roomId + '/manage')
  })
  it('rejects external and malformed paths', () => {
    expect(parseMobileNotificationTargetPath('https://evil.example')).toBeNull()
    expect(parseMobileNotificationTargetPath('/rooms/not-a-uuid')).toBeNull()
  })
})
