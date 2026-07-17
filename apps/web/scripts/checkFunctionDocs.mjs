import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { addMissingFunctionDocs, findUndocumentedNamedFunctions } from './functionDocumentation.mjs'

const SOURCE_ROOTS = ['src', 'scripts', '../../supabase/functions']

/** 디렉터리를 순회해 문서화 검사 대상 TypeScript 소스 파일을 수집한다. */
function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return collectSourceFiles(filePath)
    }

    const isTypeScript = /\.(ts|tsx)$/.test(entry.name)
    const isTest = entry.name.includes('.test.') || entry.name.includes('.spec.')
    return isTypeScript && !isTest ? [filePath] : []
  })
}

/** 파일의 누락된 함수 문서를 추가하고 실제 변경 여부를 반환한다. */
function writeFunctionDocs(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  const documentedSource = addMissingFunctionDocs(source, filePath)
  if (source === documentedSource) {
    return false
  }

  fs.writeFileSync(filePath, documentedSource)
  return true
}

/** 전체 소스의 함수 문서 누락을 검사하거나 write 옵션으로 자동 보완한다. */
function main() {
  const isWriteMode = process.argv.includes('--write')
  const files = SOURCE_ROOTS.flatMap((root) => collectSourceFiles(path.resolve(root)))

  if (isWriteMode) {
    const changedCount = files.filter(writeFunctionDocs).length
    process.stdout.write(`함수 문서를 추가한 파일: ${changedCount}개\n`)
  }

  const missing = files.flatMap((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8')
    return findUndocumentedNamedFunctions(source, filePath).map(
      ({ line, name }) => `${path.relative(process.cwd(), filePath)}:${line} ${name}`,
    )
  })

  if (missing.length === 0) {
    process.stdout.write('모든 이름 있는 함수에 책임 JSDoc이 있습니다.\n')
    return
  }

  process.stderr.write(`함수 책임 JSDoc 누락: ${missing.length}개\n`)
  process.stderr.write(`${missing.join('\n')}\n`)
  process.exitCode = 1
}

main()
