create table public.bestseller_books (
  rank smallint primary key check (rank between 1 and 10),
  title text not null check (char_length(title) between 1 and 500),
  author text not null check (char_length(author) between 1 and 500),
  publisher text,
  isbn13 text,
  thumbnail_url text,
  product_url text not null,
  source text not null default 'aladin' check (source = 'aladin'),
  fetched_at timestamptz not null default now()
);

alter table public.bestseller_books enable row level security;

revoke all on table public.bestseller_books from anon, authenticated;
grant select on table public.bestseller_books to authenticated;

create policy "authenticated users can read current bestsellers"
on public.bestseller_books
for select
to authenticated
using (true);

comment on table public.bestseller_books
is '알라딘 API에서 하루 한 번 갱신한 현재 국내 도서 베스트셀러 캐시다.';
