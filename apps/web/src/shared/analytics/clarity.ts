type QueuedClarity = ((...arguments_: unknown[]) => void) & {
  q?: unknown[][]
}

declare global {
  interface Window {
    clarity?: QueuedClarity
  }
}

const clarityScriptId = 'talkhugam-clarity'

/** 공개 Clarity 프로젝트 ID로 분석 스크립트를 한 번 준비하고, 로드 전 명령을 큐에 보관한다. */
export function loadClarity(projectId: string | undefined): void {
  if (!projectId) return

  getOrCreateClarity()
  if (document.getElementById(clarityScriptId)) return

  document.head.append(createClarityScript(projectId))
}

/** 외부 스크립트가 준비되기 전에도 호출을 잃지 않도록 Clarity 명령 큐를 반환한다. */
function getOrCreateClarity(): QueuedClarity {
  if (window.clarity) return window.clarity

  /** 외부 Clarity 스크립트가 준비될 때까지 전달받은 명령 인자를 순서대로 저장한다. */
  const clarity: QueuedClarity = (...arguments_) => {
    clarity.q ??= []
    clarity.q.push(arguments_)
  }
  window.clarity = clarity
  return clarity
}

/** URL에 안전하게 인코딩한 프로젝트 ID를 사용하는 비동기 Clarity 스크립트 요소를 생성한다. */
function createClarityScript(projectId: string): HTMLScriptElement {
  const script = document.createElement('script')
  script.async = true
  script.id = clarityScriptId
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`
  return script
}
