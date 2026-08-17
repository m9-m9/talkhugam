import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { saveMobileRequiredLegalConsents } from './saveMobileRequiredLegalConsents'

describe('saveMobileRequiredLegalConsents', () => {
  it('records both current documents through the narrow legal-consent RPC', async () => {
    let receivedFunction: string | null = null
    let receivedArguments: unknown = null
    const client = {
      rpc: async (functionName: string, arguments_: unknown) => {
        receivedFunction = functionName
        receivedArguments = arguments_
        return { error: null }
      },
    } as unknown as SupabaseClient

    await saveMobileRequiredLegalConsents(client)

    expect(receivedFunction).toBe('record_required_legal_consents')
    expect(receivedArguments).toEqual({
      p_privacy_version: '2026-07-18.2',
      p_terms_version: '2026-07-18.2',
    })
  })
})
