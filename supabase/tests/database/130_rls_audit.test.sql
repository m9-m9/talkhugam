begin;

select plan(18);

select is(
  (
    select count(*)
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relkind = 'r'
  ),
  15::bigint,
  'the backend should expose exactly fifteen public tables'
);
select is(
  (
    select count(*)
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relkind = 'r'
      and not pg_class.relrowsecurity
  ),
  0::bigint,
  'every public table should have RLS enabled'
);
select is(
  (
    select count(*)
    from information_schema.table_privileges
    where table_schema = 'public' and grantee = 'anon'
  ),
  0::bigint,
  'anon should have no direct public table privileges'
);
select is(
  (
    select count(*)
    from information_schema.table_privileges
    where table_schema = 'public'
      and grantee = 'authenticated'
      and privilege_type = 'INSERT'
  ),
  0::bigint,
  'authenticated users should create multi-row resources only through RPCs'
);
select is(
  (
    select count(*)
    from information_schema.table_privileges
    where table_schema = 'public'
      and grantee = 'authenticated'
      and privilege_type = 'DELETE'
  ),
  0::bigint,
  'authenticated users should delete resources only through RPCs'
);
select is(
  has_table_privilege('authenticated', 'public.mux_events', 'SELECT'),
  false,
  'authenticated users should not read raw Mux events'
);
select is(
  has_table_privilege('authenticated', 'public.deletion_jobs', 'SELECT'),
  false,
  'authenticated users should not read deletion jobs'
);
select is(
  has_table_privilege('authenticated', 'public.video_assets', 'SELECT'),
  true,
  'authenticated users should receive RLS-filtered video state reads'
);
select is(
  has_table_privilege('authenticated', 'public.notifications', 'SELECT'),
  true,
  'authenticated users should receive RLS-filtered notification reads'
);
select is(
  has_column_privilege(
    'authenticated',
    'public.notification_preferences',
    'mentions_enabled',
    'UPDATE'
  ),
  true,
  'authenticated users should update an allowed preference column under RLS'
);
select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and not ('authenticated' = any(roles))
  ),
  0::bigint,
  'every public policy should explicitly target authenticated'
);
select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and ('public' = any(roles))
  ),
  0::bigint,
  'no RLS policy should target the public role'
);
select is(
  (
    select count(*)
    from (
      values
        ('profiles'),
        ('notification_preferences'),
        ('reading_rooms'),
        ('room_members'),
        ('room_invites'),
        ('books'),
        ('book_chats'),
        ('book_chat_completions'),
        ('posts'),
        ('post_labels'),
        ('post_mentions'),
        ('notifications'),
        ('video_assets')
    ) as expected(table_name)
    where not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and pg_policies.tablename = expected.table_name
        and cmd = 'SELECT'
        and 'authenticated' = any(roles)
    )
  ),
  0::bigint,
  'every client-readable table should have an authenticated SELECT policy'
);
select is(
  (
    select count(*)
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.prosecdef
      and not exists (
        select 1
        from unnest(coalesce(pg_proc.proconfig, '{}')) as setting
        where setting like 'search_path=%'
      )
  ),
  0::bigint,
  'every public SECURITY DEFINER function should pin search_path'
);
select is(
  (
    select count(*)
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and has_function_privilege('anon', pg_proc.oid, 'EXECUTE')
  ),
  0::bigint,
  'anon should execute no private helper functions'
);
select is(
  (
    select count(*)
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname not in (
        'is_active_room_member',
        'is_room_owner',
        'current_room_member_id',
        'shares_active_room',
        'can_access_book_chat',
        'can_access_book',
        'can_access_post'
      )
      and has_function_privilege('authenticated', pg_proc.oid, 'EXECUTE')
  ),
  0::bigint,
  'authenticated users should execute only the private RLS helper allowlist'
);
select is(
  (
    select count(*)
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'apply_mux_video_event',
        'claim_deletion_jobs',
        'finish_deletion_job',
        'get_deletion_job_asset_ids',
        'finish_account_deletion'
      )
      and has_function_privilege('authenticated', pg_proc.oid, 'EXECUTE')
  ),
  0::bigint,
  'authenticated users should not execute service-role operations'
);
select is(
  (
    select count(*)
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'apply_mux_video_event',
        'claim_deletion_jobs',
        'finish_deletion_job',
        'get_deletion_job_asset_ids',
        'finish_account_deletion'
      )
      and not has_function_privilege('service_role', pg_proc.oid, 'EXECUTE')
  ),
  0::bigint,
  'service_role should execute every server-only operation'
);

select * from finish();

rollback;
