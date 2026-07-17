type EnvValues = Readonly<Record<string, string>>

/** 환경변수을 이전 상태로 복원한다. */
function restoreEnv(previousValues: ReadonlyMap<string, string | undefined>): void {
  for (const [name, value] of previousValues) {
    if (value === undefined) Deno.env.delete(name)
    else Deno.env.set(name, value)
  }
}

/** 테스트 동안 환경변수를 임시로 바꾸고 종료 후 원래 값으로 복원한다. */
export async function withEnv<T>(values: EnvValues, run: () => T | Promise<T>): Promise<T> {
  const previousValues = new Map<string, string | undefined>()

  for (const [name, value] of Object.entries(values)) {
    previousValues.set(name, Deno.env.get(name))
    Deno.env.set(name, value)
  }

  try {
    return await run()
  } finally {
    restoreEnv(previousValues)
  }
}
