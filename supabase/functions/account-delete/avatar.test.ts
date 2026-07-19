import { assertEquals } from 'jsr:@std/assert@1.0.14'

import { deleteProfileAvatar } from './avatar.ts'

Deno.test('계정 삭제 전 해당 사용자의 private 프로필 사진만 삭제한다', async () => {
  const paths: string[][] = []
  const result = await deleteProfileAvatar(
    {
      storage: {
        from: () => ({
          remove: async (targetPaths: string[]) => {
            paths.push(targetPaths)
            return { error: null }
          },
        }),
      },
    },
    '00000000-0000-0000-0000-000000000184',
  )

  assertEquals(result, true)
  assertEquals(paths, [['profiles/00000000-0000-0000-0000-000000000184/avatar']])
})

Deno.test('프로필 사진 삭제 오류는 Auth 계정 삭제를 시작하지 않도록 false를 반환한다', async () => {
  const result = await deleteProfileAvatar(
    {
      storage: {
        from: () => ({ remove: async () => ({ error: new Error('storage unavailable') }) }),
      },
    },
    '00000000-0000-0000-0000-000000000184',
  )

  assertEquals(result, false)
})
