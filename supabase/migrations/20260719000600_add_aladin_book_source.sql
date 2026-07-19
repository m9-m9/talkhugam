alter type public.book_source add value if not exists 'aladin';

comment on type public.book_source is
  '책 메타데이터의 원천. Kakao 검색, Aladin 베스트셀러, 직접 입력을 구분한다.';
