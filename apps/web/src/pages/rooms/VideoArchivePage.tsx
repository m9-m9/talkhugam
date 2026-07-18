import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  createMuxThumbnailUrl,
  filterVideoPosts,
  getVideoFilterMembers,
  getVideoPosts,
  getVideoThumbnailAuthorizations,
  mapVideoThumbnailAuthorizations,
  videoKeys,
  type VideoFilterMember,
  type VideoPost,
  type VideoPostFilter,
  type VideoThumbnailAuthorization,
} from '../../entities/video'
import { useVideoUpload } from '../../features/video-upload'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'
import { SelectMenu } from '../../shared/ui/SelectMenu'

/** 영상 보관함 페이지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
export function VideoArchivePage() {
  const navigate = useNavigate()
  const { bookChatId, roomId } = useParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState<VideoPostFilter>({ kind: 'all' })
  const [isRetryingVideos, setIsRetryingVideos] = useState(false)
  const { errorMessage, isUploadingVideo, uploadVideo } = useVideoUpload(bookChatId)
  const videosQuery = useQuery({
    enabled: Boolean(bookChatId),
    queryFn: () => getVideoPosts(createSupabaseClient(), bookChatId ?? ''),
    queryKey: videoKeys.byBookChat(bookChatId ?? ''),
    refetchInterval: (query) =>
      query.state.data?.some(
        (video) => video.status === 'waiting_upload' || video.status === 'processing',
      )
        ? 3_000
        : false,
  })
  const membersQuery = useQuery({
    enabled: Boolean(roomId),
    queryFn: () => getVideoFilterMembers(createSupabaseClient(), roomId ?? ''),
    queryKey: videoKeys.members(roomId ?? ''),
  })
  const readyVideoPostIds = (videosQuery.data ?? [])
    .filter((video) => video.status === 'ready')
    .map((video) => video.id)
  const thumbnailsQuery = useQuery({
    enabled: readyVideoPostIds.length > 0,
    queryFn: () => getVideoThumbnailAuthorizations(createSupabaseClient(), readyVideoPostIds),
    queryKey: videoKeys.thumbnails(readyVideoPostIds),
    staleTime: 4 * 60 * 1_000,
  })
  const thumbnailsByPostId = mapVideoThumbnailAuthorizations(thumbnailsQuery.data ?? [])

  /** Select 영상 요청이나 사용자 동작을 처리한다. */
  function handleSelectVideo(file: File | undefined) {
    void uploadVideo(file)
  }

  /** Open 영상 선택창 요청이나 사용자 동작을 처리한다. */
  function handleOpenVideoPicker() {
    fileInputRef.current?.click()
  }

  if (!roomId || !bookChatId) return <main className="app-page bg-surface min-h-screen" />

  const hasVideos = Boolean(videosQuery.data?.length)
  const currentMemberId = membersQuery.data?.find((member) => member.isCurrentUser)?.id ?? null
  const resolvedFilter =
    filter.kind === 'mine' ? { kind: 'mine' as const, memberId: currentMemberId } : filter
  const filteredVideos = filterVideoPosts(videosQuery.data ?? [], resolvedFilter)
  const shouldShowVideoLoadError = videosQuery.isError || isRetryingVideos

  /** 실패한 멤버 필터 조회를 다시 요청하고 최신 상태를 반영한다. */
  function handleRetryMembers() {
    void membersQuery.refetch()
  }

  /**
   * 입력 없이 실패한 영상 목록 조회를 다시 요청하고 재시도 중 화면 상태를 유지한다.
   * @returns 반환값 없이 비동기 조회 시작을 예약한다.
   */
  function handleRetryVideos() {
    setIsRetryingVideos(true)
    void videosQuery.refetch().finally(() => setIsRetryingVideos(false))
  }

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader
        onBack={() => void navigate(`/rooms/${roomId}/books/${bookChatId}`)}
        title="영상 기록"
      />
      <header className="mt-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-xl font-bold">함께 남긴 독서 순간</h1>
          <p className="text-ink-subtle mt-2 text-sm">이 책을 읽으며 남긴 30초 영상이에요.</p>
        </div>
        <input
          accept="video/mp4,video/quicktime"
          aria-label="영상 파일 선택"
          className="sr-only"
          onChange={(event) => {
            handleSelectVideo(event.target.files?.[0])
            event.target.value = ''
          }}
          ref={fileInputRef}
          type="file"
        />
        {hasVideos ? (
          <button
            className="border-primary/50 bg-surface-muted text-ink hover:border-primary focus-visible:ring-primary flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            disabled={isUploadingVideo}
            onClick={handleOpenVideoPicker}
            type="button"
          >
            <VideoCameraIcon />
            영상 추가
          </button>
        ) : null}
      </header>
      {errorMessage ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {shouldShowVideoLoadError ? (
        <VideoArchiveLoadError isRetrying={isRetryingVideos} onRetry={handleRetryVideos} />
      ) : null}
      {isUploadingVideo ? (
        <div className="mt-4">
          <LoadingSpinner label="영상을 올리고 있어요…" size="sm" variant="book" />
        </div>
      ) : null}
      {membersQuery.isError ? <MemberFilterLoadError onRetry={handleRetryMembers} /> : null}
      {hasVideos ? (
        <VideoFilters
          filter={filter}
          hasMemberLoadError={membersQuery.isError}
          isMemberFilterPending={membersQuery.isPending}
          members={membersQuery.data ?? []}
          onChange={setFilter}
        />
      ) : null}
      {videosQuery.isPending && !isRetryingVideos ? (
        <div className="mt-12">
          <LoadingSpinner label="영상을 불러오고 있어요." variant="book" />
        </div>
      ) : hasVideos ? (
        filteredVideos.length > 0 ? (
          <ul aria-label="영상 기록" className="-mx-4 mt-6 grid grid-cols-2 gap-px">
            {filteredVideos.map((video) => (
              <li className="bg-ink min-w-0" key={video.id}>
                <VideoGalleryItem
                  isThumbnailLoading={thumbnailsQuery.isLoading}
                  onOpen={() => void navigate(`${video.id}`)}
                  thumbnailAuthorization={thumbnailsByPostId.get(video.id)}
                  video={video}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8 flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-ink-subtle text-sm">선택한 멤버의 영상이 없어요.</p>
            <button
              className="text-primary min-h-11 cursor-pointer px-3 text-sm font-medium"
              onClick={() => setFilter({ kind: 'all' })}
              type="button"
            >
              전체 영상 보기
            </button>
          </div>
        )
      ) : shouldShowVideoLoadError ? null : (
        <button
          aria-label="첫 영상 올리기"
          className="border-primary/50 bg-surface-muted hover:border-primary focus-visible:ring-primary mt-8 flex min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          disabled={isUploadingVideo}
          onClick={handleOpenVideoPicker}
          type="button"
        >
          <span
            aria-hidden="true"
            className="bg-primary text-ink flex size-12 items-center justify-center rounded-full shadow-sm"
          >
            <PlusIcon className="size-6" />
          </span>
          <span className="text-ink text-sm font-semibold">첫 영상 올리기</span>
        </button>
      )}
    </main>
  )
}

/**
 * 재시도 상태와 재요청 handler를 입력받아 영상 목록 조회 오류 안내 UI를 반환한다.
 * @returns 오류 문구, 재시도 버튼 및 진행 중 책 로딩 스피너를 포함한 React 요소를 반환한다.
 */
function VideoArchiveLoadError({
  isRetrying,
  onRetry,
}: {
  isRetrying: boolean
  onRetry: () => void
}) {
  return (
    <div className="mt-8">
      <RetryState
        isRetrying={isRetrying}
        message="영상 기록을 불러오지 못했어요. 다시 시도해 주세요."
        onRetry={onRetry}
      />
      {isRetrying ? (
        <div className="mt-4">
          <LoadingSpinner label="영상을 다시 불러오고 있어요." size="sm" variant="book" />
        </div>
      ) : null}
    </div>
  )
}

/** 영상 필터 목록 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function VideoFilters({
  filter,
  hasMemberLoadError,
  isMemberFilterPending,
  members,
  onChange,
}: {
  filter: VideoPostFilter
  hasMemberLoadError: boolean
  isMemberFilterPending: boolean
  members: readonly VideoFilterMember[]
  onChange: (filter: VideoPostFilter) => void
}) {
  const selectedMemberId = filter.kind === 'member' ? filter.memberId : ''

  const isMemberFilterDisabled = isMemberFilterPending || hasMemberLoadError
  const containerClassName = hasMemberLoadError ? 'mt-3' : 'mt-6'

  return (
    <div className={containerClassName}>
      <div className="flex items-center gap-2 pb-1">
        <button
          aria-pressed={filter.kind === 'all'}
          className={getFilterButtonClassName(filter.kind === 'all')}
          onClick={() => onChange({ kind: 'all' })}
          type="button"
        >
          전체
        </button>
        <button
          aria-pressed={filter.kind === 'mine'}
          className={getFilterButtonClassName(filter.kind === 'mine')}
          disabled={isMemberFilterDisabled}
          onClick={() => onChange({ kind: 'mine', memberId: null })}
          type="button"
        >
          내 영상
        </button>
        <SelectMenu
          disabled={isMemberFilterDisabled}
          label="멤버 필터"
          menuTitle="누구의 영상?"
          onChange={(memberId) => {
            onChange(memberId ? { kind: 'member', memberId } : { kind: 'all' })
          }}
          options={[
            { label: '모든 멤버', value: '' },
            ...members.map((member) => ({
              badge: member.displayName.slice(0, 1),
              label: member.displayName,
              value: member.id,
            })),
          ]}
          value={selectedMemberId}
        />
      </div>
    </div>
  )
}

/** 멤버 필터를 불러오지 못했을 때 안내와 재시도 동작을 제공한다. */
function MemberFilterLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-6 flex items-center justify-between gap-2" role="alert">
      <p className="text-sm text-red-600">멤버를 불러오지 못했어요. 다시 시도해 주세요.</p>
      <button
        className="text-primary min-h-11 shrink-0 cursor-pointer px-3 text-sm font-medium"
        onClick={onRetry}
        type="button"
      >
        멤버 다시 시도
      </button>
    </div>
  )
}

/** 필터 버튼 Class 이름 데이터를 조회하거나 계산해 반환한다. */
function getFilterButtonClassName(isActive: boolean): string {
  const colorClassName = isActive
    ? 'border-primary bg-primary text-ink'
    : 'border-ink/20 bg-surface text-ink-subtle'
  return `${colorClassName} focus-visible:ring-primary min-h-11 shrink-0 cursor-pointer rounded-lg border px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50`
}

/** 영상 갤러리 항목 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function VideoGalleryItem({
  isThumbnailLoading,
  onOpen,
  thumbnailAuthorization,
  video,
}: {
  isThumbnailLoading: boolean
  onOpen: () => void
  thumbnailAuthorization: VideoThumbnailAuthorization | undefined
  video: VideoPost
}) {
  const isReady = video.status === 'ready'
  const placeholderMessage = getThumbnailPlaceholderMessage(video.status, isThumbnailLoading)

  return (
    <button
      aria-label={
        isReady ? `${video.authorName}님의 영상 보기` : `${video.authorName}님의 영상 상태`
      }
      className="focus-visible:ring-primary relative block w-full cursor-pointer focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default"
      disabled={!isReady}
      onClick={onOpen}
      type="button"
    >
      <div className="bg-ink relative aspect-square overflow-hidden">
        {thumbnailAuthorization ? (
          <img
            alt=""
            className="absolute inset-0 size-full object-cover"
            src={createMuxThumbnailUrl(thumbnailAuthorization)}
          />
        ) : (
          <VideoPlaceholder isLoading={isThumbnailLoading} message={placeholderMessage} />
        )}
        {isReady ? <PlayBadge /> : null}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-3 text-left text-xs font-medium text-white">
          {video.authorName}
        </span>
      </div>
    </button>
  )
}

/** 영상 상태와 썸네일 조회 상태를 조합해 갤러리 안내 문구를 반환한다. */
function getThumbnailPlaceholderMessage(
  status: VideoPost['status'],
  isThumbnailLoading: boolean,
): string {
  if (status === 'failed') return '처리 실패'
  if (status !== 'ready') return '준비 중'
  return isThumbnailLoading ? '미리보기 준비 중' : '미리보기를 불러오지 못했어요'
}

/** 재생 배지 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function PlayBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-sm"
    >
      <svg className="ml-0.5 size-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5.7v12.6L18 12 8 5.7Z" />
      </svg>
    </span>
  )
}

/** 영상 카메라 아이콘 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function VideoCameraIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.8" width="14" x="3" y="6" />
      <path
        d="m17 10 3.5-2v8L17 14v-4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

/** 영상 대기 상태 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function VideoPlaceholder({ isLoading, message }: { isLoading: boolean; message: string }) {
  return (
    <div className="bg-ink absolute inset-0 flex items-center justify-center px-4 text-center">
      {isLoading ? (
        <LoadingSpinner label={message} size="sm" tone="inverse" variant="book" />
      ) : (
        <p className="text-sm font-medium text-white">{message}</p>
      )}
    </div>
  )
}

/** 추가 아이콘 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다. */
function PlusIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2.8" />
    </svg>
  )
}
