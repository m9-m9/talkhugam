import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ChangeEvent, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ActionButton, Dialog, TextField } from '@seed-design/react'

import { bookChatKeys, deleteManagedBookChat, getManagedBookChat } from '../../entities/book-chat'
import {
  bookCompletionKeys,
  getBookChatCompletions,
  upsertBookChatCompletion,
  type BookCompletionInput,
} from '../../entities/book-completion'
import {
  CompletionReviewForm,
  invalidateCompletionQueries,
  storeBookCompletionInCache,
} from '../../features/book-completion'
import { useAuthenticatedUser } from '../../features/auth'
import { trackAnalyticsEvent } from '../../shared/analytics'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookCover } from '../../shared/ui/BookCover'
import { BottomSheet } from '../../shared/ui/BottomSheet'
import { CompletionMark } from '../../shared/ui/CompletionMark'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'

/** 책 대화방의 개인 완독 기록과 삭제 요청을 관리하는 화면을 렌더링한다. */
export function BookChatManagementPage() {
  const client = createSupabaseClient()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profileId = useAuthenticatedUser().id
  const { bookChatId, roomId } = useParams()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isCompletionEditorOpen, setIsCompletionEditorOpen] = useState(false)
  const bookChatQuery = useQuery({
    enabled: Boolean(bookChatId),
    queryFn: () => getManagedBookChat(client, bookChatId ?? ''),
    queryKey: ['managed-book-chat', bookChatId],
  })
  const completionsQuery = useQuery({
    enabled: Boolean(bookChatId),
    queryFn: () => getBookChatCompletions(client, bookChatId ?? '', profileId),
    queryKey: bookCompletionKeys.byChat(bookChatId ?? ''),
  })
  const completionMutation = useMutation({
    mutationFn: (input: BookCompletionInput) => upsertBookChatCompletion(client, input),
    onSuccess: (_result, input) => {
      storeBookCompletionInCache(queryClient, { ...input, profileId })
      setIsCompletionEditorOpen(false)
      trackAnalyticsEvent('book_completed')
      invalidateCompletionQueries(queryClient, bookChatId ?? '', profileId)
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
  const ownCompletion = completionsQuery.data?.find((completion) => completion.isMe)

  /** 완독 기록 작성 팝업을 열어 별점과 총평을 먼저 입력받는다. */
  function handleOpenCompletionEditor() {
    setIsCompletionEditorOpen(true)
  }

  /** 삭제 확인 다이얼로그를 열어 책 이름 재입력을 요구한다. */
  function handleOpenDeleteDialog() {
    setIsDeleteDialogOpen(true)
  }

  /** 삭제 확인 다이얼로그를 닫고 현재 책 대화방을 유지한다. */
  function handleCloseDeleteDialog() {
    setIsDeleteDialogOpen(false)
  }

  /** 입력한 책 이름을 삭제 요청 mutation으로 전달한다. */
  function handleConfirmDeletion(confirmationName: string) {
    deletionMutation.mutate(confirmationName)
  }

  /** 완독 기록 작성 팝업을 닫고 기존 완독 상태를 유지한다. */
  function handleCloseCompletionEditor() {
    setIsCompletionEditorOpen(false)
  }

  /** 작성한 완독 정보만 서버에 저장해 빈 완독 기록 생성을 막는다. */
  function handleSaveCompletion(input: BookCompletionInput) {
    completionMutation.mutate(input)
  }

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader
        onBack={() => void navigate(`/rooms/${roomId}/books/${bookChatId}`)}
        title="책 대화 관리"
      />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">책 대화</p>
        <h1 className="text-ink mt-2 text-xl font-bold">{chat.title}</h1>
      </header>
      <section className="border-border mt-8 flex items-center gap-4 rounded-lg border bg-white p-4">
        <BookCover alt={`${chat.title} 표지`} thumbnailUrl={chat.thumbnailUrl} />
        <div className="min-w-0 flex-1">
          <span className="text-ink block text-sm font-bold">{chat.name}</span>
          <span className="text-ink-subtle mt-1 block text-xs">내 완독 기록을 남길 수 있어요.</span>
        </div>
        {ownCompletion ? <CompletionMark label="내 완독" /> : null}
      </section>
      <section className="mt-12" aria-labelledby="book-chat-actions">
        <h2 className="text-ink text-base font-bold" id="book-chat-actions">
          채팅방 관리
        </h2>
        <div className="mt-4 space-y-3">
          <ActionButton
            className="w-full justify-start"
            disabled={completionMutation.isPending}
            onClick={handleOpenCompletionEditor}
            size="large"
            type="button"
            variant="neutralOutline"
          >
            {ownCompletion ? '수정하기' : '완독하기'}
          </ActionButton>
          <ActionButton
            className="text-danger w-full justify-start"
            disabled={deletionMutation.isPending}
            onClick={handleOpenDeleteDialog}
            size="large"
            type="button"
            variant="neutralOutline"
          >
            삭제 요청
          </ActionButton>
        </div>
      </section>
      {isDeleteDialogOpen ? (
        <BookChatDeletionDialog
          bookName={chat.name}
          errorMessage={deletionMutation.isError ? '이름이 일치하는지 확인해 주세요.' : null}
          isDeleting={deletionMutation.isPending}
          onCancel={handleCloseDeleteDialog}
          onConfirm={handleConfirmDeletion}
        />
      ) : null}
      {isCompletionEditorOpen ? (
        <BottomSheet onClose={handleCloseCompletionEditor} title="완독 기록">
          <CompletionReviewForm
            bookChatId={bookChatId}
            initialRating={ownCompletion?.rating ?? null}
            initialReview={ownCompletion?.review ?? null}
            isSaving={completionMutation.isPending}
            onCancel={handleCloseCompletionEditor}
            onSave={handleSaveCompletion}
            submitLabel={ownCompletion ? '완독 기록 수정' : '완독 기록 저장'}
          />
          {completionMutation.isError ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              완독 기록을 저장하지 못했어요. 다시 시도해 주세요.
            </p>
          ) : null}
        </BottomSheet>
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

  /** 다이얼로그가 닫힐 때 진행 중이지 않은 삭제 요청만 취소한다. */
  function handleOpenChange(open: boolean) {
    if (!open && !isDeleting) onCancel()
  }

  /** 입력값이 책 이름과 일치할 때만 삭제 요청을 부모 화면에 전달한다. */
  function handleConfirm() {
    onConfirm(confirmationName)
  }

  /** 사용자가 입력한 책 이름을 확인 상태에 반영한다. */
  function handleConfirmationNameChange(event: ChangeEvent<HTMLInputElement>) {
    setConfirmationName(event.target.value)
  }

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open>
      <Dialog.Positioner>
        <Dialog.Backdrop />
        <Dialog.Content className="talkhugam-room-management-dialog">
          <Dialog.Header>
            <Dialog.Title>책 대화방을 삭제할까요?</Dialog.Title>
            <Dialog.Description>
              영상 삭제 요청도 함께 시작돼요. 계속하려면 책 이름을 입력해 주세요.
            </Dialog.Description>
          </Dialog.Header>
          <TextField.Root className="mt-4">
            <TextField.Input
              aria-label="삭제할 책 이름"
              onChange={handleConfirmationNameChange}
              placeholder={bookName}
              value={confirmationName}
            />
          </TextField.Root>
          {errorMessage ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <Dialog.Footer className="!gap-2">
            <ActionButton
              className="flex-1"
              disabled={isDeleting}
              onClick={onCancel}
              size="large"
              type="button"
              variant="neutralOutline"
            >
              취소
            </ActionButton>
            <ActionButton
              className="talkhugam-primary-action flex-1"
              disabled={isDeleting || confirmationName.trim() !== bookName}
              loading={isDeleting}
              onClick={handleConfirm}
              size="large"
              type="button"
              variant="brandSolid"
            >
              삭제 요청하기
            </ActionButton>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}

/** 책 대화방 관리 정보를 기다리는 동안 책 로더를 렌더링한다. */
function BookChatManagementLoadingPage() {
  return (
    <main className="app-page bg-surface flex min-h-screen items-center justify-center">
      <BookLoadingIndicator label="책 대화방을 불러오고 있어요." />
    </main>
  )
}

/** 접근할 수 없는 책 대화방일 때 이전 화면으로 복귀할 선택지를 제공한다. */
function BookChatManagementUnavailablePage({ onBack }: { onBack: () => void }) {
  return (
    <main className="app-page bg-surface flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-ink text-lg font-bold">책 대화방을 찾을 수 없어요</p>
      <ActionButton
        className="talkhugam-primary-action mt-6"
        onClick={onBack}
        size="large"
        type="button"
        variant="brandSolid"
      >
        책방으로
      </ActionButton>
    </main>
  )
}
