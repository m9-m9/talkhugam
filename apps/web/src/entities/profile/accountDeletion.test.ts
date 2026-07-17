import { FunctionsHttpError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { AccountDeletionError, requestAccountDeletion } from './accountDeletion'

describe('account deletion', () => {
  it('sends the chosen deletion mode to the protected Edge Function', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { deleted: true, requestId: '22222222-2222-4222-8222-222222222222' },
      error: null,
    })

    await expect(
      requestAccountDeletion({ functions: { invoke } }, 'anonymize'),
    ).resolves.toBeUndefined()

    expect(invoke).toHaveBeenCalledWith('account-delete', {
      body: { mode: 'anonymize' },
    })
  })

  it('keeps an owner-transfer failure distinguishable for the UI', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        new Response(
          JSON.stringify({
            error: {
              code: 'OWNER_TRANSFER_REQUIRED',
              message: '먼저 다른 멤버에게 방장을 넘겨 주세요.',
            },
          }),
          { headers: { 'content-type': 'application/json' }, status: 409 },
        ),
      ),
    })

    await expect(
      requestAccountDeletion({ functions: { invoke } }, 'delete_content'),
    ).rejects.toEqual(
      new AccountDeletionError('OWNER_TRANSFER_REQUIRED', '먼저 다른 멤버에게 방장을 넘겨 주세요.'),
    )
  })
})
