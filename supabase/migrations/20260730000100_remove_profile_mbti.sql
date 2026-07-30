begin;

alter table public.profiles drop constraint if exists profiles_mbti_format;
alter table public.profiles drop column if exists mbti;

commit;
