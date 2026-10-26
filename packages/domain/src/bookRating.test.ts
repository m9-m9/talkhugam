import { describe, expect, it } from 'vitest'

import {
  bookRatingKeys,
  calculateAverageRating,
  parseBookChatRatings,
  parseBookRatingInput,
  parseRatedBooks,
} from './bookRating'

const me = '0a9c9826-5aa6-41d0-a2f7-e79b5f667b20'
const other = 'e9b33e51-5b8d-4d33-a2ce-c49b22b6b700'

describe('bookRating', () => {
  it('책방 표시명을 우선해 별점 목록을 변환한다', () => {
    const roomMembers = [
      { profile_id: me, room_avatar_path: null, room_display_name: '책방 이름' },
      { profile_id: other, room_avatar_path: 'other/avatar', room_display_name: '다른 멤버' },
    ]
    const ratings = parseBookChatRatings(
      [
        {
          book_chats: { reading_rooms: { room_members: roomMembers } },
          profile_id: me,
          profiles: { avatar_path: null, display_name: '기본 이름' },
          rating: 4,
          review: null,
          updated_at: '2026-10-26T10:00:00+09:00',
        },
        {
          book_chats: { reading_rooms: { room_members: roomMembers } },
          profile_id: other,
          profiles: { avatar_path: null, display_name: '다른 기본 이름' },
          rating: 5,
          review: '좋았어요',
          updated_at: '2026-10-26T11:00:00+09:00',
        },
      ],
      me,
    )

    expect(ratings).toEqual([
      { avatarPath: null, displayName: '책방 이름', isMe: true, profileId: me, rating: 4, review: null, updatedAt: '2026-10-26T10:00:00+09:00' },
      { avatarPath: 'other/avatar', displayName: '다른 멤버', isMe: false, profileId: other, rating: 5, review: '좋았어요', updatedAt: '2026-10-26T11:00:00+09:00' },
    ])
  })

  it('책 대화를 만든 멤버 한 명만 담긴 예전 응답 구조는 거부한다', () => {
    expect(() =>
      parseBookChatRatings(
        [
          {
            book_chats: { room_members: { profile_id: me, room_avatar_path: null, room_display_name: '책방 이름' } },
            profile_id: me,
            profiles: { avatar_path: null, display_name: '기본 이름' },
            rating: 4,
            review: null,
            updated_at: '2026-10-26T10:00:00+09:00',
          },
        ],
        me,
      ),
    ).toThrow()
  })

  it('별점이 없는 저장 요청을 거부한다', () => {
    expect(() => parseBookRatingInput({ bookChatId: me, rating: null, review: null })).toThrow()
  })

  it('1~5 밖의 별점을 거부한다', () => {
    expect(() => parseBookRatingInput({ bookChatId: me, rating: 6, review: null })).toThrow()
  })

  it('평균 별점을 소수 첫째 자리로 반올림하고 빈 목록은 null로 둔다', () => {
    expect(calculateAverageRating([{ rating: 4 }, { rating: 5 }, { rating: 5 }])).toBe(4.7)
    expect(calculateAverageRating([])).toBeNull()
  })

  it('내 별점 책 목록을 변환한다', () => {
    const books = parseRatedBooks([
      {
        book_chat_id: other,
        book_chats: { books: { authors: ['저자'], thumbnail_url: null, title: '책' }, room_id: me },
        rating: 3,
        review: '보통',
        updated_at: '2026-10-26T10:00:00+09:00',
      },
    ])

    expect(books[0]).toMatchObject({ bookChatId: other, rating: 3, roomId: me, title: '책' })
  })

  it('화면별 query key를 분리한다', () => {
    expect(bookRatingKeys.byChat(other)).toEqual(['book-ratings', other])
    expect(bookRatingKeys.myBooks(me)).toEqual(['my-rated-books', me])
  })
})
