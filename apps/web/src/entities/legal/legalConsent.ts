import type { SupabaseClient } from '@supabase/supabase-js'
import {
  hasRequiredLegalConsent,
  legalDocumentVersion,
  parseLegalConsentRecords,
} from '@talkhugam/domain'

export { hasRequiredLegalConsent } from '@talkhugam/domain'

/** 현재 사용자의 최신 정책 동의 상태를 조회한다. */
export async function getHasRequiredLegalConsent(
  client: SupabaseClient,
  profileId: string,
): Promise<boolean> {
  const response = await client
    .from('user_legal_consents')
    .select('document_type, document_version')
    .eq('profile_id', profileId)

  if (response.error) throw response.error

  return hasRequiredLegalConsent(parseLegalConsentRecords(response.data))
}

/** 현재 필수 정책 문서의 동의 시각을 사용자 계정에 저장한다. */
export async function saveRequiredLegalConsents(client: SupabaseClient): Promise<void> {
  const response = await client.rpc('record_required_legal_consents', {
    p_privacy_version: legalDocumentVersion,
    p_terms_version: legalDocumentVersion,
  })

  if (response.error) throw response.error
}
