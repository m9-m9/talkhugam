import { describe, expect, it } from 'vitest'

import { startMobileOAuth } from './startMobileOAuth'

describe('startMobileOAuth', () => {
  it('requests Google OAuth with the registered mobile callback URI', async () => {
    let receivedOptions: unknown
    const client = {
      auth: {
        signInWithOAuth: async (options: unknown) => {
          receivedOptions = options
          return { data: { url: 'https://accounts.example.test/login' }, error: null }
        },
      },
    }

    await expect(startMobileOAuth(client, 'google')).resolves.toBe(
      'https://accounts.example.test/login',
    )
    expect(receivedOptions).toEqual({
      options: { redirectTo: 'talkhugam://auth/callback', skipBrowserRedirect: true },
      provider: 'google',
    })
  })

  it('rejects an OAuth response that does not include a browser URL', async () => {
    const client = {
      auth: {
        signInWithOAuth: async () => ({ data: { url: null }, error: null }),
      },
    }

    await expect(startMobileOAuth(client, 'kakao')).rejects.toThrow(
      '로그인 주소를 준비하지 못했어요.',
    )
  })
})
