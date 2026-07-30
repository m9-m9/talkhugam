import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { getArchivedRooms, roomManagementKeys } from '../../entities/room-management'
import { createSupabaseClient } from '../../shared/api/supabaseClient'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'
import { RetryState } from '../../shared/ui/RetryState'

/** 보관한 책방을 시간순으로 보여 주는 지난 기록 화면을 렌더링한다. */
export function ArchivedRoomsPage() {
  const navigate = useNavigate()
  const archiveQuery = useQuery({
    queryFn: () => getArchivedRooms(createSupabaseClient()),
    queryKey: roomManagementKeys.archive,
  })
  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader onBack={() => void navigate('/rooms')} title="지난 기록" />
      <header className="mt-8">
        <p className="text-primary text-sm font-medium">아카이브</p>
        <h1 className="text-ink mt-2 text-xl font-bold">지난 책방</h1>
        <p className="text-ink-subtle mt-2 text-sm">함께 읽었던 방과 책을 보관해요.</p>
      </header>
      {archiveQuery.isPending ? (
        <div className="mt-12">
          <BookLoadingIndicator label="지난 기록을 불러오고 있어요." />
        </div>
      ) : null}
      {archiveQuery.isError ? (
        <div className="mt-8">
          <RetryState
            message="지난 기록을 불러오지 못했어요."
            onRetry={() => void archiveQuery.refetch()}
          />
        </div>
      ) : null}
      {archiveQuery.data?.length === 0 ? (
        <div className="talkhugam-information-surface border-ink/10 mt-12 rounded-lg border p-6 text-center">
          <p className="text-ink font-semibold">아직 보관한 책방이 없어요</p>
          <p className="text-ink-subtle mt-2 text-sm">
            마지막 방장은 방을 보관한 뒤 나갈 수 있어요.
          </p>
        </div>
      ) : null}
      {archiveQuery.data ? (
        <ul className="mt-8 space-y-3">
          {archiveQuery.data.map((room) => (
            <li className="border-ink/10 rounded-lg border bg-white p-4" key={room.id}>
              <p className="text-ink text-base font-bold">{room.name}</p>
              <p className="text-ink-subtle mt-1 text-sm">{room.description ?? '소개가 없어요.'}</p>
              <p className="text-ink-subtle mt-3 text-xs">
                보관일 {formatArchivedDate(room.archivedAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  )
}

/** 아카이브 시각을 한국어 짧은 날짜 표기로 변환한다. */
function formatArchivedDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value))
}
