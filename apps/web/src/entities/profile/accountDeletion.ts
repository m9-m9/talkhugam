import { FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'

const accountDeletionModeSchema = z.enum(['anonymize', 'delete_content'])
const accountDeletionSuccessSchema = z.object({
  deleted: z.literal(true),
  requestId: z.string().uuid(),
})
const accountDeletionFailureSchema = z.object({
  error: z.object({
    code: z.enum([
      'OWNER_TRANSFER_REQUIRED',
      'AUTH_REQUIRED',
      'INTERNAL_ERROR',
      'VALIDATION_FAILED',
    ]),
    message: z.string().min(1),
  }),
})

export type AccountDeletionMode = z.infer<typeof accountDeletionModeSchema>
export type AccountDeletionErrorCode = z.infer<typeof accountDeletionFailureSchema>['error']['code']

type AccountDeletionClient = {
  functions: {
    invoke: (
      functionName: string,
      options: { body: { mode: AccountDeletionMode } },
    ) => Promise<{ data: unknown; error: unknown }>
  }
}

/** 계정 삭제 요청 실패를 UI가 구분할 수 있는 오류로 표현한다. */
export class AccountDeletionError extends Error {
  /** 오류 코드와 사용자에게 표시할 설명을 초기화한다. */
  constructor(
    public readonly code: AccountDeletionErrorCode | 'UNKNOWN',
    message: string,
  ) {
    super(message)
    this.name = 'AccountDeletionError'
  }
}

/** 현재 사용자의 계정 삭제를 보호된 Edge Function에 요청한다. */
export async function requestAccountDeletion(
  client: AccountDeletionClient,
  mode: AccountDeletionMode,
): Promise<void> {
  const selectedMode = accountDeletionModeSchema.parse(mode)
  const response = await client.functions.invoke('account-delete', {
    body: { mode: selectedMode },
  })

  if (response.error) throw await mapAccountDeletionError(response.error)
  accountDeletionSuccessSchema.parse(response.data)
}

/** Edge Function 응답 오류를 계정 삭제 도메인 오류로 변환한다. */
async function mapAccountDeletionError(error: unknown): Promise<AccountDeletionError> {
  if (error instanceof FunctionsHttpError && isJsonResponse(error.context)) {
    const payload = await error.context.json().catch(() => null)
    const parsed = accountDeletionFailureSchema.safeParse(payload)
    if (parsed.success)
      return new AccountDeletionError(parsed.data.error.code, parsed.data.error.message)
  }

  return new AccountDeletionError(
    'UNKNOWN',
    '계정 삭제를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
  )
}

/** JSON 응답을 읽을 수 있는 객체인지 판별한다. */
function isJsonResponse(value: unknown): value is Pick<Response, 'json'> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'json' in value &&
    typeof value.json === 'function'
  )
}
