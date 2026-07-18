import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { useAuthenticatedUser } from '../../features/auth'
import { AppHeader } from '../../shared/ui/AppHeader'

const naverMetadataSchema = z
  .object({
    birthday: z.string().min(1).optional(),
    birthyear: z.string().min(1).optional(),
    gender: z.string().min(1).optional(),
    mobile: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    nickname: z.string().min(1).optional(),
  })
  .passthrough()

type NaverAccountField = {
  label: string
  value: string
}

/** Naver 인증에서 실제로 제공된 정보만 읽기 전용으로 보여 준다. */
export function NaverAccountInfoPage() {
  const navigate = useNavigate()
  const user = useAuthenticatedUser()
  const fields = createNaverAccountFields(user.email, user.userMetadata)

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate('/profile/settings')} title="회원정보" />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">Naver 계정</p>
        <h1 className="text-ink mt-2 text-2xl font-bold">Naver 제공 정보</h1>
        <p className="text-ink-subtle mt-2 text-sm">
          로그인에 제공된 정보만 확인할 수 있어요. 이 화면에서 수정되지는 않아요.
        </p>
      </header>

      <dl className="border-ink/10 mt-12 overflow-hidden rounded-lg border bg-white">
        {fields.map((field) => (
          <div
            className="border-ink/10 flex min-h-12 items-center justify-between gap-6 border-b px-4 py-3 last:border-b-0"
            key={field.label}
          >
            <dt className="text-ink-subtle text-sm">{field.label}</dt>
            <dd className="text-ink max-w-48 text-right text-sm">{field.value}</dd>
          </div>
        ))}
      </dl>
    </main>
  )
}

/** 인증 메타데이터를 사용자에게 노출 가능한 Naver 제공 정보로 정규화한다. */
function createNaverAccountFields(email: string | null, metadata: unknown): NaverAccountField[] {
  const parsedMetadata = naverMetadataSchema.safeParse(metadata)
  const source = parsedMetadata.success ? parsedMetadata.data : {}
  const name = source.name ?? source.nickname ?? '제공되지 않음'
  const birthDate = formatNaverBirthDate(source.birthyear, source.birthday)

  return [
    { label: '회원이름', value: name },
    { label: '이메일 주소', value: email ?? '제공되지 않음' },
    { label: '성별', value: formatNaverGender(source.gender) },
    { label: '생일', value: birthDate },
    { label: '휴대전화번호', value: source.mobile ?? '제공되지 않음' },
  ]
}

/** Naver의 성별 코드 또는 원문 값을 화면 친화적인 한국어로 변환한다. */
function formatNaverGender(value: string | undefined): string {
  if (value === 'M') return '남성'
  if (value === 'F') return '여성'
  return value ?? '제공되지 않음'
}

/** Naver에서 제공한 생년과 생일을 안전한 한 줄 정보로 결합한다. */
function formatNaverBirthDate(year: string | undefined, birthday: string | undefined): string {
  if (!year && !birthday) return '제공되지 않음'
  return [year, birthday].filter(Boolean).join('-')
}
