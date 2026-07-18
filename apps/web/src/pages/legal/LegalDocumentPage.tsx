import { Link, useParams } from 'react-router-dom'

import { getLegalDocument } from '../../entities/legal'
import { AppHeader } from '../../shared/ui/AppHeader'

/** 공개 이용약관 또는 개인정보처리방침을 렌더링한다. */
export function LegalDocumentPage() {
  const { documentId } = useParams()
  const document = getLegalDocument(documentId)

  if (!document) return <UnknownLegalDocumentState />

  return (
    <main className="app-page bg-surface px-4 pb-12">
      <AppHeader onBack={() => window.history.back()} title={document.shortTitle} />
      <article className="py-8">
        <p className="text-primary text-sm font-medium">시행일 · {document.version}</p>
        <h1 className="text-ink mt-2 text-2xl font-bold">{document.title}</h1>
        <p className="text-ink-subtle mt-3 text-sm leading-6">
          Talk후감은 함께 읽는 사람들의 기록을 존중합니다. 아래 내용을 확인해 주세요.
        </p>
        <div className="mt-8 space-y-8">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-ink text-base font-bold">{section.heading}</h2>
              <div className="text-ink-subtle mt-3 space-y-3 text-sm leading-6">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  )
}

/** 존재하지 않는 정책 문서 주소에 대한 복구 화면을 렌더링한다. */
function UnknownLegalDocumentState() {
  return (
    <main className="app-page bg-surface flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-ink text-xl font-bold">요청한 정책 문서를 찾지 못했어요.</h1>
      <p className="text-ink-subtle mt-3 text-sm">로그인 화면에서 현재 정책 문서를 다시 확인해 주세요.</p>
      <Link
        className="bg-primary mt-6 flex min-h-11 items-center rounded-md px-4 text-sm font-semibold text-white"
        to="/"
      >
        로그인으로 돌아가기
      </Link>
    </main>
  )
}
