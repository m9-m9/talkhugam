import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  createMuxThumbnailUrl,
  filterVideoPosts,
  getVideoFilterMembers,
  getVideoPlaybackAuthorization,
  getVideoPosts,
  videoKeys,
  type VideoFilterMember,
  type VideoPost,
  type VideoPostFilter,
} from '../../entities/video'
import { useVideoUpload } from '../../features/video-upload'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { SelectMenu } from '../../shared/ui/SelectMenu'

export function VideoArchivePage() {
  const navigate = useNavigate()
  const { bookChatId, roomId } = useParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState<VideoPostFilter>({ kind: 'all' })
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

  function handleSelectVideo(file: File | undefined) {
    void uploadVideo(file)
  }

  function handleOpenVideoPicker() {
    fileInputRef.current?.click()
  }

  if (!roomId || !bookChatId) return <main className="app-page bg-surface min-h-screen" />

  const hasVideos = Boolean(videosQuery.data?.length)
  const currentMemberId = membersQuery.data?.find((member) => member.isCurrentUser)?.id ?? null
  const resolvedFilter =
    filter.kind === 'mine' ? { kind: 'mine' as const, memberId: currentMemberId } : filter
  const filteredVideos = filterVideoPosts(videosQuery.data ?? [], resolvedFilter)

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
      {isUploadingVideo ? (
        <div className="mt-4">
          <LoadingSpinner label="영상을 올리고 있어요…" size="sm" />
        </div>
      ) : null}
      {hasVideos ? (
        <VideoFilters
          filter={filter}
          isMemberFilterPending={membersQuery.isPending}
          members={membersQuery.data ?? []}
          onChange={setFilter}
        />
      ) : null}
      {videosQuery.isPending ? (
        <div className="mt-12">
          <LoadingSpinner label="영상을 불러오고 있어요." />
        </div>
      ) : hasVideos ? (
        filteredVideos.length > 0 ? (
          <ul aria-label="영상 기록" className="bg-ink/10 -mx-4 mt-6 grid grid-cols-2 gap-px">
            {filteredVideos.map((video) => (
              <li className="bg-ink min-w-0" key={video.id}>
                <VideoGalleryItem onOpen={() => void navigate(`${video.id}`)} video={video} />
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
      ) : (
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

function VideoFilters({
  filter,
  isMemberFilterPending,
  members,
  onChange,
}: {
  filter: VideoPostFilter
  isMemberFilterPending: boolean
  members: readonly VideoFilterMember[]
  onChange: (filter: VideoPostFilter) => void
}) {
  const selectedMemberId = filter.kind === 'member' ? filter.memberId : ''

  return (
    <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
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
        onClick={() => onChange({ kind: 'mine', memberId: null })}
        type="button"
      >
        내 영상
      </button>
      <SelectMenu
        disabled={isMemberFilterPending}
        label="멤버 필터"
        onChange={(memberId) => {
          onChange(memberId ? { kind: 'member', memberId } : { kind: 'all' })
        }}
        options={[
          { label: '모든 멤버', value: '' },
          ...members.map((member) => ({ label: member.displayName, value: member.id })),
        ]}
        value={selectedMemberId}
      />
    </div>
  )
}

function getFilterButtonClassName(isActive: boolean): string {
  const colorClassName = isActive
    ? 'border-primary bg-primary text-ink'
    : 'border-ink/20 bg-surface text-ink-subtle'
  return `${colorClassName} focus-visible:ring-primary min-h-11 shrink-0 cursor-pointer rounded-lg border px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none`
}

function VideoGalleryItem({ onOpen, video }: { onOpen: () => void; video: VideoPost }) {
  const playbackQuery = useQuery({
    enabled: video.status === 'ready',
    queryFn: () => getVideoPlaybackAuthorization(createSupabaseClient(), video.id),
    queryKey: videoKeys.playback(video.id),
    staleTime: 4 * 60 * 1_000,
  })
  const isReady = video.status === 'ready' && Boolean(playbackQuery.data)

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
        {playbackQuery.data ? (
          <img
            alt=""
            className="absolute inset-0 size-full object-cover"
            src={createMuxThumbnailUrl(playbackQuery.data)}
          />
        ) : (
          <VideoPlaceholder
            isLoading={video.status !== 'failed' && !playbackQuery.isError}
            message={video.status === 'failed' ? '처리 실패' : '준비 중'}
          />
        )}
        {isReady ? <PlayBadge /> : null}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-3 text-left text-xs font-medium text-white">
          {video.authorName}
        </span>
      </div>
    </button>
  )
}

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

function VideoPlaceholder({ isLoading, message }: { isLoading: boolean; message: string }) {
  return (
    <div className="bg-ink absolute inset-0 flex items-center justify-center px-4 text-center">
      {isLoading ? (
        <LoadingSpinner label={message} size="sm" tone="inverse" />
      ) : (
        <p className="text-sm font-medium text-white">{message}</p>
      )}
    </div>
  )
}

function PlusIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2.8" />
    </svg>
  )
}
