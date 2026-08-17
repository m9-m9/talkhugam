type MobileOAuthCompletionClient = {
  auth: {
    exchangeCodeForSession(code: string): Promise<{ error: Error | null }>
  }
}

/** 외부 앱 링크를 Talk후감에 등록된 OAuth 복귀 URI로 검증해 반환한다. */
function parseMobileOAuthCallback(callbackUrl: string): URL {
  let url: URL

  try {
    url = new URL(callbackUrl)
  } catch {
    throw new Error('로그인 정보를 확인하지 못했어요.')
  }

  if (url.protocol !== 'talkhugam:' || url.host !== 'auth' || url.pathname !== '/callback') {
    throw new Error('로그인 정보를 확인하지 못했어요.')
  }

  return url
}

/** 앱 복귀 URI의 PKCE code를 Supabase 세션으로 교환한다. */
export async function completeMobileOAuth(
  client: MobileOAuthCompletionClient,
  callbackUrl: string,
): Promise<void> {
  const callback = parseMobileOAuthCallback(callbackUrl)
  if (callback.searchParams.has('error')) throw new Error('로그인을 완료하지 못했어요.')

  const code = callback.searchParams.get('code')
  if (!code) throw new Error('로그인 정보를 확인하지 못했어요.')

  const response = await client.auth.exchangeCodeForSession(code)
  if (response.error) throw response.error
}
