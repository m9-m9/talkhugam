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
  v_required_document_version constant text := '2026-07-18.2';
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

  if p_terms_version <> v_required_document_version
    or p_privacy_version <> v_required_document_version then
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
'인증된 사용자가 서버에 고정된 현재 이용약관·개인정보처리방침 버전만 기록하도록 제한한다';
