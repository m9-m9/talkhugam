import { createMobileAuthRedirectUri } from '@talkhugam/domain'

import { completeMobileOAuth } from './completeMobileOAuth'
import { type MobileOAuthProvider, startMobileOAuth } from './startMobileOAuth'

type MobileOAuthClient = Parameters<typeof startMobileOAuth>[0] &
  Parameters<typeof completeMobileOAuth>[0]

type MobileOAuthBrowser = {
  openAuthSessionAsync(
    url: string,
    returnUrl: string,
  ): Promise<{ type: 'success'; url: string } | { type: string }>
}

/** 소셜 로그인 브라우저를 열고 성공한 앱 복귀 주소의 세션 교환 결과를 반환한다. */
export async function openMobileOAuthSession(
  client: MobileOAuthClient,
  provider: MobileOAuthProvider,
  browser: MobileOAuthBrowser,
): Promise<'authenticated' | 'cancelled'> {
  const returnUrl = createMobileAuthRedirectUri()
  const url = await startMobileOAuth(client, provider)
  const result = await browser.openAuthSessionAsync(url, returnUrl)

  if (result.type !== 'success' || !('url' in result)) return 'cancelled'

  await completeMobileOAuth(client, result.url)
  return 'authenticated'
}
