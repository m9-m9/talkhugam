import { useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ActionButton, TextField } from '@seed-design/react'

import { useVideoUpload } from '../../features/video-upload'
import { AppHeader } from '../../shared/ui/AppHeader'
import { BookLoadingIndicator } from '../../shared/ui/LoadingSpinner'

/** 책갈피 작성 진입 화면과 촬영·업로드 선택 동작을 렌더링한다. */
export function VideoArchivePage() {
  const navigate = useNavigate()
  const { bookChatId, roomId } = useParams()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [bookmarkSentence, setBookmarkSentence] = useState('')
  const { errorMessage, isUploadingVideo, uploadVideo } = useVideoUpload(bookChatId)

  if (!roomId || !bookChatId) return <main className="app-page bg-surface min-h-screen" />

  /** 선택한 영상 파일과 입력된 문장을 책갈피 업로더로 전달한다. */
  function handleSelectVideo(file: File | undefined) {
    const caption = bookmarkSentence.trim()
    void uploadVideo(file, caption.length > 0 ? caption : undefined)
  }

  /** 모바일 카메라 촬영을 우선하는 영상 선택창을 연다. */
  function handleOpenCameraPicker() {
    cameraInputRef.current?.click()
  }

  /** 기존 영상 파일을 고를 수 있는 업로드 선택창을 연다. */
  function handleOpenUploadPicker() {
    uploadInputRef.current?.click()
  }

  return (
    <main className="app-page bg-surface px-4 pb-8">
      <AppHeader
        onBack={() => void navigate(`/rooms/${roomId}/books/${bookChatId}`)}
        title="책갈피 남기기"
      />
      <section className="mt-6" aria-labelledby="bookmark-create-title">
        <h1
          className="talkhugam-balanced-copy text-ink text-2xl leading-tight font-bold"
          id="bookmark-create-title"
        >
          책갈피를 어떻게 남길까요?
        </h1>
        <p className="talkhugam-balanced-copy text-ink-subtle mt-2 text-sm">
          마음에 든 문장을 적고, 촬영하거나 갤러리에서 영상을 붙여요.
        </p>
      </section>

      {errorMessage ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isUploadingVideo ? (
        <div className="mt-4">
          <BookLoadingIndicator label="책갈피 영상을 올리고 있어요…" size="sm" />
        </div>
      ) : null}

      <input
        accept="video/*"
        aria-label="촬영 영상 선택"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          handleSelectVideo(event.target.files?.[0])
          event.target.value = ''
        }}
        ref={cameraInputRef}
        type="file"
      />
      <input
        accept="video/mp4,video/quicktime"
        aria-label="업로드 영상 선택"
        className="sr-only"
        onChange={(event) => {
          handleSelectVideo(event.target.files?.[0])
          event.target.value = ''
        }}
        ref={uploadInputRef}
        type="file"
      />

      <section aria-label="책갈피 영상 선택" className="mt-6">
        <ul className="grid gap-3">
          <li>
            <BookmarkActionButton
              description="지금 장면을 바로 찍어요"
              disabled={isUploadingVideo}
              icon={<VideoCameraIcon />}
              onClick={handleOpenCameraPicker}
              title="촬영해서 남기기"
              tone="primary"
            />
          </li>
          <li>
            <BookmarkActionButton
              description="이미 찍은 영상을 붙여요"
              disabled={isUploadingVideo}
              icon={<UploadIcon />}
              onClick={handleOpenUploadPicker}
              title="갤러리에서 올리기"
              tone="secondary"
            />
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-2">
        <label
          className="text-ink text-sm font-semibold"
          htmlFor="bookmark-sentence"
          id="bookmark-sentence-label"
        >
          마음에 든 문장
        </label>
        <TextField.Root className="talkhugam-information-field">
          <TextField.Textarea
            aria-label="마음에 든 문장"
            autoresize={false}
            className="min-h-24 text-base"
            id="bookmark-sentence"
            onChange={(event) => setBookmarkSentence(event.target.value)}
            placeholder="마음에 든 문장을 적어 주세요"
            value={bookmarkSentence}
          />
        </TextField.Root>
      </section>
    </main>
  )
}

/** 기록 방식 제목과 설명을 한 줄 카드형 SEED 버튼으로 렌더링한다. */
function BookmarkActionButton({
  description,
  disabled,
  icon,
  onClick,
  title,
  tone,
}: {
  description: string
  disabled: boolean
  icon: ReactNode
  onClick: () => void
  title: string
  tone: 'primary' | 'secondary'
}) {
  const toneClassName =
    tone === 'primary'
      ? 'talkhugam-bookmark-choice talkhugam-bookmark-choice--primary'
      : 'talkhugam-bookmark-choice talkhugam-bookmark-choice--secondary'

  return (
    <ActionButton
      aria-label={`${title} ${description}`}
      className={toneClassName}
      disabled={disabled}
      onClick={onClick}
      size="large"
      type="button"
      variant={tone === 'primary' ? 'neutralSolid' : 'neutralWeak'}
    >
      <span className="talkhugam-bookmark-choice__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="talkhugam-bookmark-choice__copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </ActionButton>
  )
}

/** 촬영 행동을 나타내는 비디오 카메라 아이콘을 렌더링한다. */
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

/** 갤러리 영상 업로드 행동을 나타내는 업로드 아이콘을 렌더링한다. */
function UploadIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 15V5m0 0 4 4m-4-4-4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M5 15v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
