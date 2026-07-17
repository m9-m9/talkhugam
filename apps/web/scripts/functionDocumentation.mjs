import ts from 'typescript'

/** 파일 확장자에 맞는 TypeScript AST를 생성한다. */
function createSourceFile(source, fileName) {
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind)
}

/** AST 노드가 이름을 가진 문서화 대상 함수인지 확인하고 관련 정보를 반환한다. */
function getNamedFunction(node) {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return { commentNode: node, name: node.name.text }
  }

  if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
    return { commentNode: node, name: node.name.text }
  }

  if (ts.isConstructorDeclaration(node)) {
    return { commentNode: node, name: 'constructor' }
  }

  if (
    ts.isPropertyAssignment(node) &&
    ts.isIdentifier(node.name) &&
    ts.isObjectLiteralExpression(node.parent) &&
    ts.isVariableDeclaration(node.parent.parent) &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  ) {
    return { commentNode: node, name: node.name.text }
  }

  if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) {
    return null
  }

  if (!ts.isArrowFunction(node.initializer) && !ts.isFunctionExpression(node.initializer)) {
    return null
  }

  const declarationList = node.parent
  const variableStatement = declarationList.parent
  const commentNode = ts.isVariableStatement(variableStatement) ? variableStatement : node
  return { commentNode, name: node.name.text }
}

/** 대상 노드 바로 앞에 JSDoc 블록이 있는지 판별한다. */
function hasLeadingJsDoc(source, node) {
  const ranges = ts.getLeadingCommentRanges(source, node.getFullStart()) ?? []
  return ranges.some((range) => {
    const comment = source.slice(range.pos, range.end)
    return comment.startsWith('/**') && /[가-힣]/.test(comment)
  })
}

/** camelCase 또는 PascalCase 함수명에서 동사 뒤의 책임 대상을 분리한다. */
function getFunctionTarget(name, prefix) {
  const target = name.slice(prefix.length)
  return translateFunctionTarget(target || name)
}

/** 함수 식별자의 영문 도메인 단어를 읽기 쉬운 한글 책임 대상으로 변환한다. */
function translateFunctionTarget(target) {
  const vocabulary = {
    Action: '동작',
    Address: '주소',
    Admin: '관리자',
    Allowed: '허용된',
    App: '앱',
    Archive: '보관함',
    Auth: '인증',
    Authenticated: '인증',
    Avatars: '프로필 이미지 목록',
    Back: '뒤로가기',
    Badge: '배지',
    Bottom: '하단',
    Button: '버튼',
    Callback: 'callback',
    Camera: '카메라',
    Change: '변경',
    Chat: '대화',
    Chats: '대화 목록',
    Check: '선택 표시',
    Chevron: '펼침 표시',
    Code: '코드',
    Composer: '입력창',
    Content: '콘텐츠',
    Copy: '복사',
    Cover: '표지',
    Create: '생성',
    Created: '생성 완료',
    Delete: '삭제',
    Detail: '상세',
    Document: '도서 검색 문서',
    Draft: '작성 중',
    Empty: '빈',
    Escape: 'Escape 키',
    Event: '이벤트',
    Field: '입력 필드',
    Filter: '필터',
    Filters: '필터 목록',
    Fingerprint: '식별값',
    Gallery: '갤러리',
    Header: '헤더',
    Home: '홈',
    Icon: '아이콘',
    Id: 'ID',
    Item: '항목',
    Join: '참여',
    Json: 'JSON',
    Labels: '라벨 목록',
    Last: '최근',
    Layout: '레이아웃',
    Link: '링크',
    List: '목록',
    Loading: '로딩',
    Logo: '로고',
    Mbti: 'MBTI',
    Menu: '메뉴',
    Messages: '메시지 목록',
    Name: '이름',
    Navigation: '이동',
    Oauth: 'OAuth',
    Outside: '외부',
    Pem: 'PEM',
    Picker: '선택창',
    Play: '재생',
    Player: '재생 화면',
    Pointer: '포인터',
    Placeholder: '대기 상태',
    Plus: '추가',
    Providers: 'provider 구성',
    Provider: '로그인 제공자',
    Rate: '요청 빈도',
    Replies: '답글 목록',
    Required: '필수',
    Results: '검색 결과',
    Return: '복귀',
    Route: '라우트',
    Search: '검색',
    Selection: '선택',
    Settings: '설정',
    Shell: '공통 화면 틀',
    Show: '표시',
    Social: '소셜',
    Spinner: '스피너',
    Start: '시작',
    Submit: '제출',
    Timeline: '타임라인',
    Url: 'URL',
    Value: '값',
    Webhook: 'webhook',
    Worker: '작업자',
    Account: '계정',
    Accounts: '계정 목록',
    Authorization: '권한 정보',
    Book: '책',
    Books: '책 목록',
    BookChat: '책 대화방',
    BookChats: '책 대화방 목록',
    DiscussionPost: '대화 메시지',
    Edit: '편집',
    File: '파일',
    Client: '클라이언트',
    Cors: 'CORS',
    DirectUpload: '직접 업로드',
    Duration: '재생 시간',
    Env: '환경변수',
    Error: '오류',
    FilterMembers: '필터 멤버 목록',
    Form: '입력 폼',
    Invite: '초대',
    Label: '라벨',
    Login: '로그인',
    Member: '멤버',
    Members: '멤버 목록',
    Message: '메시지',
    Metadata: '메타데이터',
    NavigationState: '이동 상태',
    Onboarding: '온보딩',
    Post: '메시지',
    Posts: '메시지 목록',
    Profile: '프로필',
    Page: '페이지',
    Query: '검색어',
    ReadingRoom: '독서방',
    ReadingRooms: '독서방 목록',
    ReadingRoomSummaries: '독서방 요약 목록',
    ReadingRoomSummary: '독서방 요약',
    ReadingRoomMember: '독서방 멤버',
    ReadingRoomLastMessage: '독서방 최근 메시지',
    RoomsWithMembers: '멤버 정보를 포함한 독서방 목록',
    RoomMemberSummary: '독서방 멤버 요약',
    RoomMessagePreview: '독서방 메시지 미리보기',
    RoomMessageTime: '독서방 메시지 시각',
    Reply: '답글',
    Request: '요청',
    Response: '응답',
    Room: '독서방',
    Rooms: '독서방 목록',
    Session: '로그인 세션',
    State: '상태',
    Token: '토큰',
    Upload: '업로드',
    UploadedVideoNavigationState: '업로드 완료 영상 이동 상태',
    User: '사용자',
    Video: '영상',
    VideoAsset: '영상 자산',
    VideoFilterMembers: '영상 필터 멤버 목록',
    VideoPlaybackAuthorization: '영상 재생 권한',
    VideoPosts: '영상 메시지 목록',
    MuxThumbnailUrl: 'Mux 썸네일 URL',
  }

  if (vocabulary[target]) {
    return vocabulary[target]
  }

  const words = target.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? [target]
  return words.map((word) => vocabulary[word] ?? word).join(' ')
}

/** 함수 이름의 동사 규칙을 바탕으로 짧은 한글 책임 설명을 만든다. */
function describeFunction(name) {
  const explicitDescriptions = {
    authenticate: '현재 Supabase 세션을 확인해 보호된 화면의 접근 상태를 결정한다.',
    clearStateCookie: 'Naver OAuth state cookie를 즉시 만료시키는 응답 값을 만든다.',
    completeOnboarding: '프로필 입력값과 온보딩 완료 시각을 함께 저장한다.',
    concatenateBytes: '여러 Uint8Array를 순서대로 이어 하나의 바이트 배열로 만든다.',
    constructor: '전달받은 값으로 클래스 인스턴스의 초기 상태를 구성한다.',
    convertPkcs1PemToPkcs8: 'PKCS#1 개인 키를 jose가 읽을 수 있는 PKCS#8 PEM으로 변환한다.',
    createBasicAuthorization: 'Mux API 요청에 사용할 Basic Authorization 값을 만든다.',
    createCorsHeaders: '요청 origin을 검증해 CORS 응답 header를 만든다.',
    createLogRecord: '운영 로그 level과 message를 구조화된 기록으로 만든다.',
    createNaverAuthorizeUrl: 'Naver OAuth 인증 요청에 사용할 authorize URL을 만든다.',
    createNaverBridgeStartUrl: 'Naver OAuth 시작 Edge Function URL을 만든다.',
    createStateCookie: 'OAuth 요청 위조를 막는 서명된 state cookie를 만든다.',
    createSyntheticNaverEmail: '이메일이 없는 Naver 계정용 내부 대체 이메일을 만든다.',
    decodeBase64Pem: 'Base64로 인코딩된 PEM 개인 키를 문자열로 복원한다.',
    decodeBase64Url: 'Base64 URL 문자열을 원본 바이트 배열로 복원한다.',
    decodePem: 'PEM 본문을 DER 바이트 배열로 복원한다.',
    decodeSigningPrivateKey: '환경변수의 Mux signing private key를 PEM 문자열로 복원한다.',
    encodeBase64Url: '바이트 배열을 URL-safe Base64 문자열로 인코딩한다.',
    encodeDerLength: 'ASN.1 DER length를 바이트 배열로 인코딩한다.',
    encodeDerValue: 'ASN.1 DER tag와 값을 하나의 바이트 배열로 인코딩한다.',
    encodeHex: '바이트 배열을 소문자 16진수 문자열로 인코딩한다.',
    encodePem: 'DER 바이트 배열을 PEM 문자열로 인코딩한다.',
    failureFromError: '발생한 오류를 표준 API 실패 응답으로 변환한다.',
    failureResponse: '오류 코드와 요청 ID를 포함한 표준 실패 응답을 만든다.',
    getAuthenticatedContext: '요청 토큰을 검증해 인증 사용자와 Supabase client를 반환한다.',
    getFunctionResponseStatus: 'Edge Function 실패 응답에서 HTTP status를 추출한다.',
    getOnboardingCompletedAt: '현재 사용자의 온보딩 완료 시각을 조회해 반환한다.',
    getPlaybackSigningErrorCode: '영상 재생 서명 오류를 사용자용 오류 코드로 변환한다.',
    getProviderLabels: '로그인 provider 식별자를 화면 표시용 이름으로 변환한다.',
    getSingleResult: 'Supabase 응답에서 단일 결과를 검증해 반환한다.',
    isObject: '외부 값이 null이 아닌 일반 객체인지 판별한다.',
    joinRoomByCode: '초대 코드를 검증해 현재 사용자를 독서방 멤버로 참여시킨다.',
    loadAccount: '현재 로그인 사용자와 연결된 provider 정보를 불러온다.',
    loadProfile: '현재 사용자의 프로필을 불러와 온보딩 입력값을 채운다.',
    members: '독서방 식별자로 영상 필터 멤버 query key를 생성한다.',
    methodNotAllowed: '허용하지 않는 HTTP method 요청에 405 응답을 반환한다.',
    normalizeSigningPem: 'Mux signing private key의 개행과 PEM header를 정규화한다.',
    optionalText: '외부 텍스트 값을 정리하고 비어 있으면 null로 변환한다.',
    optionsResponse: '허용된 origin을 반영한 CORS preflight 응답을 만든다.',
    postInput: '메시지 본문과 라벨을 전송 가능한 입력 형식으로 검증한다.',
    redirectWithError: '인증 오류 코드를 callback URL에 담아 redirect 응답을 만든다.',
    readCookieValue: 'Cookie header에서 지정한 이름의 값을 찾아 반환한다.',
    resolveAuthDestination: '인증 상태와 온보딩 여부에 맞는 다음 경로를 결정한다.',
    resolvePostId: 'Mux metadata에서 연결된 메시지 ID를 안전하게 결정한다.',
    refreshVideoPosts: '영상 업로드 뒤 관련 영상 목록 query를 다시 불러온다.',
    playback: '메시지 식별자로 영상 재생 query key를 생성한다.',
    retryAt: '삭제 작업의 재시도 횟수에 맞는 다음 실행 시각을 계산한다.',
    room: '독서방 식별자로 독서방 상세 query key를 생성한다.',
    sanitizeMetadata: '운영 로그 metadata에서 허용된 필드만 남긴다.',
    secureEqual: '두 문자열을 일정한 실행 시간으로 비교해 timing attack을 방지한다.',
    successResponse: '데이터와 요청 ID를 포함한 표준 성공 응답을 만든다.',
    searchBooksForQuery: '입력된 검색어로 책 목록을 조회해 반환한다.',
    selectReturnTo: '허용 목록 안에서 OAuth 완료 후 복귀할 URL을 선택한다.',
    timingSafeEqual: '두 문자열을 일정한 실행 시간으로 비교해 timing attack을 방지한다.',
    withEnv: '테스트 동안 환경변수를 임시로 바꾸고 종료 후 원래 값으로 복원한다.',
  }

  if (explicitDescriptions[name]) {
    return explicitDescriptions[name]
  }

  const descriptions = [
    ['parse', (target) => `외부 입력을 검증해 ${target} 형식으로 변환한다.`],
    ['map', (target) => `원본 데이터를 ${target} 도메인 모델로 변환한다.`],
    ['format', (target) => `${target} 값을 화면 표시용 문자열로 변환한다.`],
    ['create', (target) => `${target} 데이터를 생성해 반환한다.`],
    ['get', (target) => `${target} 데이터를 조회하거나 계산해 반환한다.`],
    ['read', (target) => `${target} 값을 읽고 검증해 반환한다.`],
    ['fetch', (target) => `외부 서비스에 ${target} 데이터를 요청해 반환한다.`],
    ['update', (target) => `${target} 데이터를 새 값으로 갱신한다.`],
    ['delete', (target) => `${target} 관련 데이터를 안전하게 삭제한다.`],
    ['remove', (target) => `${target} 값을 현재 상태에서 제거한다.`],
    ['validate', (target) => `${target} 값의 유효성을 검증한다.`],
    ['filter', (target) => `조건에 맞는 ${target}만 골라 반환한다.`],
    ['normalize', (target) => `${target}을 내부 표준 형식으로 정규화한다.`],
    ['encode', (target) => `${target}을 전송 가능한 형식으로 인코딩한다.`],
    ['decode', (target) => `인코딩된 ${target}을 원래 값으로 복원한다.`],
    ['resolve', (target) => `현재 조건에 맞는 ${target}을 결정해 반환한다.`],
    ['select', (target) => `조건에 맞는 ${target}을 선택해 반환한다.`],
    ['sign', (target) => `${target}에 필요한 암호학적 서명을 생성한다.`],
    ['verify', (target) => `${target}의 유효성과 무결성을 검증한다.`],
    ['consume', (target) => `${target} 제한을 확인하고 사용량을 반영한다.`],
    ['restore', (target) => `${target}을 이전 상태로 복원한다.`],
    ['upload', (target) => `${target} 데이터를 외부 저장소에 업로드한다.`],
    ['search', (target) => `검색어로 ${target}을 조회해 반환한다.`],
    ['should', (target) => `${target} 조건을 충족하는지 판별한다.`],
    ['is', (target) => `${target} 상태인지 판별한다.`],
    ['use', (target) => `${target} 상태와 사용자 동작을 재사용 가능한 hook으로 제공한다.`],
    ['handle', (target) => `${target} 요청이나 사용자 동작을 처리한다.`],
    ['log', (target) => `${target} 운영 정보를 민감값 없이 기록한다.`],
    ['by', (target) => `${target} 식별자로 안정적인 query key를 생성한다.`],
  ]

  const matched = descriptions.find(([prefix]) => name.startsWith(prefix))
  if (matched) {
    const [prefix, createDescription] = matched
    return createDescription(getFunctionTarget(name, prefix))
  }

  if (/^[A-Z]/.test(name)) {
    return `${translateFunctionTarget(name)} 화면 또는 UI 요소를 접근 가능한 형태로 렌더링한다.`
  }

  return `${translateFunctionTarget(name)}에 해당하는 단일 책임을 수행하고 결과를 반환한다.`
}

/** 문서화 대상 함수와 소스 위치를 AST 전체에서 수집한다. */
function collectNamedFunctions(source, fileName) {
  const sourceFile = createSourceFile(source, fileName)
  const functions = []

  /** 현재 노드와 모든 하위 노드에서 이름 있는 함수를 수집한다. */
  function visit(node) {
    const namedFunction = getNamedFunction(node)
    if (namedFunction) {
      functions.push({ ...namedFunction, sourceFile })
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return functions
}

/** 소스 코드에서 한글 JSDoc이 없는 이름 있는 함수 목록을 반환한다. */
export function findUndocumentedNamedFunctions(source, fileName) {
  return collectNamedFunctions(source, fileName)
    .filter(({ commentNode }) => !hasLeadingJsDoc(source, commentNode))
    .map(({ commentNode, name, sourceFile }) => ({
      line: sourceFile.getLineAndCharacterOfPosition(commentNode.getStart()).line + 1,
      name,
    }))
}

/** 소스 코드의 이름 있는 함수에 누락된 한글 책임 JSDoc을 추가한다. */
export function addMissingFunctionDocs(source, fileName) {
  const insertions = collectNamedFunctions(source, fileName)
    .filter(({ commentNode }) => !hasLeadingJsDoc(source, commentNode))
    .map(({ commentNode, name }) => {
      const position = commentNode.getStart()
      const lineStart = source.lastIndexOf('\n', position - 1) + 1
      const indentation = source.slice(lineStart, position)
      return {
        content: `/** ${describeFunction(name)} */\n${indentation}`,
        position,
      }
    })
    .sort((left, right) => right.position - left.position)

  return insertions.reduce(
    (result, insertion) =>
      `${result.slice(0, insertion.position)}${insertion.content}${result.slice(insertion.position)}`,
    source,
  )
}
