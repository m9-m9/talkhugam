import { useQuery, useQueryClient } from '@tanstack/react-query'
import { bookBestsellerKeys, bookChatKeys, type BookSearchItem } from '@talkhugam/domain'
import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  createMobileBookChat,
  getMobileBookBestsellers,
  mobileBookSearchQuerySchema,
  searchMobileBooks,
} from '../../entities/reading-room'
import { createMobileSupabaseClient } from '../../shared/api/mobileSupabaseClient'
import { mobileColors } from '../../shared/ui/theme'

type MobileBookDiscoveryScreenProps = {
  onBack(): void
  onOpenBookChat(bookChatId: string): void
  roomId: string
}

/** 책 검색과 추천 도서에서 선택한 책으로 현재 책방의 새 대화를 시작한다. */
export function MobileBookDiscoveryScreen({
  onBack,
  onOpenBookChat,
  roomId,
}: MobileBookDiscoveryScreenProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const latestSearchIdRef = useRef(0)
  const creatingBookTitleRef = useRef<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchItems, setSearchItems] = useState<readonly BookSearchItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [creatingBookTitle, setCreatingBookTitle] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  /** 로그인한 회원의 앱 세션으로 노출 가능한 추천 도서를 읽어 온다. */
  async function fetchBestsellers(): Promise<BookSearchItem[]> {
    return getMobileBookBestsellers(createMobileSupabaseClient())
  }

  const bestsellersQuery = useQuery({
    queryFn: fetchBestsellers,
    queryKey: bookBestsellerKeys.current,
    staleTime: 10 * 60 * 1_000,
  })

  /** 새 입력이 이전 검색 응답을 덮어쓰지 못하게 검색 세대를 갱신한다. */
  function handleQueryChange(value: string): void {
    latestSearchIdRef.current += 1
    setQuery(value)
    setSearchItems([])
    setSearchError(null)
    setIsSearching(false)
  }

  /** 검증된 검색어의 최신 요청만 결과·오류 상태에 반영한다. */
  async function searchForLatestQuery(): Promise<void> {
    const parsedQuery = mobileBookSearchQuerySchema.safeParse(query)
    if (!parsedQuery.success) {
      setSearchError('책 제목이나 저자를 두 글자 이상 입력해 주세요.')
      return
    }

    const searchId = latestSearchIdRef.current + 1
    latestSearchIdRef.current = searchId
    setIsSearching(true)
    setSearchError(null)
    setSearchItems([])
    try {
      const items = await searchMobileBooks(createMobileSupabaseClient(), parsedQuery.data)
      if (latestSearchIdRef.current !== searchId) return
      setSearchItems(items)
    } catch {
      if (latestSearchIdRef.current !== searchId) return
      setSearchError('도서 검색을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      if (latestSearchIdRef.current === searchId) setIsSearching(false)
    }
  }

  /** 버튼을 눌렀을 때 현재 입력으로 한 번의 도서 검색을 시작한다. */
  function handleSearch(): void {
    void searchForLatestQuery()
  }

  /** 같은 책의 빠른 연속 선택을 막고 새 대화 생성 후 상세 화면으로 이동한다. */
  async function createBookChat(book: BookSearchItem): Promise<void> {
    if (creatingBookTitleRef.current !== null) return

    creatingBookTitleRef.current = book.title
    setCreatingBookTitle(book.title)
    setCreateError(null)
    try {
      const bookChatId = await createMobileBookChat(createMobileSupabaseClient(), roomId, book)
      await queryClient.invalidateQueries({ queryKey: bookChatKeys.byRoom(roomId) })
      onOpenBookChat(bookChatId)
    } catch {
      setCreateError('이 책을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      creatingBookTitleRef.current = null
      setCreatingBookTitle(null)
    }
  }

  /** 선택한 책으로 대화 생성을 시작하고 진행 중인 중복 선택은 무시한다. */
  function handleSelectBook(book: BookSearchItem): void {
    void createBookChat(book)
  }

  /** 추천 도서 조회 오류를 같은 로그인 세션에서 다시 요청한다. */
  function handleRetryBestsellers(): void {
    void bestsellersQuery.refetch()
  }

  const isShowingSearchResults = query.trim().length >= 2 || isSearching || searchError !== null
  const visibleItems = isShowingSearchResults ? searchItems : (bestsellersQuery.data ?? [])

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <BackButton onPress={onBack} />
          <Text style={styles.headerTitle}>책 추가</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.introduction}>
          <Text style={styles.title}>무슨 책으로 이야기 나눌까요?</Text>
          <Text style={styles.description}>책 제목이나 저자를 검색해 보세요.</Text>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel="책 제목 또는 저자"
            autoCapitalize="none"
            onChangeText={handleQueryChange}
            placeholder="책 제목이나 저자"
            placeholderTextColor="#8C8C8C"
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
            onSubmitEditing={handleSearch}
          />
          <Pressable
            accessibilityLabel="검색"
            accessibilityRole="button"
            accessibilityState={{ busy: isSearching, disabled: isSearching }}
            disabled={isSearching}
            onPress={handleSearch}
            style={({ pressed }) => [styles.searchButton, pressed && styles.searchButtonPressed]}
          >
            <Text style={styles.searchButtonText}>검색</Text>
          </Pressable>
        </View>
        {searchError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {searchError}
          </Text>
        ) : null}
        {createError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {createError}
          </Text>
        ) : null}
        <BookListContent
          books={visibleItems}
          isCreatingBookTitle={creatingBookTitle}
          isLoadingBestsellers={bestsellersQuery.isPending && !isShowingSearchResults}
          isSearching={isSearching}
          isShowingSearchResults={isShowingSearchResults}
          isBestsellersError={bestsellersQuery.isError && !isShowingSearchResults}
          onRetryBestsellers={handleRetryBestsellers}
          onSelectBook={handleSelectBook}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

type BookListContentProps = {
  books: readonly BookSearchItem[]
  isBestsellersError: boolean
  isCreatingBookTitle: string | null
  isLoadingBestsellers: boolean
  isSearching: boolean
  isShowingSearchResults: boolean
  onRetryBestsellers(): void
  onSelectBook(book: BookSearchItem): void
}

/** 검색·추천의 로딩, 오류, 빈 목록과 선택 가능한 도서 카드를 구분해 표시한다. */
function BookListContent({
  books,
  isBestsellersError,
  isCreatingBookTitle,
  isLoadingBestsellers,
  isSearching,
  isShowingSearchResults,
  onRetryBestsellers,
  onSelectBook,
}: BookListContentProps): React.JSX.Element {
  if (isSearching) return <LoadingState label="책을 찾고 있어요." />
  if (isBestsellersError) return <BestsellerErrorState onRetry={onRetryBestsellers} />
  if (books.length === 0 && isShowingSearchResults) return <EmptySearchState />
  if (isLoadingBestsellers) return <LoadingState label="추천 도서를 불러오고 있어요." />
  if (books.length === 0) return <EmptyBestsellerState />

  return (
    <View style={styles.resultsSection}>
      <Text style={styles.resultsTitle}>
        {isShowingSearchResults ? '검색 결과' : '지금 많이 읽는 책'}
      </Text>
      {!isShowingSearchResults ? (
        <Text style={styles.resultsDescription}>
          마음에 드는 책을 골라 책 대화를 시작해 보세요.
        </Text>
      ) : null}
      <View
        accessibilityLabel={isShowingSearchResults ? '검색 도서' : '추천 도서'}
        style={styles.bookList}
      >
        {books.map((book) => (
          <BookCard
            book={book}
            isCreating={isCreatingBookTitle === book.title}
            isDisabled={isCreatingBookTitle !== null}
            key={`${book.title}-${book.isbn13 ?? book.isbn10 ?? book.externalUrl ?? ''}`}
            onSelectBook={onSelectBook}
          />
        ))}
      </View>
    </View>
  )
}

/** 최소 44px 터치 영역으로 책 대화 생성을 시작하는 책 카드를 표시한다. */
function BookCard({
  book,
  isCreating,
  isDisabled,
  onSelectBook,
}: {
  book: BookSearchItem
  isCreating: boolean
  isDisabled: boolean
  onSelectBook(book: BookSearchItem): void
}): React.JSX.Element {
  /** 선택한 도서 모델을 상위 생성 흐름으로 전달한다. */
  function handlePress(): void {
    onSelectBook(book)
  }

  return (
    <Pressable
      accessibilityLabel={`${book.title} 책 대화 시작`}
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.bookCard,
        isDisabled && styles.bookCardDisabled,
        pressed && styles.bookCardPressed,
      ]}
    >
      <View style={styles.coverPlaceholder}>
        <Text accessibilityElementsHidden style={styles.coverPlaceholderText}>
          책
        </Text>
      </View>
      <View style={styles.bookCopy}>
        <Text numberOfLines={2} style={styles.bookTitle}>
          {book.title}
        </Text>
        <Text numberOfLines={2} style={styles.bookMeta}>
          {book.authors.join(', ') || '작가 정보 없음'}
          {book.publisher ? ` · ${book.publisher}` : ''}
        </Text>
        {isCreating ? (
          <View
            accessibilityLabel="책 대화를 만들고 있어요."
            accessibilityRole="progressbar"
            style={styles.creatingState}
          >
            <ActivityIndicator color={mobileColors.accent} />
            <Text style={styles.creatingText}>책 대화를 만들고 있어요.</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

/** 검색 또는 추천 목록을 불러오는 동안 일관된 진행 상태를 표시한다. */
function LoadingState({ label }: { label: string }): React.JSX.Element {
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.state}>
      <ActivityIndicator color={mobileColors.accent} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  )
}

/** 검색에 일치하는 결과가 없는 상태를 간단히 안내한다. */
function EmptySearchState(): React.JSX.Element {
  return (
    <View style={styles.state}>
      <Text style={styles.stateText}>검색 결과가 없어요.</Text>
    </View>
  )
}

/** 설정된 추천 도서가 없을 때 직접 검색을 안내한다. */
function EmptyBestsellerState(): React.JSX.Element {
  return (
    <View style={styles.state}>
      <Text style={styles.stateText}>책 제목이나 저자를 두 글자 이상 입력해 주세요.</Text>
    </View>
  )
}

/** 추천 도서 요청 실패를 검색 흐름과 분리해 재시도 행동을 제공한다. */
function BestsellerErrorState({ onRetry }: { onRetry(): void }): React.JSX.Element {
  return (
    <View style={styles.state}>
      <Text accessibilityRole="alert" style={styles.errorText}>
        추천 도서를 불러오지 못했어요. 다시 시도해 주세요.
      </Text>
      <SecondaryAction label="다시 시도" onPress={onRetry} />
    </View>
  )
}

/** 목록으로 되돌아가는 최소 44px 뒤로 가기 버튼을 표시한다. */
function BackButton({ onPress }: { onPress(): void }): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel="책방으로 돌아가기"
      accessibilityRole="button"
      onPress={onPress}
      style={styles.backButton}
    >
      <Text style={styles.backButtonText}>‹</Text>
    </Pressable>
  )
}

/** 오류 상태에서 재요청하는 최소 44px 보조 행동을 표시한다. */
function SecondaryAction({
  label,
  onPress,
}: {
  label: string
  onPress(): void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.secondaryAction}
    >
      <Text style={styles.secondaryActionText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  backButtonText: { color: mobileColors.ink, fontSize: 32, lineHeight: 36 },
  bookCard: {
    alignItems: 'center',
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 96,
    padding: 12,
  },
  bookCardDisabled: { opacity: 0.65 },
  bookCardPressed: { backgroundColor: mobileColors.surfacePressed, borderColor: mobileColors.inkSubtle },
  bookCopy: { flex: 1, marginLeft: 12 },
  bookList: { gap: 12, marginTop: 16 },
  bookMeta: { color: mobileColors.inkSubtle, fontSize: 14, lineHeight: 20, marginTop: 4 },
  bookTitle: { color: mobileColors.ink, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  container: { backgroundColor: mobileColors.surface, flex: 1, paddingHorizontal: 16 },
  coverPlaceholder: {
    alignItems: 'center',
    backgroundColor: mobileColors.surfaceRaised,
    borderRadius: 8,
    height: 64,
    justifyContent: 'center',
    width: 48,
  },
  coverPlaceholderText: { color: mobileColors.inkSubtle, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  creatingState: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  creatingText: { color: mobileColors.inkSubtle, fontSize: 13, lineHeight: 18 },
  description: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22, marginTop: 8 },
  errorText: { color: mobileColors.danger, fontSize: 15, lineHeight: 22, marginTop: 12, textAlign: 'center' },
  header: { alignItems: 'center', flexDirection: 'row', marginTop: 8 },
  headerSpacer: { minWidth: 44 },
  headerTitle: {
    color: mobileColors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
  introduction: { marginTop: 32 },
  resultsDescription: { color: mobileColors.inkSubtle, fontSize: 14, lineHeight: 20, marginTop: 4 },
  resultsSection: { marginTop: 32 },
  resultsTitle: { color: mobileColors.ink, fontSize: 18, fontWeight: '700', lineHeight: 26 },
  scrollContent: { flexGrow: 1, paddingBottom: 32 },
  searchButton: {
    alignItems: 'center',
    backgroundColor: mobileColors.primaryAction,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  searchButtonPressed: { backgroundColor: mobileColors.primaryActionPressed },
  searchButtonText: { color: mobileColors.primaryActionText, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  searchInput: {
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    color: mobileColors.ink,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 24 },
  secondaryAction: {
    alignItems: 'center',
    borderColor: mobileColors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: 16,
  },
  secondaryActionText: { color: mobileColors.ink, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  state: { alignItems: 'center', gap: 12, minHeight: 180, justifyContent: 'center' },
  stateText: { color: mobileColors.inkSubtle, fontSize: 15, lineHeight: 22, maxWidth: 280, textAlign: 'center' },
  title: { color: mobileColors.ink, fontSize: 24, fontWeight: '700', lineHeight: 32 },
})
