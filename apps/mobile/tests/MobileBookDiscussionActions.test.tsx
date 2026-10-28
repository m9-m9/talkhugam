import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'
import { Pressable, Share, Text, View } from 'react-native'

jest.mock('../src/entities/post')
jest.mock('../src/entities/book-rating')
jest.mock('../src/entities/reading-room')
jest.mock('../src/shared/api/mobileSupabaseClient')
jest.mock('../src/shared/api/MobileAppProviders', () => ({ useMobileSessionProfileId: jest.fn() }))
jest.mock('../src/features/video/MobileVideoUploadSheet', () => ({
  MobileVideoUploadSheet: () => {
    const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native')
    return <MockText>영상 업로드 시트</MockText>
  },
}))
jest.mock('../src/features/photo-quote', () => ({
  MobilePhotoQuoteFlow: jest.fn(),
  pickPhotoForQuote: jest.fn(),
}))

import {
  createMobileDiscussionPost,
  getMobileDiscussionMembers,
  getMobileDiscussionPosts,
} from '../src/entities/post'
import { getMobileBookChatRatings } from '../src/entities/book-rating'
import {
  createMobileInviteShareMessage,
  createMobileRoomInvite,
  getMobileDiscussionBookChat,
  getMobileMyRoomRole,
  requestMobileRoomInvite,
} from '../src/entities/reading-room'
import { MobilePhotoQuoteFlow, pickPhotoForQuote } from '../src/features/photo-quote'
import { MobileBookDiscussionScreen } from '../src/features/reading-room/MobileBookDiscussionScreen'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'
import { useMobileSessionProfileId } from '../src/shared/api/MobileAppProviders'

const roomId = '3f1c2a4e-7b5d-4e6a-9c8b-1a2b3c4d5e01'
const bookChatId = '3f1c2a4e-7b5d-4e6a-9c8b-1a2b3c4d5e02'
const memberId = '3f1c2a4e-7b5d-4e6a-9c8b-1a2b3c4d5e04'
const photo = { height: 4000, uri: 'file:///page.jpg', width: 3000 }

const mockFlow = jest.mocked(MobilePhotoQuoteFlow)
const mockPickPhoto = jest.mocked(pickPhotoForQuote)
const mockCreatePost = jest.mocked(createMobileDiscussionPost)
const mockRole = jest.mocked(getMobileMyRoomRole)

/** 가짜 인용 흐름: 받은 사진 주소와 글에 넣기 버튼만 보여 준다. */
function FakeFlow({ onInsert, photo: flowPhoto }: Parameters<typeof MobilePhotoQuoteFlow>[0]): React.JSX.Element {
  return (
    <View>
      <Text>{flowPhoto ? `사진 흐름 ${flowPhoto.uri}` : '직접 입력 흐름'}</Text>
      <Pressable accessibilityRole="button" onPress={() => onInsert({ page: '87', quote: '남는 쪽의 마음' })}>
        <Text>가짜 글에 넣기</Text>
      </Pressable>
    </View>
  )
}

/** 테스트마다 새 Query cache로 책 대화 화면을 렌더링한다. */
function renderScreen(onOpenVideoArchive = jest.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
  /** 화면이 쓰는 Query Provider를 감싼다. */
  function Wrapper({ children }: PropsWithChildren): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  render(
    <MobileBookDiscussionScreen bookChatId={bookChatId} onBack={jest.fn()} onOpenVideoArchive={onOpenVideoArchive} roomId={roomId} />,
    { wrapper: Wrapper },
  )
  return { onOpenVideoArchive }
}

/** 화면이 준비되길 기다린 뒤 + 메뉴를 연다. */
async function openMenu(): Promise<void> {
  fireEvent.press(await screen.findByRole('button', { name: '메시지 추가 메뉴 열기' }))
}

describe('MobileBookDiscussionScreen message actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(createMobileSupabaseClient).mockReturnValue({} as never)
    jest.mocked(useMobileSessionProfileId).mockReturnValue(memberId)
    jest.mocked(getMobileDiscussionBookChat).mockResolvedValue({
      id: bookChatId, name: '미움받을 용기', roomId, status: 'reading', thumbnailUrl: null, title: '미움받을 용기',
    })
    jest.mocked(getMobileDiscussionPosts).mockResolvedValue([])
    jest.mocked(getMobileDiscussionMembers).mockResolvedValue([])
    jest.mocked(getMobileBookChatRatings).mockResolvedValue([])
    mockCreatePost.mockResolvedValue('post-1')
    mockRole.mockResolvedValue('owner')
    mockFlow.mockImplementation(FakeFlow)
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: jest.fn(() => 'client-1') } })
  })

  it('lists the message actions in the same order and names as the web', async () => {
    renderScreen()
    await screen.findByRole('button', { name: '메시지 추가 메뉴 열기' })
    expect(screen.queryByRole('button', { name: '별점' })).toBeNull()
    expect(screen.queryByRole('button', { name: '영상 기록' })).toBeNull()
    await openMenu()

    const sheet = screen.getByLabelText('메시지 추가')
    await waitFor(() => expect(within(sheet).getByRole('button', { name: '책방 초대하기' })).toBeVisible())
    expect(
      within(sheet).getAllByRole('button').map((button) => button.props.accessibilityLabel),
    ).toEqual(['메시지 추가 닫기', '문장 인용', '라벨', '영상', '별점', '책방 초대하기'])
  })

  it('adds a page label from the label tabs and submits it with the post', async () => {
    renderScreen()
    await openMenu()
    fireEvent.press(screen.getByRole('button', { name: '라벨' }))
    fireEvent.changeText(screen.getByLabelText('페이지 번호'), '87')
    fireEvent.press(screen.getByRole('tab', { name: '챕터' }))
    expect(screen.getByLabelText('챕터 이름 또는 번호')).toBeVisible()
    fireEvent.press(screen.getByRole('tab', { name: '페이지' }))
    expect(screen.getByLabelText('페이지 번호').props.value).toBe('87')
    fireEvent.press(screen.getByRole('button', { name: '라벨 추가' }))

    expect(screen.getByText('페이지 87')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '글 남기기' }))
    await waitFor(() => expect(mockCreatePost).toHaveBeenCalled())
    expect(mockCreatePost.mock.calls[0]?.[3]).toEqual(
      expect.objectContaining({ labels: [{ kind: 'page', value: '87' }] }),
    )
  })

  it('opens direct quote input and inserts the quote with a page label', async () => {
    renderScreen()
    await openMenu()
    fireEvent.press(screen.getByRole('button', { name: '문장 인용' }))
    fireEvent.press(screen.getByRole('button', { name: '직접 입력' }))

    expect(screen.getByText('직접 입력 흐름')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '가짜 글에 넣기' }))

    expect(screen.getByLabelText('대화 입력').props.value).toBe('「남는 쪽의 마음」\n')
    expect(screen.getByText('페이지 87')).toBeVisible()
  })

  it('takes a page photo from the button beside the input and opens the OCR flow', async () => {
    mockPickPhoto.mockResolvedValue({ photo, status: 'picked' })
    renderScreen()

    fireEvent.press(await screen.findByRole('button', { name: '사진에서 문장 가져오기' }))
    expect(screen.getByText('한 페이지만, 위에서 평평하게 찍으면 더 정확해요.')).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '카메라로 찍기' }))

    expect(await screen.findByText('사진 흐름 file:///page.jpg')).toBeVisible()
    expect(mockPickPhoto).toHaveBeenCalledWith('camera')
  })

  it('explains a denied photo library permission', async () => {
    mockPickPhoto.mockResolvedValue({ status: 'denied' })
    renderScreen()
    await openMenu()
    fireEvent.press(screen.getByRole('button', { name: '문장 인용' }))
    fireEvent.press(screen.getByRole('button', { name: '사진에서 가져오기' }))
    fireEvent.press(screen.getByRole('button', { name: '앨범에서 고르기' }))

    expect(await screen.findByText('사진 보관함 권한을 허용해 주세요.')).toBeVisible()
  })

  it('splits video into upload and archive', async () => {
    const { onOpenVideoArchive } = renderScreen()
    await openMenu()
    fireEvent.press(screen.getByRole('button', { name: '영상' }))
    fireEvent.press(within(screen.getByLabelText('영상')).getByRole('button', { name: '영상 기록' }))
    expect(onOpenVideoArchive).toHaveBeenCalledTimes(1)

    await openMenu()
    fireEvent.press(screen.getByRole('button', { name: '영상' }))
    fireEvent.press(screen.getByRole('button', { name: '영상 올리기' }))
    expect(screen.getByText('영상 업로드 시트')).toBeVisible()
  })

  it('shares a new invite for a manager through the device share sheet', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined })
    jest.mocked(createMobileRoomInvite).mockResolvedValue({ code: 'TALK87', expiresAt: '2026-08-19T00:00:00.000Z', token: 'a'.repeat(64) })
    jest.mocked(createMobileInviteShareMessage).mockReturnValue('초대 문구')
    renderScreen()
    await openMenu()
    fireEvent.press(await screen.findByRole('button', { name: '책방 초대하기' }))

    await waitFor(() => expect(share).toHaveBeenCalledWith({ message: '초대 문구' }))
  })

  it('lets a member request an invite instead', async () => {
    mockRole.mockResolvedValue('member')
    jest.mocked(requestMobileRoomInvite).mockResolvedValue(true)
    renderScreen()
    await openMenu()
    fireEvent.press(await screen.findByRole('button', { name: '초대 요청' }))

    expect(await screen.findByText('방장에게 책방 초대를 요청했어요.')).toBeVisible()
  })
})
