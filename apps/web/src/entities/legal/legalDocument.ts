export const legalDocumentVersion = '2026-07-18.2' as const

export type LegalDocumentId = 'terms' | 'privacy'

export type LegalDocumentSection = {
  body: string[]
  heading: string
}

export type LegalDocument = {
  id: LegalDocumentId
  shortTitle: string
  sections: LegalDocumentSection[]
  title: string
  version: typeof legalDocumentVersion
}

const requiredLegalDocuments: readonly LegalDocument[] = [
  {
    id: 'terms',
    shortTitle: '이용약관',
    title: 'Talk후감 이용약관',
    version: legalDocumentVersion,
    sections: [
      {
        heading: '1. 서비스의 목적',
        body: [
          'Talk후감은 가까운 사람들과 비공개 책방에서 책을 읽고, 대화와 짧은 영상 기록을 나누는 서비스입니다.',
          '서비스를 이용하려면 본 약관과 개인정보처리방침에 동의해야 합니다.',
        ],
      },
      {
        heading: '2. 계정과 책방',
        body: [
          '카카오, Google, 네이버 계정으로 로그인할 수 있으며, 이용자는 자신의 계정 접근 정보를 안전하게 관리해야 합니다.',
          '책방은 초대 코드로 참여하는 비공개 공간입니다. 방장과 참여자는 초대 코드를 제3자에게 공유하지 않도록 주의해야 합니다.',
        ],
      },
      {
        heading: '3. 대화와 영상 기록',
        body: [
          '이용자는 자신이 올리는 글, 댓글, 영상에 필요한 권리를 보유하거나 적법한 이용 권한을 갖고 있어야 합니다.',
          '타인의 개인정보, 초상권, 저작권을 침해하거나 불쾌감·위험을 유발하는 콘텐츠는 올릴 수 없습니다.',
          '영상 기록은 해당 책방의 참여자가 보는 용도로만 이용해야 하며, 서비스 밖으로 재배포해서는 안 됩니다.',
        ],
      },
      {
        heading: '4. 서비스 제한과 계정 삭제',
        body: [
          '운영자는 서비스 안전과 다른 이용자의 권리 보호를 위해 약관을 위반한 계정이나 콘텐츠의 이용을 제한할 수 있습니다.',
          '이용자는 설정에서 계정 삭제를 요청할 수 있습니다. 삭제 처리 시 계정과 연결된 서비스 데이터 및 영상 기록은 서비스의 삭제 절차에 따라 정리됩니다.',
        ],
      },
      {
        heading: '5. 약관 변경과 문의',
        body: [
          '약관을 변경하는 경우 서비스 안에서 시행일과 변경 내용을 알립니다. 중요한 변경은 필요한 방식으로 다시 동의를 요청합니다.',
          '운영자 정보와 문의 채널은 개인정보처리방침 및 서비스 정보 화면에 최신 상태로 안내합니다.',
        ],
      },
    ],
  },
  {
    id: 'privacy',
    shortTitle: '개인정보처리방침',
    title: 'Talk후감 개인정보처리방침',
    version: legalDocumentVersion,
    sections: [
      {
        heading: '1. 수집하는 정보와 이용 목적',
        body: [
          '소셜 로그인 과정에서 계정 식별 정보, 이메일, 표시 이름을 받아 계정 생성과 로그인 상태 유지에 사용합니다.',
          '프로필, 책방 참여 정보, 책 대화·댓글·멘션, 완독 기록, 영상 기록은 책방 기능 제공과 이용자 간 소통을 위해 처리합니다.',
          '전역 의견 보내기로 접수한 유형과 본문, 작성자 프로필, 로그인 이메일은 서비스 개선과 필요한 경우 이메일 회신을 위해 처리합니다.',
          '서비스 개선을 위해 Google Analytics 4와 Microsoft Clarity를 사용하며, 기기·브라우저 정보와 접속·이용 흐름 등 최소한의 이용 정보를 처리합니다. 분석 이벤트에는 이메일, 사용자 ID, 표시 이름, 책방·책 제목, 대화 본문, 영상 URL·파일명, 초대 코드를 넣지 않습니다. Clarity에는 서비스 화면의 텍스트와 이용자 콘텐츠를 명시적으로 마스킹한 상태로 화면 구조와 상호작용 정보만 전송합니다.',
          '오류 대응과 부정 이용 방지를 위해 서비스 이용 과정에서 필요한 최소 운영 기록을 처리할 수 있습니다.',
        ],
      },
      {
        heading: '2. 보관과 삭제',
        body: [
          '계정과 책방 기록은 서비스를 이용하는 동안 보관합니다.',
          '계정 삭제를 요청하면 계정과 연결된 프로필, 책방 참여 정보, 게시물 및 영상 기록을 서비스의 삭제 절차에 따라 정리합니다. 법령상 보관 의무가 있는 정보는 해당 기간 동안 별도로 보관할 수 있습니다.',
        ],
      },
      {
        heading: '3. 기능 제공을 위한 외부 서비스',
        body: [
          'Supabase는 계정 인증과 데이터베이스 접근 제어, 서비스 데이터 저장을 지원합니다.',
          'Mux는 이용자가 올린 영상의 업로드, 변환, 재생을 지원합니다.',
          '카카오, Google, 네이버는 소셜 로그인에서 본인 계정 확인을 지원합니다. 각 제공자가 전달하는 정보는 로그인과 계정 연결에 필요한 범위로 사용합니다.',
          'Kakao Book Search는 책 검색어를 바탕으로 도서 정보를 찾는 기능에 사용합니다.',
          'Google Analytics 4는 서비스 개선을 위한 방문·이용 흐름 분석을 지원합니다. 광고 개인화, Google Signals, 광고 목적 분석 기능은 사용하지 않습니다.',
          'Microsoft Clarity는 서비스 화면의 사용성 개선을 위한 세션 재현과 히트맵 분석을 지원합니다. 이용자 입력, 대화와 프로필 등 화면 텍스트·콘텐츠는 서비스에서 마스킹하여 전송하지 않습니다.',
        ],
      },
      {
        heading: '4. 이용자의 권리',
        body: [
          '이용자는 자신의 개인정보에 대해 열람, 정정, 삭제를 요청할 수 있습니다. 프로필은 서비스 안에서 직접 수정할 수 있고, 계정 삭제는 설정에서 요청할 수 있습니다.',
          'Google Analytics 4와 Microsoft Clarity의 분석 쿠키와 기기 정보 처리는 브라우저 설정에서 제한하거나 삭제할 수 있습니다. 이 경우 일부 분석 정보가 수집되지 않을 수 있습니다.',
          '처리방침과 관련한 문의 방법, 운영자 정보, 국외 처리 여부 등 출시 정보는 서비스 공개 전에 최신 사실관계로 확정하여 이 화면에 안내합니다.',
        ],
      },
      {
        heading: '5. 변경 안내',
        body: [
          '처리방침을 변경하는 경우 시행일과 변경 내용을 서비스 안에서 알립니다. 수집 정보나 이용 목적에 중요한 변화가 있으면 필요한 절차에 따라 다시 동의를 받습니다.',
        ],
      },
    ],
  },
]

/** 출시 시 필수 동의를 받는 정책 문서 목록을 반환한다. */
export function getRequiredLegalDocuments(): readonly LegalDocument[] {
  return requiredLegalDocuments
}

/** 공개 경로의 문서 식별자로 정책 문서를 찾아 반환한다. */
export function getLegalDocument(documentId: string | undefined): LegalDocument | null {
  return requiredLegalDocuments.find((document) => document.id === documentId) ?? null
}
