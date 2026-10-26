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

const profileUpdateRowSchema = z.object({
  id: z.string().uuid(),
})

export type MobileProfile = {
  avatarPath: string | null
  bio: string | null
  displayName: string
  onboardingCompletedAt: string | null
  updatedAt: string
}

/** 현재 Supabase 세션의 UUID를 확인해 회원 전용 저장소가 사용할 식별자를 반환한다. */
export async function getMobileAuthenticatedProfileId(client: SupabaseClient): Promise<string> {
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
  const profileId = await getMobileAuthenticatedProfileId(client)
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
  const profileId = await getMobileAuthenticatedProfileId(client)
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

/** 현재 로그인한 회원의 이름과 소개만 검증해 저장하고 정규화한 폼 값을 반환한다. */
export async function updateMobileProfile(
  client: SupabaseClient,
  input: unknown,
): Promise<ProfileForm> {
  const profile = normalizeProfileForm(profileFormSchema.parse(input))
  const profileId = await getMobileAuthenticatedProfileId(client)
  const response = await client
    .from('profiles')
    .update({ bio: profile.bio ?? null, display_name: profile.displayName })
    .eq('id', profileId)
    .select('id')
    .single()

  if (response.error) throw response.error
  profileUpdateRowSchema.parse(response.data)
  return profile
}

/** 현재 회원 고정 경로의 private avatar 객체를 교체하고 profiles 행을 갱신한다. */
export async function uploadMobileProfileAvatar(
  client: SupabaseClient,
  input: { file: Blob; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' },
): Promise<string> {
  const profileId = await getMobileAuthenticatedProfileId(client)
  const avatarPath = `${profileId}/avatar`
  const uploadResponse = await client.storage.from('avatars').upload(avatarPath, input.file, {
    contentType: input.mimeType,
    upsert: true,
  })
  if (uploadResponse.error) throw uploadResponse.error
  const profileResponse = await client.from('profiles').update({ avatar_path: avatarPath }).eq('id', profileId).select('id').single()
  if (profileResponse.error) throw profileResponse.error
  profileUpdateRowSchema.parse(profileResponse.data)
  return avatarPath
}

/** 현재 회원에게 허용된 private avatar 객체의 짧은 signed URL을 반환한다. */
export async function getMobileProfileAvatarUrl(client: SupabaseClient, avatarPath: string | null): Promise<string | null> {
  if (!avatarPath) return null
  const response = await client.storage.from('avatars').createSignedUrl(avatarPath, 60 * 60)
  if (response.error) throw response.error
  return response.data.signedUrl
}

/** 보호된 Edge Function에 현재 회원의 계정 삭제 방식을 요청한다. */
export async function requestMobileAccountDeletion(
  client: SupabaseClient,
  mode: 'anonymize' | 'delete_content',
): Promise<void> {
  const response = await client.functions.invoke('account-delete', { body: { mode } })
  if (response.error) throw response.error
}
