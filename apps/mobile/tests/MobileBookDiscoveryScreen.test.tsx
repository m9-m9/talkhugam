import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { PropsWithChildren } from 'react'

jest.mock('../src/entities/reading-room', () => {
  const actual = jest.requireActual<typeof import('../src/entities/reading-room')>(
    '../src/entities/reading-room',
  )
  return {
    ...actual,
    createMobileBookChat: jest.fn(),
    getMobileBookBestsellers: jest.fn(),
    searchMobileBooks: jest.fn(),
  }
})
jest.mock('../src/shared/api/mobileSupabaseClient')

import {
  createMobileBookChat,
  getMobileBookBestsellers,
  searchMobileBooks,
} from '../src/entities/reading-room'
import { MobileBookDiscoveryScreen } from '../src/features/reading-room/MobileBookDiscoveryScreen'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'

const roomId = '00000000-0000-4000-8000-000000000001'
const bookChatId = '00000000-0000-4000-8000-000000000002'
const book = {
  authors: ['기시미 이치로'],
  externalUrl: 'https://example.com/book',
  isbn10: null,
  isbn13: '9781234567890',
  publishedAt: '2014-11-17',
  publisher: '인플루엔셜',
  source: 'kakao' as const,
  thumbnailUrl: null,
  title: '미움받을 용기',
}

const mockCreateMobileBookChat = jest.mocked(createMobileBookChat)
const mockGetMobileBookBestsellers = jest.mocked(getMobileBookBestsellers)
const mockSearchMobileBooks = jest.mocked(searchMobileBooks)
const mockCreateMobileSupabaseClient = jest.mocked(createMobileSupabaseClient)

/** 화면 상태를 격리할 Query Client를 생성한다. */
function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
}

/** 실제 서버 상태 Provider를 화면 테스트에 제공하는 래퍼를 반환한다. */
function createQueryWrapper(
  queryClient = createQueryClient(),
): ({ children }: PropsWithChildren) => React.JSX.Element {
  /** 테스트마다 독립된 query cache를 사용한다. */
  return function QueryWrapper({ children }: PropsWithChildren): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('MobileBookDiscoveryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateMobileSupabaseClient.mockReturnValue({} as never)
    mockGetMobileBookBestsellers.mockResolvedValue([book])
    mockSearchMobileBooks.mockResolvedValue([])
    mockCreateMobileBookChat.mockResolvedValue(bookChatId)
  })

  it('shows the latest matching search result instead of an earlier result', async () => {
    const first = createDeferred<Array<typeof book>>()
    const second = createDeferred<Array<typeof book>>()
    mockSearchMobileBooks.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    render(
      <MobileBookDiscoveryScreen onBack={jest.fn()} onOpenBookChat={jest.fn()} roomId={roomId} />,
      {
        wrapper: createQueryWrapper(),
      },
    )

    await screen.findByText('지금 많이 읽는 책')
    fireEvent.changeText(screen.getByLabelText('책 제목 또는 저자'), '미움')
    fireEvent.press(screen.getByRole('button', { name: '검색' }))
    fireEvent.changeText(screen.getByLabelText('책 제목 또는 저자'), '용기')
    fireEvent.press(screen.getByRole('button', { name: '검색' }))
    second.resolve([{ ...book, title: '용기의 기술' }])

    expect(await screen.findByText('용기의 기술')).toBeVisible()
    first.resolve([book])
    await waitFor(() => expect(screen.queryByText('미움받을 용기')).toBeNull())
  })

  it('shows a retryable search error and clears the loading state', async () => {
    mockSearchMobileBooks
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce([])

    render(
      <MobileBookDiscoveryScreen onBack={jest.fn()} onOpenBookChat={jest.fn()} roomId={roomId} />,
      {
        wrapper: createQueryWrapper(),
      },
    )

    await screen.findByText('지금 많이 읽는 책')
    fireEvent.changeText(screen.getByLabelText('책 제목 또는 저자'), '미움')
    fireEvent.press(screen.getByRole('button', { name: '검색' }))

    expect(
      await screen.findByRole('alert', {
        name: '도서 검색을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
      }),
    ).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '검색' }))
    await waitFor(() => expect(mockSearchMobileBooks).toHaveBeenCalledTimes(2))
  })

  it('retries a failed bestseller request and replaces the error with its result', async () => {
    mockGetMobileBookBestsellers
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce([book])

    render(
      <MobileBookDiscoveryScreen onBack={jest.fn()} onOpenBookChat={jest.fn()} roomId={roomId} />,
      {
        wrapper: createQueryWrapper(),
      },
    )

    expect(
      await screen.findByRole('alert', {
        name: '추천 도서를 불러오지 못했어요. 다시 시도해 주세요.',
      }),
    ).toBeVisible()
    fireEvent.press(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(mockGetMobileBookBestsellers).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: '미움받을 용기 책 대화 시작' })).toBeVisible()
    expect(
      screen.queryByRole('alert', { name: '추천 도서를 불러오지 못했어요. 다시 시도해 주세요.' }),
    ).toBeNull()
  })

  it('prevents double submission, invalidates the room book list, and opens the new conversation', async () => {
    const queryClient = createQueryClient()
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')
    let resolveCreate: ((id: string) => void) | undefined
    mockCreateMobileBookChat.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve
      }),
    )
    const onOpenBookChat = jest.fn()

    render(
      <MobileBookDiscoveryScreen
        onBack={jest.fn()}
        onOpenBookChat={onOpenBookChat}
        roomId={roomId}
      />,
      {
        wrapper: createQueryWrapper(queryClient),
      },
    )

    fireEvent.press(await screen.findByRole('button', { name: '미움받을 용기 책 대화 시작' }))
    fireEvent.press(screen.getByRole('button', { name: '미움받을 용기 책 대화 시작' }))
    expect(mockCreateMobileBookChat).toHaveBeenCalledTimes(1)
    resolveCreate?.(bookChatId)

    await waitFor(() => expect(onOpenBookChat).toHaveBeenCalledWith(bookChatId))
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['book-chats', roomId] })
  })

  it('keeps the selected book available after creation fails and lets the member retry', async () => {
    mockCreateMobileBookChat
      .mockRejectedValueOnce(new Error('rpc failed'))
      .mockResolvedValueOnce(bookChatId)
    const onOpenBookChat = jest.fn()

    render(
      <MobileBookDiscoveryScreen
        onBack={jest.fn()}
        onOpenBookChat={onOpenBookChat}
        roomId={roomId}
      />,
      {
        wrapper: createQueryWrapper(),
      },
    )

    const bookButton = await screen.findByRole('button', { name: '미움받을 용기 책 대화 시작' })
    fireEvent.press(bookButton)

    expect(
      await screen.findByRole('alert', {
        name: '이 책을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.',
      }),
    ).toBeVisible()
    expect(bookButton).toBeEnabled()
    fireEvent.press(bookButton)

    await waitFor(() => expect(mockCreateMobileBookChat).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onOpenBookChat).toHaveBeenCalledWith(bookChatId))
  })
})

/** 비동기 요청 완료 시점을 테스트가 직접 제어할 Promise를 만든다. */
function createDeferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolvePromise: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })

  /** 생성 시점에 연결된 Promise를 원하는 값으로 완료한다. */
  function resolve(value: T): void {
    resolvePromise?.(value)
  }

  return { promise, resolve }
}
