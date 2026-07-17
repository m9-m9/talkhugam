import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  deleteVideoPost,
  getVideoDeletePermission,
  getVideoPlaybackAuthorization,
  getVideoPost,
  videoKeys,
} from '../../entities/video'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { ConfirmActionDialog } from '../../shared/ui/ConfirmActionDialog'
import { LazyMuxVideoPlayer } from '../../shared/ui/LazyMuxVideoPlayer'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

type RetryTarget = 'playback' | 'video' | null

/** URL의 독서방·책 대화·영상 식별자를 바탕으로 재생 화면과 조회 상태별 안내를 렌더링한다. */
export function VideoPlayerPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { bookChatId, roomId, videoId } = useParams()
  const archivePath = `/rooms/${roomId ?? ''}/books/${bookChatId ?? ''}/videos`
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [hasPlaybackMediaError, setHasPlaybackMediaError] = useState(false)
  const [retryTarget, setRetryTarget] = useState<RetryTarget>(null)
  const videoQuery = useQuery({
    enabled: Boolean(bookChatId && videoId),
    queryFn: fetchVideoPost,
    queryKey: videoKeys.byPost(videoId ?? ''),
  })
  const playbackQuery = useQuery({
    enabled: videoQuery.data?.status === 'ready',
    queryFn: fetchPlaybackAuthorization,
    queryKey: videoKeys.playback(videoId ?? ''),
    staleTime: 4 * 60 * 1_000,
  })
  const deletePermissionQuery = useQuery({
    enabled: Boolean(roomId && videoQuery.data),
    queryFn: fetchVideoDeletePermission,
    queryKey: videoKeys.deletePermission(roomId ?? '', videoQuery.data?.authorMemberId ?? null),
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteVideoPost(createSupabaseClient(), videoId ?? ''),
    onSuccess: handleVideoDeleteSuccess,
  })

  /** 현재 URL의 책 대화와 영상 식별자로 영상 게시물을 조회해 반환한다. */
  function fetchVideoPost() {
    return getVideoPost(createSupabaseClient(), bookChatId ?? '', videoId ?? '')
  }

  /** 현재 영상 식별자로 Mux 재생 권한과 서명 토큰을 조회해 반환한다. */
  function fetchPlaybackAuthorization() {
    return getVideoPlaybackAuthorization(createSupabaseClient(), videoId ?? '')
  }

  /** 현재 사용자가 이 영상을 삭제할 수 있는지 독서방 멤버 역할로 확인해 반환한다. */
  function fetchVideoDeletePermission() {
    return getVideoDeletePermission(
      createSupabaseClient(),
      roomId ?? '',
      videoQuery.data?.authorMemberId ?? null,
    )
  }

  /** 삭제된 영상 목록 캐시를 무효화한 뒤 사용자를 해당 영상 기록 화면으로 이동시킨다. */
  async function handleVideoDeleteSuccess() {
    await queryClient.invalidateQueries({ queryKey: videoKeys.byBookChat(bookChatId ?? '') })
    void navigate(archivePath, { replace: true })
  }

  /** 영상 삭제 확인 대화상자를 열어 즉시 삭제되는 일을 막는다. */
  function handleOpenDeleteDialog() {
    if (deleteMutation.isPending) return
    setIsDeleteDialogOpen(true)
  }

  /** 영상 삭제 확인 대화상자를 닫고 삭제 제어로 포커스를 돌려준다. */
  function handleCloseDeleteDialog() {
    if (deleteMutation.isPending) return
    setIsDeleteDialogOpen(false)
    deleteTriggerRef.current?.focus()
  }

  /** 사용자가 확인한 영상 삭제 요청을 시작하고 확인 대화상자를 닫는다. */
  function handleConfirmDelete() {
    if (deleteMutation.isPending) return
    setIsDeleteDialogOpen(false)
    deleteMutation.mutate()
  }

  /** 이전에 실패한 영상 삭제 요청을 사용자 확인 없이 같은 게시물에 다시 실행한다. */
  function handleRetryDelete() {
    deleteMutation.mutate()
  }

  /** 실패한 영상 게시물 조회를 다시 요청하고, 진행 중 중복 요청을 막는 상태를 갱신한다. */
  function handleRetryVideo() {
    setRetryTarget('video')
    void videoQuery.refetch().finally(() => setRetryTarget(null))
  }

  /** 실패한 Mux 재생 권한 조회를 다시 요청하고, 진행 중 중복 요청을 막는 상태를 갱신한다. */
  function handleRetryPlayback() {
    setRetryTarget('playback')
    void playbackQuery.refetch().finally(() => setRetryTarget(null))
  }

  /** 실제 Mux 재생 실패 안내를 닫고 최신 재생 권한으로 다시 시도한다. */
  function handleRetryPlaybackMedia() {
    setHasPlaybackMediaError(false)
    void playbackQuery.refetch()
  }

  /** Mux 재생기에서 전달한 미디어 오류를 별도 사용자 상태로 표시한다. */
  function handlePlaybackMediaError() {
    setHasPlaybackMediaError(true)
  }

  /** 영상 기록 화면으로 돌아가도록 라우트를 교체한다. */
  function handleReturnToArchive() {
    void navigate(archivePath, { replace: true })
  }

  /** 잘못된 영상 주소에서 독서방 목록 화면으로 돌아가도록 라우트를 교체한다. */
  function handleReturnToRooms() {
    void navigate('/rooms', { replace: true })
  }

  if (!roomId || !bookChatId || !videoId) {
    return (
      <main className="app-page bg-ink flex min-h-dvh items-center justify-center px-6 text-center">
        <VideoUnavailableState
          message="이 영상 주소를 확인할 수 없어요."
          onReturn={handleReturnToRooms}
        />
      </main>
    )
  }

  const isRetryingVideo = retryTarget === 'video'
  const isRetryingPlayback = retryTarget === 'playback'
  const hasVideoLookupError = videoQuery.isError || isRetryingVideo
  const hasPlaybackLookupError = playbackQuery.isError || isRetryingPlayback
  const isVideoMissing = videoQuery.data === null
  const isVideoUnavailable = videoQuery.data !== undefined && videoQuery.data?.status !== 'ready'
  const isVideoLoading =
    videoQuery.isPending || (videoQuery.data?.status === 'ready' && playbackQuery.isPending)
  const canDeleteVideo = deletePermissionQuery.data?.canDelete === true

  return (
    <>
      <main className="app-page bg-ink flex min-h-dvh flex-col px-0">
        <header className="flex min-h-16 shrink-0 items-center border-b border-white/15 px-4 text-white">
          <button
            aria-label="영상 기록으로 돌아가기"
            className="focus-visible:ring-primary -ml-3 flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
            onClick={handleReturnToArchive}
            type="button"
          >
            <BackIcon />
          </button>
          <h1 className="flex-1 text-center text-base font-bold">영상 보기</h1>
          {videoQuery.data && canDeleteVideo ? (
            <button
              className="focus-visible:ring-primary min-h-11 cursor-pointer rounded-lg px-2 text-sm text-white/80 focus-visible:ring-2 focus-visible:outline-none"
              disabled={deleteMutation.isPending}
              onClick={handleOpenDeleteDialog}
              ref={deleteTriggerRef}
              type="button"
            >
              삭제
            </button>
          ) : (
            <span aria-hidden="true" className="min-w-11" />
          )}
        </header>
        <section
          className="relative flex min-h-0 flex-1 items-center justify-center"
          aria-label="영상 재생"
        >
          {hasVideoLookupError ? (
            <VideoLookupErrorState
              isRetrying={isRetryingVideo}
              onRetry={handleRetryVideo}
              onReturn={handleReturnToArchive}
            />
          ) : isVideoMissing ? (
            <VideoUnavailableState
              message="이 영상을 찾을 수 없어요."
              onReturn={handleReturnToArchive}
            />
          ) : hasPlaybackLookupError ? (
            <PlaybackLookupErrorState
              isRetrying={isRetryingPlayback}
              onRetry={handleRetryPlayback}
              onReturn={handleReturnToArchive}
            />
          ) : hasPlaybackMediaError ? (
            <PlaybackMediaErrorState
              onRetry={handleRetryPlaybackMedia}
              onReturn={handleReturnToArchive}
            />
          ) : isVideoLoading ? (
            <LoadingSpinner label="영상을 준비하고 있어요." tone="inverse" />
          ) : playbackQuery.data ? (
            <LazyMuxVideoPlayer
              className="absolute inset-0 size-full"
              metadata={{ videoId, videoTitle: 'Talk후감 영상' }}
              onPlaybackError={handlePlaybackMediaError}
              playbackId={playbackQuery.data.playbackId}
              tone="inverse"
              tokens={{
                playback: playbackQuery.data.token,
                thumbnail: playbackQuery.data.thumbnailToken,
              }}
            />
          ) : isVideoUnavailable ? (
            <VideoUnavailableState
              message="이 영상은 아직 재생할 수 없어요."
              onReturn={handleReturnToArchive}
            />
          ) : null}
          {deleteMutation.isError ? <VideoDeleteErrorState onRetry={handleRetryDelete} /> : null}
        </section>
      </main>
      {isDeleteDialogOpen ? (
        <ConfirmActionDialog
          confirmLabel="영상 삭제하기"
          description="삭제한 영상은 복구할 수 없어요."
          isConfirming={deleteMutation.isPending}
          onClose={handleCloseDeleteDialog}
          onConfirm={handleConfirmDelete}
          title="영상 삭제"
        />
      ) : null}
    </>
  )
}

/** Mux 미디어 자체가 재생되지 않을 때 재시도·보관함 복귀 흐름을 렌더링한다. */
function PlaybackMediaErrorState({
  onRetry,
  onReturn,
}: {
  onRetry: () => void
  onReturn: () => void
}) {
  return (
    <PlayerLookupErrorState
      isRetrying={false}
      loadingLabel=""
      message="영상을 재생하지 못했어요. 다시 시도해 주세요."
      onRetry={onRetry}
      onReturn={onReturn}
      retryLabel="재생 다시 시도"
    />
  )
}

/** 영상 기록으로 돌아가는 제어를 위한 왼쪽 화살표 SVG 요소를 반환한다. */
function BackIcon() {
  return (
    <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
      <path d="m14.5 5-7 7 7 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

/** 존재하지 않거나 아직 재생할 수 없는 영상을 안내하고 보관함 복귀 제어를 렌더링한다. */
function VideoUnavailableState({ message, onReturn }: { message: string; onReturn: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-white" role="alert">
        {message}
      </p>
      <button
        className="border-primary text-primary min-h-11 cursor-pointer rounded-md border px-4 text-sm font-semibold"
        onClick={onReturn}
        type="button"
      >
        영상 기록으로 가기
      </button>
    </div>
  )
}

/** 영상 게시물 조회 오류의 재시도·보관함 복귀 흐름과 진행 중 상태를 렌더링한다. */
function VideoLookupErrorState({
  isRetrying,
  onRetry,
  onReturn,
}: {
  isRetrying: boolean
  onRetry: () => void
  onReturn: () => void
}) {
  return (
    <PlayerLookupErrorState
      isRetrying={isRetrying}
      loadingLabel="영상을 다시 불러오고 있어요."
      message="영상을 불러오지 못했어요. 다시 시도해 주세요."
      onRetry={onRetry}
      onReturn={onReturn}
    />
  )
}

/** Mux 재생 권한 조회 오류의 재시도·보관함 복귀 흐름과 진행 중 상태를 렌더링한다. */
function PlaybackLookupErrorState({
  isRetrying,
  onRetry,
  onReturn,
}: {
  isRetrying: boolean
  onRetry: () => void
  onReturn: () => void
}) {
  return (
    <PlayerLookupErrorState
      isRetrying={isRetrying}
      loadingLabel="재생 정보를 다시 불러오고 있어요."
      message="재생 정보를 불러오지 못했어요. 다시 시도해 주세요."
      onRetry={onRetry}
      onReturn={onReturn}
    />
  )
}

/** 영상 삭제 실패를 안내하고 같은 삭제 요청을 다시 보낼 수 있는 제어를 렌더링한다. */
function VideoDeleteErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-6 z-10">
      <RetryState
        message="영상을 삭제하지 못했어요. 다시 시도해 주세요."
        onRetry={onRetry}
        retryLabel="삭제 다시 시도"
      />
    </div>
  )
}

/** 오류 문구와 재시도 작업을 입력받아 공통 재생 조회 오류 UI를 반환한다. */
function PlayerLookupErrorState({
  isRetrying,
  loadingLabel,
  message,
  onRetry,
  onReturn,
  retryLabel,
}: {
  isRetrying: boolean
  loadingLabel: string
  message: string
  onRetry: () => void
  onReturn: () => void
  retryLabel?: string
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 text-center">
      <RetryState
        isRetrying={isRetrying}
        message={message}
        onRetry={onRetry}
        {...(retryLabel === undefined ? {} : { retryLabel })}
      />
      {isRetrying ? <LoadingSpinner label={loadingLabel} size="sm" tone="inverse" /> : null}
      <button
        className="min-h-11 cursor-pointer px-3 text-sm font-medium text-white/80"
        onClick={onReturn}
        type="button"
      >
        영상 기록으로 가기
      </button>
    </div>
  )
}
