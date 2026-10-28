/* global console, document -- Node에서 실행하고, readRenderedLines만 브라우저 안에서 돈다. */
/**
 * OCR 시험용 합성 책 페이지를 만든다.
 * packages/domain/src/__fixtures__/ocr-corpus/<id>/page.json(직접 쓴 글, 저작권 없음)을 책처럼 조판해
 * page.jpg(1500×2000)로 찍고, 화면에 실제로 놓인 줄과 정답 문장을 expected.json으로 남긴다.
 * 실행: pnpm ocr:corpus:render (macOS AppleMyungjo 글꼴을 쓴다. CI에서는 돌리지 않고 결과 파일을 커밋한다.)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const corpusDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/domain/src/__fixtures__/ocr-corpus',
)
const viewport = { height: 2000, width: 1500 }

/** 문단 글을 마침표·물음표·느낌표 뒤(닫는 따옴표 포함)에서 나눠 정답 문장 목록을 만든다. */
function splitParagraphSentences(paragraph) {
  return paragraph.match(/.+?[.?!…]+["'”’」』)\]]*(?=\s|$)|.+$/gu)?.map((part) => part.trim()) ?? []
}

/** HTML 특수 문자를 이스케이프한다. */
function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (character) => `&#${character.charCodeAt(0)};`)
}

/** 앞 페이지 조각(왼쪽 끝에 잘려 들어온 다른 페이지 글)을 그린다. */
function renderNeighborStrip(page) {
  if (!page.render.neighborStrip) return ''
  const lines = (page.neighborLines ?? []).map((line) => `<div>${escapeHtml(line)}</div>`).join('')
  return `<div class="neighbor"><div class="neighbor-text">${lines}</div></div>`
}

/** page.json 하나를 책 페이지 HTML로 만든다. */
function renderPageHtml(page) {
  const { render } = page
  const paper = render.paper ?? '#f7f3ea'
  const ink = render.ink ?? '#1d1b19'
  const paragraphs = page.paragraphs
    .map((paragraph, index) => `<p data-paragraph="${index}">${escapeHtml(paragraph)}</p>`)
    .join('')
  const shadow = render.gutterShadow
    ? 'linear-gradient(90deg, rgba(0,0,0,0.28) 0, rgba(0,0,0,0.08) 90px, rgba(0,0,0,0) 220px),'
    : ''
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; width: ${viewport.width}px; height: ${viewport.height}px; overflow: hidden; background: #5d5248; }
    .stage { position: absolute; inset: 0; perspective: 2400px; }
    .sheet {
      position: absolute; left: 90px; top: 70px; width: 1330px; height: 1860px;
      background: ${shadow} ${paper}; color: ${ink};
      transform-origin: 50% 100%;
      transform: rotateX(${render.tiltXDeg}deg) rotate(${render.rotateDeg}deg);
      box-shadow: 0 10px 40px rgba(0,0,0,0.35);
      font-family: 'AppleMyungjo', serif;
    }
    .header { position: absolute; top: 70px; left: 0; right: 0; text-align: center; font-size: 26px; letter-spacing: 2px; }
    .chapter { position: absolute; top: 150px; left: 0; right: 0; text-align: center; font-size: 56px; }
    .body { position: absolute; top: ${page.chapterTitle ? 330 : 190}px; left: 135px; width: 1060px; font-size: 40px; line-height: 1.7; }
    .body p { margin: 0; text-indent: 1em; text-align: justify; word-break: break-all; }
    .page-number { position: absolute; bottom: 70px; left: 0; right: 0; text-align: center; font-size: 28px; }
    .neighbor { position: absolute; left: 0; top: 40px; width: 74px; height: 1900px; overflow: hidden; background: #ece6d8; border-right: 6px solid #2b2420; }
    .neighbor-text { margin-left: -60px; margin-top: 160px; width: 600px; font-family: 'AppleMyungjo', serif; font-size: 40px; line-height: 1.7; color: #1d1b19; }
  </style></head><body><div class="stage">
    ${renderNeighborStrip(page)}
    <div class="sheet">
      ${page.header ? `<div class="header">${escapeHtml(page.header)}</div>` : ''}
      ${page.chapterTitle ? `<div class="chapter">${escapeHtml(page.chapterTitle)}</div>` : ''}
      <div class="body">${paragraphs}</div>
      <div class="page-number">${escapeHtml(page.pageNumber)}</div>
    </div>
  </div></body></html>`
}

/** 브라우저 안에서 글자마다 위치를 재어 화면에 실제로 놓인 본문 줄을 위→아래로 반환한다. 넘친 줄이 있으면 오류를 던진다. */
function readRenderedLines() {
  const body = document.querySelector('.body')
  if (body.scrollWidth > body.clientWidth) throw new Error('body overflow')
  const lines = []
  for (const paragraph of document.querySelectorAll('.body p')) {
    const textNode = paragraph.firstChild
    const range = document.createRange()
    let current = null
    for (let index = 0; index < textNode.length; index += 1) {
      range.setStart(textNode, index)
      range.setEnd(textNode, index + 1)
      const rect = range.getClientRects()[0]
      if (!rect) continue
      const top = Math.round(rect.top)
      if (!current || Math.abs(current.top - top) > 30) {
        current = { text: '', top }
        lines.push(current)
      }
      current.text += textNode.data[index]
    }
  }
  return lines.map((line) => line.text.trim()).filter(Boolean)
}

/** 코퍼스 폴더의 page.json마다 page.jpg와 expected.json을 만든다. */
async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ deviceScaleFactor: 1, viewport })
  const browserPage = await context.newPage()
  for (const id of readdirSync(corpusDir).sort()) {
    const page = JSON.parse(readFileSync(join(corpusDir, id, 'page.json'), 'utf8'))
    await browserPage.setContent(renderPageHtml(page))
    await browserPage.evaluate(() => document.fonts.ready)
    const lines = await browserPage.evaluate(readRenderedLines)
    await browserPage.screenshot({
      path: join(corpusDir, id, 'page.jpg'),
      quality: 90,
      type: 'jpeg',
    })
    const expected = {
      excludedTexts: [page.header, page.chapterTitle, page.pageNumber].filter(Boolean),
      imageSize: viewport,
      lines,
      sentences: page.paragraphs.flatMap(splitParagraphSentences),
    }
    writeFileSync(join(corpusDir, id, 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`)
    console.log(`${id}: 줄 ${lines.length}개, 문장 ${expected.sentences.length}개`)
  }
  await browser.close()
}

await main()
