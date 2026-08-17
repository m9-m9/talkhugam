import { describe, expect, it } from 'vitest'

import { completeMobileOAuth } from './completeMobileOAuth'

describe('completeMobileOAuth', () => {
  it('exchanges the PKCE code returned to the registered app callback', async () => {
    let receivedCode: string | null = null
    const client = {
      auth: {
        exchangeCodeForSession: async (code: string) => {
          receivedCode = code
          return { error: null }
        },
      },
    }

    await expect(
      completeMobileOAuth(client, 'talkhugam://auth/callback?code=pkce-code'),
    ).resolves.toBeUndefined()
    expect(receivedCode).toBe('pkce-code')
  })

  it('rejects a callback that does not contain an OAuth code', async () => {
    let callCount = 0
    const client = {
      auth: {
        exchangeCodeForSession: async () => {
          callCount += 1
          return { error: null }
        },
      },
    }

    await expect(completeMobileOAuth(client, 'talkhugam://auth/callback')).rejects.toThrow(
      '로그인 정보를 확인하지 못했어요.',
    )
    expect(callCount).toBe(0)
  })

  it.each([
    'https://auth/callback?code=pkce-code',
    'talkhugam://other/callback?code=pkce-code',
    'talkhugam://auth/other?code=pkce-code',
    'not a callback url',
  ])('rejects an unregistered callback URL: %s', async (callbackUrl) => {
    let callCount = 0
    const client = {
      auth: {
        exchangeCodeForSession: async () => {
          callCount += 1
          return { error: null }
        },
      },
    }

    await expect(completeMobileOAuth(client, callbackUrl)).rejects.toThrow(
      '로그인 정보를 확인하지 못했어요.',
    )
    expect(callCount).toBe(0)
  })

  it('rejects a provider error without exchanging a session', async () => {
    let callCount = 0
    const client = {
      auth: {
        exchangeCodeForSession: async () => {
          callCount += 1
          return { error: null }
        },
      },
    }

    await expect(
      completeMobileOAuth(client, 'talkhugam://auth/callback?error=access_denied'),
    ).rejects.toThrow('로그인을 완료하지 못했어요.')
    expect(callCount).toBe(0)
  })

  it('propagates a failed session exchange', async () => {
    const client = {
      auth: {
        exchangeCodeForSession: async () => ({ error: new Error('exchange failed') }),
      },
    }

    await expect(
      completeMobileOAuth(client, 'talkhugam://auth/callback?code=pkce-code'),
    ).rejects.toThrow('exchange failed')
  })
})
