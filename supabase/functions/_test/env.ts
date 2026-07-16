type EnvValues = Readonly<Record<string, string>>

function restoreEnv(previousValues: ReadonlyMap<string, string | undefined>): void {
  for (const [name, value] of previousValues) {
    if (value === undefined) Deno.env.delete(name)
    else Deno.env.set(name, value)
  }
}

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
