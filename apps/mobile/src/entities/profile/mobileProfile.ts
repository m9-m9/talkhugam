import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeProfileForm, profileFormSchema, type ProfileForm } from '@talkhugam/domain'
import { z } from 'zod'

const mobileProfileRowSchema = z.object({
  avatar_path: z.string().nullable(),
  bio: z.string().nullable(),
  display_name: z.string().trim().min(1).max(30),
  onboarding_completed_at: z.string().datetime({ offset: true }).nullable(),
  updated_at: z.string().datetime({ offset: true }),
})

const onboardingCompletionRowSchema = z.object({
  onboarding_completed_at: z.string().datetime({ offset: true }),
})

export type MobileProfile = {
  avatarPath: string | null
  bio: string | null
  displayName: string
  onboardingCompletedAt: string | null
  updatedAt: string
}

/** 현재 Supabase 세션의 UUID를 확인해 프로필 쿼리에 사용할 식별자를 반환한다. */
async function getAuthenticatedProfileId(client: SupabaseClient): Promise<string> {
  const userResponse = await client.auth.getUser()
  if (userResponse.error) throw userResponse.error
  if (!userResponse.data.user) throw new Error('로그인 정보를 확인하지 못했어요.')

  return z.string().uuid().parse(userResponse.data.user.id)
}

/** 검증한 profiles 행을 모바일 화면에서 사용할 프로필 모델로 변환한다. */
function mapMobileProfile(input: unknown): MobileProfile {
  const profile = mobileProfileRowSchema.parse(input)
  return {
    avatarPath: profile.avatar_path,
    bio: profile.bio,
    displayName: profile.display_name,
    onboardingCompletedAt: profile.onboarding_completed_at,
    updatedAt: profile.updated_at,
  }
}

/** 현재 로그인한 회원의 프로필만 읽어 모바일 온보딩 모델로 반환한다. */
export async function getMobileProfile(client: SupabaseClient): Promise<MobileProfile> {
  const profileId = await getAuthenticatedProfileId(client)
  const response = await client
    .from('profiles')
    .select('avatar_path, display_name, bio, onboarding_completed_at, updated_at')
    .eq('id', profileId)
    .single()

  if (response.error) throw response.error
  return mapMobileProfile(response.data)
}

/** 현재 로그인한 회원의 프로필과 온보딩 완료 시각을 함께 저장한다. */
export async function completeMobileOnboarding(
  client: SupabaseClient,
  input: unknown,
): Promise<void> {
  const profile = normalizeProfileForm(profileFormSchema.parse(input))
  const profileId = await getAuthenticatedProfileId(client)
  const response = await client
    .from('profiles')
    .update({
      bio: profile.bio ?? null,
      display_name: profile.displayName,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .select('onboarding_completed_at')
    .single()

  if (response.error) throw response.error
  onboardingCompletionRowSchema.parse(response.data)
}
