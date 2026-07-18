import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { bookChatKeys, deleteManagedBookChat, getManagedBookChat } from '../../entities/book-chat'
import { bookCompletionKeys, upsertBookChatCompletion } from '../../entities/book-completion'
import { useAuthenticatedUser } from '../../features/auth'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookCover } from '../../shared/ui/BookCover'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

/** 책 대화방의 개인 완독 기록과 삭제 요청을 관리하는 화면을 렌더링한다. */
export function BookChatManagementPage() {
  const client = createSupabaseClient()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profileId = useAuthenticatedUser().id
  const { bookChatId, roomId } = useParams()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const bookChatQuery = useQuery({
    enabled: Boolean(bookChatId),
    queryFn: () => getManagedBookChat(client, bookChatId ?? ''),
    queryKey: ['managed-book-chat', bookChatId],
  })
  const completionMutation = useMutation({
    mutationFn: () =>
      upsertBookChatCompletion(client, {
        bookChatId: bookChatId ?? '',
        rating: null,
        review: null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bookCompletionKeys.myBooks(profileId) })
      await queryClient.invalidateQueries({ queryKey: bookCompletionKeys.myBookChatIds(profileId) })
    },
  })
  const deletionMutation = useMutation({
    mutationFn: (confirmationName: string) =>
      deleteManagedBookChat(client, bookChatId ?? '', confirmationName),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bookChatKeys.byRoom(roomId ?? '') })
      void navigate(`/rooms/${roomId}`, { replace: true })
    },
  })

  if (!bookChatId || !roomId || bookChatQuery.isPending) return <BookChatManagementLoadingPage />
  if (bookChatQuery.isError || bookChatQuery.data === null)
    return <BookChatManagementUnavailablePage onBack={() => void navigate(`/rooms/${roomId}`)} />
  const chat = bookChatQuery.data

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader
        onBack={() => void navigate(`/rooms/${roomId}/books/${bookChatId}`)}
        title="책 채팅방 관리"
      />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">책 대화</p>
        <h1 className="text-ink mt-2 text-xl font-bold">{chat.title}</h1>
      </header>
      <section className="border-ink/10 mt-8 flex items-center gap-4 rounded-lg border bg-white p-4">
        <BookCover alt={`${chat.title} 표지`} thumbnailUrl={chat.thumbnailUrl} />
        <span>
          <span className="text-ink block text-sm font-bold">{chat.name}</span>
          <span className="text-ink-subtle mt-1 block text-xs">내 완독 기록을 남길 수 있어요.</span>
        </span>
      </section>
      <section className="mt-12" aria-labelledby="book-chat-actions">
        <h2 className="text-ink text-base font-bold" id="book-chat-actions">
          채팅방 관리
        </h2>
        <div className="mt-4 space-y-3">
          <button
            className="border-ink/10 min-h-12 w-full rounded-md border bg-white px-4 text-left text-sm font-semibold"
            disabled={completionMutation.isPending}
            onClick={() => completionMutation.mutate()}
            type="button"
          >
            {completionMutation.isPending ? '완독 기록 중…' : '내 완독으로 기록'}
          </button>
          <button
            className="border-ink/10 min-h-12 w-full rounded-md border bg-white px-4 text-left text-sm font-semibold text-red-600"
            disabled={deletionMutation.isPending}
            onClick={() => setIsDeleteDialogOpen(true)}
            type="button"
          >
            삭제 요청
          </button>
        </div>
        {completionMutation.isError ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            완독 기록을 저장하지 못했어요. 다시 시도해 주세요.
          </p>
        ) : null}
      </section>
      {isDeleteDialogOpen ? (
        <BookChatDeletionDialog
          bookName={chat.name}
          errorMessage={deletionMutation.isError ? '이름이 일치하는지 확인해 주세요.' : null}
          isDeleting={deletionMutation.isPending}
          onCancel={() => setIsDeleteDialogOpen(false)}
          onConfirm={(confirmationName) => deletionMutation.mutate(confirmationName)}
        />
      ) : null}
    </main>
  )
}

/** 삭제할 책 대화방의 이름을 다시 입력받아 실수를 방지한다. */
function BookChatDeletionDialog({
  bookName,
  errorMessage,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  bookName: string
  errorMessage: string | null
  isDeleting: boolean
  onCancel: () => void
  onConfirm: (confirmationName: string) => void
}) {
  const [confirmationName, setConfirmationName] = useState('')
  return (
    <div
      aria-modal="true"
      className="bg-ink/30 fixed inset-0 z-30 flex items-end justify-center px-4 pb-4"
      role="dialog"
    >
      <div className="app-page rounded-lg bg-white p-6">
        <h2 className="text-ink text-lg font-bold">책 대화방을 삭제할까요?</h2>
        <p className="text-ink-subtle mt-2 text-sm">
          영상 삭제 요청도 함께 시작돼요. 계속하려면 책 이름을 입력해 주세요.
        </p>
        <label className="mt-4 block">
          <span className="sr-only">삭제할 책 이름</span>
          <input
            className="border-ink/10 focus:border-primary min-h-12 w-full rounded-md border px-4 text-sm outline-none"
            onChange={(event) => setConfirmationName(event.target.value)}
            placeholder={bookName}
            value={confirmationName}
          />
        </label>
        {errorMessage ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            className="border-ink/10 min-h-12 rounded-md border text-sm font-semibold"
            disabled={isDeleting}
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
          <button
            className="bg-primary min-h-12 rounded-md text-sm font-semibold text-white disabled:opacity-50"
            disabled={isDeleting || confirmationName.trim() !== bookName}
            onClick={() => onConfirm(confirmationName)}
            type="button"
          >
            {isDeleting ? '삭제 요청 중…' : '삭제 요청하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 책 대화방 관리 정보를 기다리는 동안 책 로더를 렌더링한다. */
function BookChatManagementLoadingPage() {
  return (
    <main className="app-page bg-surface flex min-h-screen items-center justify-center">
      <LoadingSpinner label="책 대화방을 불러오고 있어요." variant="book" />
    </main>
  )
}

/** 접근할 수 없는 책 대화방일 때 이전 화면으로 복귀할 선택지를 제공한다. */
function BookChatManagementUnavailablePage({ onBack }: { onBack: () => void }) {
  return (
    <main className="app-page bg-surface flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-ink text-lg font-bold">책 대화방을 찾을 수 없어요</p>
      <button
        className="bg-primary mt-6 min-h-11 rounded-md px-4 text-sm font-semibold text-white"
        onClick={onBack}
        type="button"
      >
        독서방으로
      </button>
    </main>
  )
}
