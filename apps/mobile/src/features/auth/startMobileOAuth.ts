import { createMobileAuthRedirectUri } from '@talkhugam/domain'

export type MobileOAuthProvider = 'google' | 'kakao'

type MobileOAuthResponse = {
  data: { url: string | null } | null
  error: Error | null
}

type MobileOAuthClient = {
  auth: {
    signInWithOAuth(input: {
      options: { redirectTo: string; skipBrowserRedirect: boolean }
      provider: MobileOAuthProvider
    }): Promise<MobileOAuthResponse>
  }
}

/** 소셜 로그인 주소를 요청하고 네이티브 브라우저가 열 URL을 반환한다. */
export async function startMobileOAuth(
  client: MobileOAuthClient,
  provider: MobileOAuthProvider,
): Promise<string> {
  const response = await client.auth.signInWithOAuth({
    options: { redirectTo: createMobileAuthRedirectUri(), skipBrowserRedirect: true },
    provider,
  })

  if (response.error) throw response.error
  if (!response.data?.url) throw new Error('로그인 주소를 준비하지 못했어요.')

  return response.data.url
}
