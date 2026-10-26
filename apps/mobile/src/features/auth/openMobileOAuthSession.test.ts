import { describe, expect, it } from 'vitest'

import { openMobileOAuthSession } from './openMobileOAuthSession'

describe('openMobileOAuthSession', () => {
  it('opens the provider URL and exchanges the successful app callback', async () => {
    let receivedBrowserRequest: unknown
    let receivedCode: string | null = null
    const client = {
      auth: {
        exchangeCodeForSession: async (code: string) => {
          receivedCode = code
          return { error: null }
        },
        signInWithOAuth: async () => ({
          data: { url: 'https://accounts.example.test/login' },
          error: null,
        }),
      },
    }
    const browser = {
      openAuthSessionAsync: async (url: string, returnUrl: string) => {
        receivedBrowserRequest = { returnUrl, url }
        return { type: 'success' as const, url: 'talkhugam://auth/callback?code=pkce-code' }
      },
    }

    await expect(openMobileOAuthSession(client, 'google', browser)).resolves.toBe('authenticated')
    expect(receivedBrowserRequest).toEqual({
      returnUrl: 'talkhugam://auth/callback',
      url: 'https://accounts.example.test/login',
    })
    expect(receivedCode).toBe('pkce-code')
  })

  it('does not exchange a session when the user cancels the browser flow', async () => {
    let exchangeCount = 0
    const client = {
      auth: {
        exchangeCodeForSession: async () => {
          exchangeCount += 1
          return { error: null }
        },
        signInWithOAuth: async () => ({
          data: { url: 'https://accounts.example.test/login' },
          error: null,
        }),
      },
    }
    const browser = {
      openAuthSessionAsync: async () => ({ type: 'cancel' as const }),
    }

    await expect(openMobileOAuthSession(client, 'kakao', browser)).resolves.toBe('cancelled')
    expect(exchangeCount).toBe(0)
  })

  it.each([{ type: 'dismiss' }, { type: 'locked' }, { type: 'success' }])(
    'does not exchange a session for a $type browser result',
    async (browserResult) => {
      let exchangeCount = 0
      const client = {
        auth: {
          exchangeCodeForSession: async () => {
            exchangeCount += 1
            return { error: null }
          },
          signInWithOAuth: async () => ({
            data: { url: 'https://accounts.example.test/login' },
            error: null,
          }),
        },
      }
      const browser = {
        openAuthSessionAsync: async () => browserResult,
      }

      await expect(openMobileOAuthSession(client, 'google', browser)).resolves.toBe('cancelled')
      expect(exchangeCount).toBe(0)
    },
  )
})
