import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  bookCompletionKeys,
  getMyCompletedBooks,
  type CompletedBook,
} from '../../entities/book-completion'
import { getProfile } from '../../entities/profile'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookCover } from '../../shared/ui/BookCover'
import { CompletionMark } from '../../shared/ui/CompletionMark'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

/** 프로필 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function ProfilePage() {
  const navigate = useNavigate()
  const profileId = useAuthenticatedUser().id
  const [isRetryingProfile, setIsRetryingProfile] = useState(false)
  const [isRetryingCompletedBooks, setIsRetryingCompletedBooks] = useState(false)
  const profileQuery = useQuery({
    queryFn: () => getProfile(createSupabaseClient(), profileId),
    queryKey: ['profile', profileId],
  })
  const completedBooksQuery = useQuery({
    queryFn: () => getMyCompletedBooks(createSupabaseClient(), profileId),
    queryKey: bookCompletionKeys.myBooks(profileId),
  })

  /** 실패한 프로필 조회를 다시 요청하고 재시도 피드백을 유지한다. */
  function handleRetryProfile() {
    setIsRetryingProfile(true)
    void profileQuery.refetch().finally(() => setIsRetryingProfile(false))
  }

  /** 실패한 완독 도서 조회를 다시 요청하고 재시도 피드백을 유지한다. */
  function handleRetryCompletedBooks() {
    setIsRetryingCompletedBooks(true)
    void completedBooksQuery.refetch().finally(() => setIsRetryingCompletedBooks(false))
  }

  if (profileQuery.isPending && !isRetryingProfile)
    return <ProfileState message="내 정보를 불러오고 있어요." />
  if (profileQuery.isError || !profileQuery.data)
    return (
      <ProfileRetryState
        isRetrying={isRetryingProfile}
        onRetry={handleRetryProfile}
        message="프로필 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
      />
    )

  const profile = profileQuery.data

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader
        action={
          <div className="flex items-center gap-1">
            <button
              className="text-primary min-h-11 px-2 text-sm font-medium"
              onClick={() => void navigate('/profile/share')}
              type="button"
            >
              공유
            </button>
            <button
              className="text-primary min-h-11 px-2 text-sm font-medium"
              onClick={() => void navigate('/profile/settings')}
              type="button"
            >
              설정
            </button>
          </div>
        }
        onBack={() => void navigate('/rooms')}
        title="내 정보"
      />

      <section className="mt-8" aria-labelledby="profile-heading">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div
              aria-hidden="true"
              className="bg-primary flex size-16 shrink-0 items-center justify-center rounded-full text-2xl font-semibold text-white"
            >
              {profile.displayName.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <h1 className="text-ink text-xl font-bold" id="profile-heading">
                {profile.displayName}
              </h1>
              <p className="text-ink-subtle mt-1 text-sm">
                {profile.bio || '아직 소개를 작성하지 않았어요.'}
              </p>
            </div>
          </div>
          <button
            className="border-ink/10 min-h-11 shrink-0 rounded-md border bg-white px-3 text-sm font-medium"
            onClick={() => void navigate('/profile/edit')}
            type="button"
          >
            프로필 편집
          </button>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="profile-details-heading">
        <h2 className="text-ink text-base font-bold" id="profile-details-heading">
          프로필 정보
        </h2>
        <dl className="border-ink/10 mt-4 overflow-hidden rounded-lg border bg-white">
          <ProfileDetail label="한 줄 소개" value={profile.bio || '입력한 소개가 없어요'} />
          <ProfileDetail label="MBTI" value={profile.mbti || '선택 안 함'} />
        </dl>
      </section>

      <section className="mt-12" aria-labelledby="reading-books-heading">
        <h2 className="text-ink text-base font-bold" id="reading-books-heading">
          책 기록
        </h2>
        <button
          aria-label="읽고 있는 책 모두 보기"
          className="border-ink/10 mt-4 flex min-h-16 w-full items-center justify-between rounded-lg border bg-white px-4 text-left"
          onClick={() => void navigate('/profile/books')}
          type="button"
        >
          <span>
            <span className="text-ink block text-sm font-semibold">읽고 있는 책</span>
            <span className="text-ink-subtle mt-1 block text-xs">
              참여 중인 모든 독서방의 책을 모아 봐요.
            </span>
          </span>
          <span aria-hidden="true" className="text-primary text-lg">
            ›
          </span>
        </button>
      </section>

      <CompletedBooksSection
        completedBooks={completedBooksQuery.data ?? []}
        hasError={completedBooksQuery.isError}
        isLoading={completedBooksQuery.isPending}
        isRetrying={isRetryingCompletedBooks}
        onRetry={handleRetryCompletedBooks}
      />

      <section className="mt-12" aria-labelledby="account-heading">
        <h2 className="text-ink text-base font-bold" id="account-heading">
          계정
        </h2>
        <button
          className="border-ink/10 mt-4 flex min-h-16 w-full items-center justify-between rounded-lg border bg-white px-4 text-left"
          onClick={() => void navigate('/profile/settings')}
          type="button"
        >
          <span>
            <span className="text-ink block text-sm font-medium">계정 설정</span>
            <span className="text-ink-subtle mt-1 block text-xs">
              로그인 수단과 계정을 관리해요.
            </span>
          </span>
          <span aria-hidden="true" className="text-ink-subtle text-lg">
            ›
          </span>
        </button>
      </section>
    </main>
  )
}

/** 개인이 완독한 책과 선택 총평을 마이페이지에서 렌더링한다. */
function CompletedBooksSection({
  completedBooks,
  hasError,
  isLoading,
  isRetrying,
  onRetry,
}: {
  completedBooks: CompletedBook[]
  hasError: boolean
  isLoading: boolean
  isRetrying: boolean
  onRetry: () => void
}) {
  return (
    <section className="mt-12" aria-labelledby="completed-books-heading">
      <h2 className="text-ink text-base font-bold" id="completed-books-heading">
        내가 완독한 책
      </h2>
      {isLoading && !isRetrying ? (
        <LoadingSpinner label="완독한 책을 불러오고 있어요." size="xs" />
      ) : null}
      {hasError || isRetrying ? (
        <div className="mt-4">
          <RetryState
            isRetrying={isRetrying}
            message="완독한 책을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
            onRetry={onRetry}
          />
          {isRetrying ? (
            <div className="mt-4">
              <LoadingSpinner label="완독한 책을 다시 불러오고 있어요." size="xs" />
            </div>
          ) : null}
        </div>
      ) : null}
      {!isLoading && !hasError && !isRetrying && completedBooks.length === 0 ? (
        <p className="text-ink-subtle mt-4 text-sm">아직 완독한 책이 없어요.</p>
      ) : null}
      {completedBooks.length > 0 ? (
        <ul className="mt-4 space-y-3" aria-label="완독한 책 목록">
          {completedBooks.map((book) => (
            <li key={book.bookChatId}>
              <Link
                aria-label={`${book.title} 책 대화로 이동`}
                className="border-ink/10 flex min-h-20 items-center gap-3 rounded-lg border bg-white p-3"
                to={`/rooms/${book.roomId}/books/${book.bookChatId}`}
              >
                <BookCover alt="" thumbnailUrl={book.thumbnailUrl} />
                <span className="min-w-0 flex-1">
                  <span className="text-ink block truncate text-sm font-semibold">
                    {book.title}
                  </span>
                  <span className="text-ink-subtle mt-1 block truncate text-xs">
                    {book.authors.join(', ')}
                  </span>
                  <CompletionMark className="mt-2" />
                  <span className="text-primary mt-1 block text-xs">
                    {book.rating ? '★'.repeat(book.rating) : '별점 작성 전'}
                  </span>
                  <span className="text-ink-subtle mt-1 block truncate text-xs">
                    {book.review || '총평 작성 전'}
                  </span>
                </span>
                <span aria-hidden="true" className="text-ink-subtle text-lg">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/** 프로필 상세 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink/10 flex items-start justify-between gap-6 border-b px-4 py-4 last:border-b-0">
      <dt className="text-ink-subtle text-sm">{label}</dt>
      <dd className="text-ink max-w-48 text-right text-sm">{value}</dd>
    </div>
  )
}

/** 프로필 상태 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function ProfileState({ message }: { message: string }) {
  return (
    <main className="app-page bg-surface flex items-center justify-center px-4">
      <LoadingSpinner label={message} />
    </main>
  )
}

/** 프로필 조회 실패를 재시도와 진행 상태로 안내한다. */
function ProfileRetryState({
  isRetrying,
  message,
  onRetry,
}: {
  isRetrying: boolean
  message: string
  onRetry: () => void
}) {
  return (
    <main className="app-page bg-surface flex flex-col items-center justify-center gap-4 px-4">
      <RetryState isRetrying={isRetrying} message={message} onRetry={onRetry} />
      {isRetrying ? <LoadingSpinner label="내 정보를 다시 불러오고 있어요." /> : null}
    </main>
  )
}
