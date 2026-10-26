-- 개인정보처리방침 개정(완독 기록 -> 책별 별점·총평)에 맞춰 필수 동의 버전을 올린다.
-- 새 앱은 packages/domain 의 legalDocumentVersion(2026-10-26.1) 동의가 없으면 다시 동의를 요구한다.
-- 전환 단계: DB 마이그레이션과 웹 배포·모바일 빌드 배포 시점이 어긋나는 동안 옛 클라이언트도
-- 동의를 저장할 수 있도록 이전 버전(2026-07-18.2)도 함께 받는다. 그 밖의 버전은 거부한다.
-- 이전 버전 허용은 후속 마이그레이션에서 제거한다.
create or replace function public.record_required_legal_consents(
  p_terms_version text,
  p_privacy_version text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_accepted_document_versions constant text[] := array['2026-10-26.1', '2026-07-18.2'];
begin
  if (select auth.uid()) is null then
    raise exception using errcode = 'P0001', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if p_terms_version is null
    or p_privacy_version is null
    or char_length(btrim(p_terms_version)) not between 1 and 32
    or char_length(btrim(p_privacy_version)) not between 1 and 32 then
    raise exception using errcode = 'P0001', message = 'LEGAL_DOCUMENT_VERSION_INVALID';
  end if;

  if not (p_terms_version = any (v_accepted_document_versions))
    or not (p_privacy_version = any (v_accepted_document_versions)) then
    raise exception using errcode = 'P0001', message = 'LEGAL_DOCUMENT_VERSION_REQUIRED';
  end if;

  insert into public.user_legal_consents (profile_id, document_type, document_version)
  values
    ((select auth.uid()), 'terms', p_terms_version),
    ((select auth.uid()), 'privacy', p_privacy_version)
  on conflict (profile_id, document_type, document_version) do nothing;
end;
$$;

comment on function public.record_required_legal_consents(text, text) is
'인증된 사용자의 이용약관·개인정보처리방침 동의를 기록한다. 전환 단계라 현재 버전 2026-10-26.1과 이전 버전 2026-07-18.2만 받고 그 밖의 버전은 거부한다. 이전 버전 허용은 웹·모바일 배포가 끝난 뒤 후속 마이그레이션에서 제거한다';
