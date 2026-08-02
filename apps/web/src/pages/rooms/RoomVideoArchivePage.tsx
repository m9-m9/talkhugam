import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ActionButton } from '@seed-design/react'

import { getRoomVideoPosts, videoKeys } from '../../entities/video'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

/** 책방의 모든 책에서 남긴 영상을 책 제목과 함께 최신순으로 렌더링한다. */
export function RoomVideoArchivePage() {
  const navigate = useNavigate()
  const { roomId } = useParams()
  const videosQuery = useQuery({
    enabled: Boolean(roomId),
    queryFn: () => getRoomVideoPosts(createSupabaseClient(), roomId ?? ''),
    queryKey: videoKeys.byRoom(roomId ?? ''),
  })

  if (!roomId) return <main className="app-page bg-surface min-h-screen" />

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate(`/rooms/${roomId}`)} title="전체 영상 기록" />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">함께 남긴 순간</p>
        <h1 className="text-ink mt-2 text-xl font-bold">책방 전체 영상 기록</h1>
        <p className="text-ink-subtle mt-2 text-sm">
          읽었던 모든 책의 영상을 한곳에서 볼 수 있어요.
        </p>
      </header>
      {videosQuery.isPending ? (
        <div className="mt-12">
          <BookLoadingIndicator label="영상을 불러오고 있어요." />
        </div>
      ) : videosQuery.isError ? (
        <div className="mt-8">
          <RetryState
            message="영상 기록을 불러오지 못했어요."
            onRetry={() => void videosQuery.refetch()}
          />
        </div>
      ) : videosQuery.data?.length ? (
        <ul className="mt-6 space-y-3" aria-label="책방 전체 영상 기록">
          {videosQuery.data.map((video) => (
            <li key={video.id}>
              <ActionButton
                className="border-ink/10 !h-auto min-h-20 w-full !justify-start rounded-lg border !bg-white p-4 text-left"
                onClick={() =>
                  void navigate(`/rooms/${roomId}/books/${video.bookChatId}/videos/${video.id}`)
                }
                size="large"
                type="button"
                variant="neutralWeak"
              >
                <span className="min-w-0">
                  <span className="text-primary block text-xs font-medium">{video.bookTitle}</span>
                  <span className="text-ink mt-1 block text-sm font-semibold">
                    {video.authorName}님의 영상
                  </span>
                  <span className="text-ink-subtle mt-1 block text-xs">
                    {new Date(video.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </span>
              </ActionButton>
            </li>
          ))}
        </ul>
      ) : (
        <div className="talkhugam-information-surface border-ink/10 mt-8 rounded-lg border p-6 text-center">
          <p className="text-ink font-medium">아직 함께 남긴 영상이 없어요</p>
          <p className="text-ink-subtle mt-2 text-sm">
            책 대화의 영상 기록에서 첫 순간을 남겨 보세요.
          </p>
        </div>
      )}
    </main>
  )
}
