import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ChangeEvent, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ActionButton, Dialog, TextField } from '@seed-design/react'

import { bookChatKeys, deleteManagedBookChat, getManagedBookChat } from '../../entities/book-chat'
import {
  bookRatingKeys,
  getBookChatRatings,
  upsertBookChatRating,
  type BookChatRating,
  type BookRatingInput,
} from '../../entities/book-rating'
import {
  invalidateRatingQueries,
  RatingForm,
  storeBookRatingInCache,
} from '../../features/book-rating'
import { useAuthenticatedUser } from '../../features/auth'
import { trackAnalyticsEvent } from '../../shared/analytics'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookCover } from '../../shared/ui/BookCover'
import { BottomSheet } from '../../shared/ui/BottomSheet'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'
import { RatingStars } from '../../shared/ui/RatingStars'

/** 책 대화방의 개인 별점과 삭제 요청을 관리하는 화면을 렌더링한다. */
export function BookChatManagementPage() {
  const client = createSupabaseClient()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profileId = useAuthenticatedUser().id
  const { bookChatId, roomId } = useParams()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isRatingEditorOpen, setIsRatingEditorOpen] = useState(false)
  const bookChatQuery = useQuery({
    enabled: Boolean(roomId && bookChatId),
    queryFn: () => getManagedBookChat(client, roomId ?? '', bookChatId ?? ''),
    queryKey: ['managed-book-chat', bookChatId],
  })
  const ratingsQuery = useQuery({
    enabled: Boolean(bookChatId),
    queryFn: () => getBookChatRatings(client, bookChatId ?? '', profileId),
    queryKey: bookRatingKeys.byChat(bookChatId ?? ''),
  })
  const ratingMutation = useMutation({
    mutationFn: (input: BookRatingInput) => upsertBookChatRating(client, input),
    onSuccess: (_result, input) => {
      storeBookRatingInCache(queryClient, { ...input, profileId })
      setIsRatingEditorOpen(false)
      trackAnalyticsEvent('book_rated')
      invalidateRatingQueries(queryClient, input.bookChatId, profileId)
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
  const ownRating = ratingsQuery.data?.find((rating) => rating.isMe)

  /** 별점 작성 시트를 열어 별점과 총평을 입력받는다. */
  function handleOpenRatingEditor() {
    ratingMutation.reset()
    setIsRatingEditorOpen(true)
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

  /** 별점 작성 시트를 닫고 기존 별점을 유지한다. */
  function handleCloseRatingEditor() {
    setIsRatingEditorOpen(false)
  }

  /** 작성한 별점과 총평을 현재 책 대화의 개인 별점으로 저장한다. */
  function handleSaveRating(input: BookRatingInput) {
    ratingMutation.mutate(input)
  }

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader
        onBack={() => void navigate(`/rooms/${roomId}/books/${bookChatId}`)}
        title="책 대화 관리"
      />
      <header className="mt-8">
        <h1 className="text-ink text-xl font-bold">{chat.title}</h1>
      </header>
      <section className="border-border mt-8 flex items-center gap-4 rounded-lg border bg-white p-4">
        <BookCover alt={`${chat.title} 표지`} thumbnailUrl={chat.thumbnailUrl} />
        <div className="min-w-0 flex-1">
          <span className="text-ink block text-sm font-semibold">{chat.name}</span>
        </div>
      </section>
      <OwnRatingCard
        isSaving={ratingMutation.isPending}
        onOpenEditor={handleOpenRatingEditor}
        ownRating={ownRating}
      />
      <section className="mt-12" aria-labelledby="book-chat-actions">
        <h2 className="text-ink text-base font-semibold" id="book-chat-actions">
          채팅방 관리
        </h2>
        <div className="mt-4 space-y-3">
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
      {isRatingEditorOpen ? (
        <BottomSheet onClose={handleCloseRatingEditor} title="별점 남기기">
          <RatingForm
            bookChatId={bookChatId}
            initialRating={ownRating?.rating ?? null}
            initialReview={ownRating?.review ?? null}
            isSaving={ratingMutation.isPending}
            key={ownRating?.updatedAt ?? 'new-rating'}
            onCancel={handleCloseRatingEditor}
            onSave={handleSaveRating}
            submitLabel={ownRating ? '별점 수정' : '별점 저장'}
          />
          {ratingMutation.isError ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              별점을 저장하지 못했어요. 다시 시도해 주세요.
            </p>
          ) : null}
        </BottomSheet>
      ) : null}
    </main>
  )
}

/** 내 별점이 있으면 별점과 수정 버튼을, 없으면 별점 남기기 버튼을 카드로 렌더링한다. */
function OwnRatingCard({
  isSaving,
  onOpenEditor,
  ownRating,
}: {
  isSaving: boolean
  onOpenEditor: () => void
  ownRating: BookChatRating | undefined
}) {
  return (
    <section
      aria-labelledby="own-rating-heading"
      className="talkhugam-information-surface border-border mt-4 rounded-lg border p-4"
    >
      <h2 className="text-ink text-base font-semibold" id="own-rating-heading">
        내 별점
      </h2>
      <div className="mt-3 flex min-h-11 flex-wrap items-center justify-between gap-3">
        {ownRating ? (
          <RatingStars rating={ownRating.rating} />
        ) : (
          <span className="text-ink-subtle text-sm">아직 별점을 남기지 않았어요.</span>
        )}
        <ActionButton
          className="talkhugam-foundation-action--outline"
          disabled={isSaving}
          onClick={onOpenEditor}
          type="button"
          variant="neutralOutline"
        >
          {ownRating ? '수정하기' : '별점 남기기'}
        </ActionButton>
      </div>
      {ownRating?.review ? (
        <p className="text-ink-subtle mt-2 text-sm">{ownRating.review}</p>
      ) : null}
    </section>
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
    <main className="app-page bg-surface flex min-h-dvh items-center justify-center">
      <BookLoadingIndicator label="책 대화방을 불러오고 있어요." />
    </main>
  )
}

/** 접근할 수 없는 책 대화방일 때 이전 화면으로 복귀할 선택지를 제공한다. */
function BookChatManagementUnavailablePage({ onBack }: { onBack: () => void }) {
  return (
    <main className="app-page bg-surface flex min-h-dvh flex-col items-center justify-center px-4 text-center">
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
