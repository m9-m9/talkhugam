export type AccountDeletionFinalization = {
  attempts: number
  isCompleted: boolean
}

export type AccountDeletionExecution = {
  completionPending: boolean
  deleted: true
}

/** 계정 삭제 완료 기록을 제한된 횟수 안에서 다시 시도한다. */
export async function retryAccountDeletionFinalization(
  finalize: () => Promise<boolean>,
  maximumAttempts = 3,
): Promise<AccountDeletionFinalization> {
  let attempts = 0

  while (attempts < maximumAttempts) {
    attempts += 1
    try {
      if (await finalize()) return { attempts, isCompleted: true }
    } catch {
      continue
    }
  }

  return { attempts, isCompleted: false }
}

/** Auth 삭제와 완료 기록을 순서대로 실행해 사용자에게 돌려줄 결과를 만든다. */
export async function executeAccountDeletion(
  deleteAuthUser: () => Promise<boolean>,
  finalize: () => Promise<boolean>,
): Promise<AccountDeletionExecution> {
  const isAuthDeleted = await deleteAuthUser()
  if (!isAuthDeleted) throw new Error('Auth user deletion failed')

  const finalization = await retryAccountDeletionFinalization(finalize)
  return { completionPending: !finalization.isCompleted, deleted: true }
}
