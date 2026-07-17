alter table public.profiles
add column onboarding_completed_at timestamptz;

grant update (onboarding_completed_at) on table public.profiles to authenticated;

comment on column public.profiles.onboarding_completed_at is
'Null until the user completes the first-run onboarding flow';
