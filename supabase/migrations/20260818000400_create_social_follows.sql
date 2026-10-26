create table public.follows (
  follower_profile_id uuid not null references public.profiles (id) on delete cascade,
  followed_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_profile_id, followed_profile_id),
  constraint follows_distinct_profiles
    check (follower_profile_id <> followed_profile_id)
);

create index follows_followed_profile_created_at_idx
on public.follows (followed_profile_id, created_at desc, follower_profile_id);

alter table public.follows enable row level security;

revoke all on table public.follows from public, anon, authenticated;

create or replace function public.follow_profile(p_followed_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_follower_profile_id uuid := auth.uid();
begin
  if v_follower_profile_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_followed_profile_id is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if p_followed_profile_id = v_follower_profile_id then
    raise exception using errcode = 'P0001', message = 'SELF_FOLLOW_FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_followed_profile_id
  ) then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_FOUND';
  end if;

  insert into public.follows (follower_profile_id, followed_profile_id)
  values (v_follower_profile_id, p_followed_profile_id)
  on conflict (follower_profile_id, followed_profile_id) do nothing;

  return found;
end;
$$;

create or replace function public.unfollow_profile(p_followed_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_follower_profile_id uuid := auth.uid();
begin
  if v_follower_profile_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_followed_profile_id is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  delete from public.follows
  where follower_profile_id = v_follower_profile_id
    and followed_profile_id = p_followed_profile_id;

  return found;
end;
$$;

create or replace function public.get_public_profile(p_profile_id uuid)
returns table (
  id uuid,
  display_name text,
  bio text,
  avatar_path text,
  follower_count bigint,
  is_following boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    profile.id,
    profile.display_name::text,
    profile.bio::text,
    profile.avatar_path,
    (
      select count(*)
      from public.follows as follower
      where follower.followed_profile_id = profile.id
    )::bigint,
    exists (
      select 1
      from public.follows as following
      where following.follower_profile_id = (select auth.uid())
        and following.followed_profile_id = profile.id
    )
  from public.profiles as profile
  where profile.id = p_profile_id
    and (select auth.uid()) is not null;
$$;

create or replace function public.list_public_profile_followers(
  p_profile_id uuid,
  p_limit integer default 20
)
returns table (
  id uuid,
  display_name text,
  bio text,
  avatar_path text,
  follower_count bigint,
  is_following boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_profile_id is null or p_limit is null or p_limit not between 1 and 50 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  return query
  select
    profile.id,
    profile.display_name::text,
    profile.bio::text,
    profile.avatar_path,
    (
      select count(*)
      from public.follows as profile_follower
      where profile_follower.followed_profile_id = profile.id
    )::bigint,
    exists (
      select 1
      from public.follows as following
      where following.follower_profile_id = (select auth.uid())
        and following.followed_profile_id = profile.id
    )
  from public.follows as relation
  join public.profiles as profile
    on profile.id = relation.follower_profile_id
  where relation.followed_profile_id = p_profile_id
  order by relation.created_at desc, profile.id
  limit p_limit;
end;
$$;

revoke all on function public.follow_profile(uuid) from public, anon;
revoke all on function public.unfollow_profile(uuid) from public, anon;
revoke all on function public.get_public_profile(uuid) from public, anon;
revoke all on function public.list_public_profile_followers(uuid, integer) from public, anon;

grant execute on function public.follow_profile(uuid) to authenticated;
grant execute on function public.unfollow_profile(uuid) to authenticated;
grant execute on function public.get_public_profile(uuid) to authenticated;
grant execute on function public.list_public_profile_followers(uuid, integer) to authenticated;

comment on table public.follows is
  '공개 프로필 팔로우 관계이며 원본 행은 RPC를 통해서만 변경하거나 조회한다.';
comment on function public.follow_profile(uuid) is
  '현재 인증 사용자가 다른 공개 프로필을 한 번만 팔로우하도록 관계를 생성한다.';
comment on function public.unfollow_profile(uuid) is
  '현재 인증 사용자가 자신의 팔로우 관계만 안전하게 해제한다.';
comment on function public.get_public_profile(uuid) is
  '원본 프로필 RLS를 넓히지 않고 공개 허용 필드와 팔로우 상태만 반환한다.';
comment on function public.list_public_profile_followers(uuid, integer) is
  '원본 프로필 RLS를 우회해 공개 허용 필드만으로 대상의 팔로워 목록을 제한 조회한다.';
