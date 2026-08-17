import { legalDocumentVersion } from '@talkhugam/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

/** 인증된 사용자의 필수 약관 동의를 전용 RPC로만 저장한다. */
export async function saveMobileRequiredLegalConsents(
  client: SupabaseClient,
): Promise<void> {
  const response = await client.rpc('record_required_legal_consents', {
    p_privacy_version: legalDocumentVersion,
    p_terms_version: legalDocumentVersion,
  })

  if (response.error) throw response.error
}
