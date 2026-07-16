insert into public.profiles (id, display_name)
select
  users.id,
  private.profile_display_name(users)
from auth.users as users
on conflict (id) do nothing;

insert into public.notification_preferences (profile_id)
select profiles.id
from public.profiles as profiles
on conflict (profile_id) do nothing;
