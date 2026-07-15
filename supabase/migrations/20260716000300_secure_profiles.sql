alter table public.profiles enable row level security;
alter table public.notification_preferences enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.notification_preferences from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, avatar_path, bio, mbti) on table public.profiles to authenticated;

grant select on table public.notification_preferences to authenticated;
grant update (replies_enabled, mentions_enabled, room_events_enabled)
on table public.notification_preferences to authenticated;

create policy profiles_select_self
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy notification_preferences_select_self
on public.notification_preferences
for select
to authenticated
using ((select auth.uid()) = profile_id);

create policy notification_preferences_update_self
on public.notification_preferences
for update
to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);
