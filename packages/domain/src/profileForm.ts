import { z } from 'zod'

export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, '이름을 입력해 주세요.')
    .max(30, '이름은 30자까지 입력할 수 있어요.'),
  bio: z.string().trim().max(80, '소개는 80자까지 입력할 수 있어요.').optional(),
})

export type ProfileForm = z.infer<typeof profileFormSchema>

/** 프로필 입력 폼을 저장소가 사용할 공백 없는 도메인 값으로 정규화한다. */
export function normalizeProfileForm(input: ProfileForm): ProfileForm {
  return {
    bio: input.bio?.trim() || undefined,
    displayName: input.displayName.trim(),
  }
}
