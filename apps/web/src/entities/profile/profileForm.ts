import { z } from 'zod'

const mbtiValues = [
  'ISTJ',
  'ISFJ',
  'INFJ',
  'INTJ',
  'ISTP',
  'ISFP',
  'INFP',
  'INTP',
  'ESTP',
  'ESFP',
  'ENFP',
  'ENTP',
  'ESTJ',
  'ESFJ',
  'ENFJ',
  'ENTJ',
] as const

export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, '이름을 입력해 주세요.')
    .max(30, '이름은 30자까지 입력할 수 있어요.'),
  bio: z.string().trim().max(80, '소개는 80자까지 입력할 수 있어요.').optional(),
  mbti: z.enum(mbtiValues).nullable(),
})

export type ProfileForm = z.infer<typeof profileFormSchema>

/** 프로필 입력 폼을 내부 표준 형식으로 정규화한다. */
export function normalizeProfileForm(input: ProfileForm): ProfileForm {
  return {
    displayName: input.displayName.trim(),
    bio: input.bio?.trim() || undefined,
    mbti: input.mbti,
  }
}
