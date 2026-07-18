create table public.user_legal_consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  document_type text not null,
  document_version text not null,
  consented_at timestamptz not null default now(),
  constraint user_legal_consents_document_type
    check (document_type in ('terms', 'privacy')),
  constraint user_legal_consents_document_version_not_blank
    check (char_length(btrim(document_version)) between 1 and 32),
  constraint user_legal_consents_unique_version
    unique (profile_id, document_type, document_version)
);

create index user_legal_consents_profile_id_consented_at_idx
on public.user_legal_consents (profile_id, consented_at desc);

alter table public.user_legal_consents enable row level security;

revoke all on table public.user_legal_consents from anon, authenticated;
grant select on table public.user_legal_consents to authenticated;

create policy user_legal_consents_select_self
on public.user_legal_consents
for select
to authenticated
using ((select auth.uid()) = profile_id);

create or replace function public.record_required_legal_consents(
  p_terms_version text,
  p_privacy_version text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = 'P0001', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if char_length(btrim(p_terms_version)) not between 1 and 32
    or char_length(btrim(p_privacy_version)) not between 1 and 32 then
    raise exception using errcode = 'P0001', message = 'LEGAL_DOCUMENT_VERSION_INVALID';
  end if;

  insert into public.user_legal_consents (profile_id, document_type, document_version)
  values
    ((select auth.uid()), 'terms', p_terms_version),
    ((select auth.uid()), 'privacy', p_privacy_version)
  on conflict (profile_id, document_type, document_version) do nothing;
end;
$$;

revoke all on function public.record_required_legal_consents(text, text) from public, anon;
grant execute on function public.record_required_legal_consents(text, text) to authenticated;

comment on table public.user_legal_consents is
'Versioned mandatory terms and privacy consent records for Talk후감 accounts';
comment on column public.user_legal_consents.document_type is
'Required launch document kind: terms or privacy';
comment on function public.record_required_legal_consents(text, text) is
'Records the current required Terms and Privacy versions for the authenticated account';
