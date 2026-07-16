begin;

select plan(5);

select has_function(
  'public',
  'consume_rate_limit',
  array['text', 'text', 'integer', 'integer'],
  'consume_rate_limit function should exist'
);
select is(
  public.consume_rate_limit('book-search', 'user-a', 2, 60),
  true,
  'the first request should be allowed'
);
select is(
  public.consume_rate_limit('book-search', 'user-a', 2, 60),
  true,
  'the second request should be allowed'
);
select is(
  public.consume_rate_limit('book-search', 'user-a', 2, 60),
  false,
  'a request over the fixed-window limit should be rejected'
);
select is(
  public.consume_rate_limit('book-search', 'user-b', 2, 60),
  true,
  'rate limit subjects should be isolated'
);

select * from finish();

rollback;
