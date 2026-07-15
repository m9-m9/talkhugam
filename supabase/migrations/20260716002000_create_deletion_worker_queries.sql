create or replace function public.get_deletion_job_asset_ids(p_job_id uuid)
returns table (mux_asset_id text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select distinct asset.mux_asset_id
  from public.deletion_jobs as job
  join public.video_assets as asset
    on asset.mux_asset_id is not null
    and asset.status <> 'deleted'
  join public.posts as post on post.id = asset.post_id
  join public.book_chats as chat on chat.id = post.book_chat_id
  left join public.room_members as author on author.id = post.author_member_id
  where job.id = p_job_id
    and (
      (job.scope = 'post' and post.id = job.target_id)
      or (job.scope = 'room' and chat.room_id = job.target_id)
      or (job.scope = 'account' and author.profile_id = job.target_id)
    );
$$;

revoke all on function public.get_deletion_job_asset_ids(uuid)
from public, anon, authenticated;
grant execute on function public.get_deletion_job_asset_ids(uuid) to service_role;

comment on function public.get_deletion_job_asset_ids(uuid)
is 'Resolves only provider asset ids needed by a claimed post, room, or account deletion job';
