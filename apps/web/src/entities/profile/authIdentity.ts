import { z } from 'zod'

const appMetadataSchema = z.object({
  provider: z.string().optional(),
  providers: z.array(z.string()).optional(),
})

const providerLabels: Record<string, string> = {
  google: 'Google',
  kakao: '카카오',
  naver: '네이버',
}

/** 로그인 provider 식별자를 화면 표시용 이름으로 변환한다. */
export function getProviderLabels(appMetadata: unknown): string[] {
  const metadata = appMetadataSchema.parse(appMetadata)
  const providers = metadata.providers ?? (metadata.provider ? [metadata.provider] : [])

  return providers.map((provider) => providerLabels[provider] ?? provider)
}
