import { z } from 'zod'

export const bookChatRowSchema = z.object({
  books: z
    .object({
      authors: z.array(z.string()),
      thumbnail_url: z.string().nullable(),
      title: z.string(),
    })
    .nullable(),
  id: z.string().uuid(),
  name: z.string(),
})

export const bookSearchItemSchema = z.object({
  authors: z.array(z.string()),
  externalUrl: z.string().url().nullable(),
  isbn10: z.string().nullable(),
  isbn13: z.string().nullable(),
  publishedAt: z.string().nullable(),
  publisher: z.string().nullable(),
  source: z.enum(['kakao', 'aladin']),
  thumbnailUrl: z.string().url().nullable(),
  title: z.string(),
})

export const bookSearchResponseSchema = z.object({
  data: z.object({ items: z.array(bookSearchItemSchema) }),
  ok: z.literal(true),
  requestId: z.string(),
})

export const readingRoomDetailSchema = z.object({
  description: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string(),
})

export const managedBookChatRowSchema = z.object({
  books: z.object({ thumbnail_url: z.string().nullable(), title: z.string() }).nullable(),
  id: z.string().uuid(),
  name: z.string().min(1),
  room_id: z.string().uuid(),
  status: z.enum(['reading', 'completed', 'archived', 'deleted']),
})

export const archivedBookChatRowSchema = z.object({
  archived_at: z.string().datetime({ offset: true }),
  books: z
    .object({
      authors: z.array(z.string()),
      thumbnail_url: z.string().nullable(),
      title: z.string(),
    })
    .nullable(),
  id: z.string().uuid(),
  name: z.string().min(1),
  room_id: z.string().uuid(),
})

export const readingBookRowSchema = z.object({
  books: z
    .object({
      authors: z.array(z.string()),
      thumbnail_url: z.string().nullable(),
      title: z.string(),
    })
    .nullable(),
  id: z.string().uuid(),
  name: z.string().min(1),
  reading_rooms: z.object({ name: z.string().min(1) }).nullable(),
  room_id: z.string().uuid(),
})

export const postRowSchema = z.object({
  author_member_id: z.string().uuid().nullable(),
  author_name_snapshot: z.string(),
  body: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
  depth: z.union([z.literal(0), z.literal(1)]),
  id: z.string().uuid(),
  post_labels: z
    .array(
      z.object({
        kind: z.enum(['page', 'chapter', 'custom']),
        sort_order: z.number().int().nonnegative(),
        value: z.string().min(1).max(40),
      }),
    )
    .default([]),
  root_post_id: z.string().uuid().nullable(),
})

export const postLabelSchema = z.object({
  kind: z.enum(['page', 'chapter', 'custom']),
  value: z.string().trim().min(1).max(40),
})

export const postFormSchema = z
  .object({
    body: z.string().trim().max(500),
    labels: z.array(postLabelSchema).max(10).default([]),
    mentionedMemberIds: z.array(z.string().uuid()).max(6).default([]),
  })
  .refine((value) => value.body.length > 0 || value.labels.length > 0, {
    message: '독후감이나 라벨을 하나 이상 남겨 주세요.',
  })

export type BookChat = {
  authors: string[]
  id: string
  name: string
  thumbnailUrl: string | null
  title: string
}

export type BookSearchItem = z.infer<typeof bookSearchItemSchema>
export type ReadingRoomDetail = z.infer<typeof readingRoomDetailSchema>

export type ManagedBookChat = {
  id: string
  name: string
  roomId: string
  status: 'reading' | 'completed' | 'archived' | 'deleted'
  thumbnailUrl: string | null
  title: string
}

export type ArchivedBookChat = {
  archivedAt: string
  authors: string[]
  bookChatId: string
  roomId: string
  thumbnailUrl: string | null
  title: string
}

export type ReadingBook = {
  authors: string[]
  bookChatId: string
  isCompleted: boolean
  roomId: string
  roomName: string
  thumbnailUrl: string | null
  title: string
}

export type DiscussionPost = {
  authorMemberId: string | null
  authorName: string
  body: string | null
  createdAt: string
  depth: 0 | 1
  id: string
  labels: z.infer<typeof postLabelSchema>[]
  rootPostId: string | null
}

export type PostForm = z.infer<typeof postFormSchema>

export const bookChatKeys = {
  /** 책방 식별자로 안정적인 query key를 생성한다. */
  byRoom: (roomId: string) => ['book-chats', roomId] as const,
  /** 책방 식별자로 책방 상세 query key를 생성한다. */
  room: (roomId: string) => ['reading-room', roomId] as const,
  /** 책 대화 식별자로 제목과 소속 책방을 조회하는 query key를 생성한다. */
  detail: (bookChatId: string) => ['book-chat', bookChatId] as const,
  /** 프로필별 보관한 책 대화 목록 query key를 생성한다. */
  myArchived: (profileId: string) => ['archived-book-chats', profileId] as const,
  /** 프로필과 개인 완독 상태로 모든 참여 책방의 읽는 책 목록 query key를 생성한다. */
  myReading: (profileId: string, completedBookChatIds: readonly string[]) =>
    ['my-reading-books', profileId, ...completedBookChatIds] as const,
}

export const postKeys = {
  /** 책 대화방 식별자로 안정적인 query key를 생성한다. */
  byBookChat: (bookChatId: string) => ['posts', bookChatId] as const,
}

/** 외부 입력을 검증해 책 대화방 목록 도메인 모델로 변환해 반환한다. */
export function parseBookChats(value: unknown): BookChat[] {
  return z.array(bookChatRowSchema).parse(value).map(mapBookChat)
}

/** 외부 응답을 내 정보 화면에서 쓰는 보관한 책 모델로 변환한다. */
export function parseArchivedBookChats(value: unknown): ArchivedBookChat[] {
  return z.array(archivedBookChatRowSchema).parse(value).map(mapArchivedBookChat)
}

/** 외부 입력을 검증해 책방별 개인 읽는 책 목록 모델로 변환한다. */
export function parseReadingBooks(
  value: unknown,
  completedBookChatIds: readonly string[],
): ReadingBook[] {
  const completedIds = new Set(completedBookChatIds)
  return z
    .array(readingBookRowSchema)
    .parse(value)
    .map((row) => mapReadingBook(row, completedIds))
}

/** 외부 입력을 검증해 책 검색 응답 형식으로 변환한다. */
export function parseBookSearchResponse(value: unknown): BookSearchItem[] {
  return bookSearchResponseSchema.parse(value).data.items
}

/** 외부 입력을 검증해 메시지 목록 형식으로 변환한다. */
export function parsePosts(value: unknown): DiscussionPost[] {
  return z.array(postRowSchema).parse(value).map(mapDiscussionPost)
}

/** 외부 입력을 검증해 메시지 입력 폼 형식으로 변환한다. */
export function parsePostForm(value: unknown): PostForm {
  return postFormSchema.parse(value)
}

/** 원본 데이터를 책 대화방 도메인 모델로 변환한다. */
function mapBookChat(row: z.infer<typeof bookChatRowSchema>): BookChat {
  return {
    authors: row.books?.authors ?? [],
    id: row.id,
    name: row.name,
    thumbnailUrl: row.books?.thumbnail_url ?? null,
    title: row.books?.title ?? row.name,
  }
}

/** 원본 관리 행을 화면에서 쓰는 책 대화 모델로 변환한다. */
export function mapManagedBookChat(row: z.infer<typeof managedBookChatRowSchema>): ManagedBookChat {
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id,
    status: row.status,
    thumbnailUrl: row.books?.thumbnail_url ?? null,
    title: row.books?.title ?? row.name,
  }
}

/** 원본 데이터를 개인 책 목록에서 쓰는 읽기 상태 모델로 변환한다. */
function mapReadingBook(
  row: z.infer<typeof readingBookRowSchema>,
  completedBookChatIds: ReadonlySet<string>,
): ReadingBook {
  return {
    authors: row.books?.authors ?? [],
    bookChatId: row.id,
    isCompleted: completedBookChatIds.has(row.id),
    roomId: row.room_id,
    roomName: row.reading_rooms?.name ?? '이름 없는 책방',
    thumbnailUrl: row.books?.thumbnail_url ?? null,
    title: row.books?.title ?? row.name,
  }
}

/** 원본 보관한 책 행을 개인 기록 화면의 도메인 모델로 변환한다. */
function mapArchivedBookChat(row: z.infer<typeof archivedBookChatRowSchema>): ArchivedBookChat {
  return {
    archivedAt: row.archived_at,
    authors: row.books?.authors ?? [],
    bookChatId: row.id,
    roomId: row.room_id,
    thumbnailUrl: row.books?.thumbnail_url ?? null,
    title: row.books?.title ?? row.name,
  }
}

/** 원본 데이터를 대화 메시지 도메인 모델로 변환한다. */
function mapDiscussionPost(row: z.infer<typeof postRowSchema>): DiscussionPost {
  return {
    authorMemberId: row.author_member_id,
    authorName: row.author_name_snapshot,
    body: row.body,
    createdAt: row.created_at,
    depth: row.depth,
    id: row.id,
    labels: [...row.post_labels]
      .sort((first, second) => first.sort_order - second.sort_order)
      .map(({ kind, value }) => ({ kind, value })),
    rootPostId: row.root_post_id,
  }
}
