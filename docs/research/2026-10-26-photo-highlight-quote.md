# 사진에서 문장 가져오기 (책 페이지 OCR → 독후감 인용) 조사

- 작성일: 2026-10-26 (모든 외부 자료 접근일 2026-10-26)
- 범위: 조사만 함. 코드 변경 없음.
- 대상 코드: `talkhugam-talk-109` 워크트리 (`feat/talk-109-room-manager-role`)

## 1. 한 줄 결론과 추천안

**한 줄 결론:** 책 페이지 사진은 저장하지 않는다. 사진은 Supabase Edge Function을 거쳐 Google Cloud Vision `DOCUMENT_TEXT_DETECTION`으로 한 번 읽고 바로 버린다. 돌려받은 줄 좌표를 사진 위에 겹쳐 보여 주고, 사용자가 줄을 탭하거나 끌어서 고른 문장만 독후감 입력창에 넣는다. 이 서버 경로 하나를 웹과 모바일이 같이 쓰는 것으로 MVP를 시작하고, 다음 단계에서 모바일만 ML Kit 온디바이스 인식으로 바꾼다.

**추천안 (A. 서버 OCR 공용 MVP → 모바일 온디바이스 전환)**
1. MVP: Edge Function `ocr-page`를 새로 만든다. 클라이언트는 사진을 긴 변 약 2000px JPEG로 줄여 base64로 보낸다. 함수는 Google Vision을 동기 호출하고, 줄 단위 `{ text, box }[]`만 돌려준다. 이미지는 Storage나 DB에 남기지 않는다.
2. 웹(Vercel)과 모바일(Expo)은 같은 응답 형식과 같은 선택 UI 규칙(`@talkhugam/domain`의 줄 병합·정리 함수)을 쓴다.
3. 개선 단계: 모바일은 `@react-native-ml-kit/text-recognition`(Korean 스크립트, 줄 frame 반환)이나 직접 만든 작은 Expo 모듈로 기기 안에서 인식한다. 이렇게 하면 비용·지연·국외 전송이 사라진다. 서버 경로는 웹과 기기 미지원 상황의 예비 경로로 남긴다.
4. 결과는 일반 글(`posts.body`, 최대 500자)로만 저장한다. 인용 표시와 쪽 라벨(기존 「페이지 라벨」)은 그 위에 얹는다.

**차선안 (B. 공급자만 Naver CLOVA OCR General로 바꾸기)**
- 한국어 특화 엔진이다. 응답에 `boundingPoly`, `lineBreak`(줄 끝 여부)가 있어 줄을 묶기 쉽다. 공식 문서에는 "전송한 이미지·결과를 저장하거나 활용하지 않는다"고 적혀 있고, 한국 리전이라 국외 이전 이슈도 줄어든다.
- 다만 정확한 단가와 무료 제공량을 공식 자료로 확인하지 못했다. 권장 성능이 계정당 1 TPS라는 제약도 있다. 그래서 1순위로 두지 않았다. 아키텍처는 A와 같으므로 Edge Function 안에서 공급자만 바꾸면 된다.

## 2. 비교표

정확도는 공개 벤치마크가 없어 문서상 지원 여부와 엔진 성격으로 정성 평가했다. 실제 책 사진 20~30장으로 직접 비교해 봐야 한다(열린 질문 참고).

| 옵션 | 한국어 정확도(추정) | 줄 단위 좌표 | 웹/모바일 | 비용 | 지연 | 개인정보 | 구현 난이도 |
|---|---|---|---|---|---|---|---|
| Google Cloud Vision `DOCUMENT_TEXT_DETECTION` | 높음. 밀집 문서용 모드이고 한국어 지원 | 단어·기호 좌표만 있고 줄은 없음. `detectedBreak`(EOL/LINE_BREAK)로 줄을 직접 묶어야 함 | 둘 다 (서버) | 월 1,000건 무료, 이후 $1.50/1,000건 | 네트워크 왕복. 체감 1~3초 예상(미측정) | 동기 호출은 메모리에서만 처리하고 디스크에 남기지 않음. 학습에 쓰지 않음. 국외 처리 | 중 |
| Naver CLOVA OCR General (V2) | 높음(한국어 특화, 추정) | 필드별 `boundingPoly`와 `lineBreak` 제공 | 둘 다 (서버) | 종량제. 단가·무료량은 **공식 확인 실패** | 네트워크 왕복. 권장 1 TPS | 이미지·결과를 저장·활용하지 않음. 과금 로그만 남김. 한국 리전 | 중 (NCP 가입, 도메인 생성 필요) |
| Upstage Document OCR | 높음(한국 업체, 추정) | 문서상 확인 못 함 | 둘 다 (서버) | $0.0015/페이지(VAT 별도). 무료 크레딧은 확인 못 함 | 왕복 | 보존 정책 확인 못 함 | 중 |
| Azure Document Intelligence Read | 중상. 인쇄체 `ko` 지원 | 줄(`lines`)과 단어 polygon 제공 | 둘 다 (서버) | 약 $1.50/1,000페이지(제3자 자료만 있음, 공식 수치는 확인 못 함) | 비동기 폴링이라 왕복이 김 | Azure 약관을 따름 | 중상 |
| Claude 비전(Haiku 4.5 등) | 글자 인식은 좋지만 환각 위험이 있음 | 좌표가 "근사치"라 하이라이트용으로는 부적합 | 둘 다 (서버) | 1000×1000 이미지 기준 약 $1.30/1,000장(Haiku 4.5 입력만 계산) | 수 초 | 업로드 이미지를 학습에 쓰지 않음 | 하. 다만 좌표 UX가 불가능 |
| ML Kit v2 Korean (`@react-native-ml-kit/text-recognition`) | 중상(인쇄체에 적합, 추정) | Block/Line/Element에 frame 제공 | 모바일만 (iOS·Android) | 무료 | 기기 안에서 처리. 짧음(미측정) | 기기 밖으로 나가지 않음 | 중. 네이티브 모듈이라 dev build 필요, 새 아키텍처 호환은 확인 필요 |
| Apple Vision `VNRecognizeTextRequest` / VisionKit Live Text | 상(최신 리비전은 `ko-KR` 지원) | 관찰마다 boundingBox 제공. Live Text는 자체 선택 UI | iOS만 | 무료 | 기기 안 | 기기 안 | 상. RN/Expo 래퍼가 없어 직접 Swift 모듈을 만들어야 함 |
| `expo-text-extractor` 2.0.0 | ML Kit/Vision 기반 | **없음** (`string[]`만 반환) | 모바일만 | 무료 | 기기 안 | 기기 안 | 하. 하지만 하이라이트가 불가능해 탈락 |
| `@infinitered/react-native-mlkit-text-recognition` 5.0.1 | Latin 모델만 연결됨 | 있음 | 모바일만 | 무료 | 기기 안 | 기기 안 | 탈락(한국어 모델 미포함) |
| Tesseract.js 7 + `kor` | 중하. 사진 품질(곡면·반사)에 약함 | 줄·단어 bbox 있음 | 웹(브라우저) | 무료 | 휴대폰 브라우저에서는 느림(미측정). 모델 다운로드 약 1.6MB(`best_int` gz)~7MB | 기기 안 | 중 |
| 브라우저 `TextDetector` (Shape Detection) | — | 있음 | 사실상 없음(Chrome에서 텍스트 감지는 아직 개발 중, 플래그 필요) | 무료 | — | — | 탈락 |

참고: 비용은 비공개 소규모 책방 기준이다. 월 수십~수백 장이면 Google Vision 무료 구간(월 1,000건) 안에 들어갈 가능성이 높다.

## 3. 추천 아키텍처

### 데이터 흐름 (MVP)

```
[촬영/선택] ─ 웹: <input type="file" accept="image/*" capture="environment">
             모바일: expo-image-picker launchCameraAsync / launchImageLibraryAsync({ mediaTypes: ['images'] })
   │ 클라이언트에서 긴 변 ~2000px, JPEG q≈0.8로 축소하고 EXIF 회전 보정 (목표 0.5~1MB)
   ▼
[Edge Function ocr-page]  (Supabase JWT 검증, 책방 구성원인지 확인, 사용자별 일일 호출 제한)
   │ base64 → Google Vision images:annotate (DOCUMENT_TEXT_DETECTION, languageHints ["ko"])
   │ 응답을 줄 단위로 정리: words + detectedBreak → lines[{ text, box(정규화 0~1) }]
   │ 이미지·결과는 로그/Storage/DB에 쓰지 않음 (요청 메모리에서만 처리)
   ▼
[선택 화면]  사진(로컬 객체 URL/파일 URI) 위에 줄 박스를 겹쳐 그림 → 사용자가 선택
   ▼
[정리]  @talkhugam/domain: joinOcrLines(selected) → 문단 텍스트 (줄바꿈 병합, 하이픈 처리, 공백 정리)
   ▼
[편집 미리보기]  사용자가 직접 고침 → 「글에 넣기」 → 기존 composer draft에 삽입 (+ 쪽 라벨 제안)
   ▼
[기존 글 저장 RPC]  posts.body (최대 500자). 사진은 어디에도 남지 않음
```

- **저장하는 것:** 사용자가 최종 확인한 텍스트(글 본문)와 선택적 쪽 라벨뿐이다. 페이지 이미지, OCR 원문 전체, 좌표는 저장하지 않는다. 화면을 닫으면 클라이언트 메모리에서도 버린다.
- **키 관리:** Google 서비스 계정 키(또는 API 키)는 Edge Function 시크릿에만 둔다. 웹 번들과 앱 번들에는 넣지 않는다.
- **Edge Function 제약:** CPU 시간 2초/요청(비동기 I/O 제외), 메모리 256MB, 요청 유휴 타임아웃 150초. 이미지를 디코딩하지 않고 그대로 전달만 하면 CPU 한도에 여유가 있다. 요청 본문 크기 한도는 공식 문서에서 확인하지 못했으므로 클라이언트에서 1MB 안팎으로 줄여 보낸다.
- **비용 보호:** 사용자별 일일 호출 상한을 둔다(예: 20회, 숫자는 열린 질문). DB에는 호출 수만 기록하고 내용은 기록하지 않는다.

### 개선 단계의 모바일 온디바이스 경로

- `@react-native-ml-kit/text-recognition` 2.0.0(2025-09-01 배포)은 `recognize(uri, TextRecognitionScript.KOREAN)`로 `blocks[].lines[].frame`을 돌려준다. 다만 Android는 Latin·중국어·데바나가리·일본어·한국어 bundled 모델 5개를, iOS는 `GoogleMLKit/TextRecognition*` 8.0.0 pod 5개를 모두 끌어온다. 모델 하나가 아키텍처당 약 4MB(bundled)라 **앱 크기가 크게 늘 수 있다**. 또 레거시 브리지 모듈이라 RN 0.86 / Expo SDK 57(`expo ~57.0.1`)의 새 아키텍처 interop에서 동작하는지 실제 빌드로 확인해야 한다. config plugin은 없지만 autolinking으로 붙으므로 EAS dev build만 다시 하면 된다.
- 위 확인이 실패하거나 크기가 부담되면 **직접 Expo Module**을 만든다(권장 대안).
  - iOS: Vision `VNRecognizeTextRequest`(`recognitionLanguages = ["ko-KR","en-US"]`, accurate)로 관찰별 boundingBox를 반환한다. 추가 모델 없이 OS에 내장돼 있다. `ko-KR`이 지원되는지는 `supportedRecognitionLanguages`로 런타임에 확인한다.
  - Android: ML Kit **unbundled** Korean(`play-services-mlkit-text-recognition-korean`, 약 260KB, Play 서비스가 모델을 내려받음)을 쓴다.
  - 같은 `{ text, box }[]` 형식을 반환하므로 선택 UI는 그대로 재사용한다.
- 온디바이스 실패(모델 미다운로드, 미지원 기기) 시에는 서버 경로로 자동 전환한다.
- iOS Live Text(`ImageAnalysisInteraction`)는 OS가 제공하는 선택 UX가 가장 좋다. 하지만 iOS 전용이고 RN 래퍼가 없으며, 선택 결과를 앱이 받는 흐름(복사 → 붙여넣기)이 어색하다. 그래서 별도 후보로만 남긴다.

## 4. UX 흐름

### 기존 앱 참고
- **iOS Live Text / Google Lens:** 이미지 위에서 텍스트를 길게 눌러 드래그로 선택하는 방식이다. 핸들로 범위를 조절하고 선택하면 「복사」가 뜬다.
- **Readwise:** 페이지를 찍으면 바로 OCR하고 손가락으로 끌어서 하이라이트를 고른다("snap a pic, highlight with your finger"). 사용자 평가는 엇갈린다(정확도 불만 있음).
- **국내:** Quollect(퀄렉트)는 사진을 찍은 뒤 원하는 부분을 드래그해 책별로 저장한다. 틈틈독서는 카메라와 기존 사진에서 문장을 수집한다. 밀리의서재, 북적북적, 플라이북에서는 같은 기능을 확인하지 못했다(검색 결과 없음).
- 공통점: ① 찍기 ② 줄 겹쳐 보기 ③ 드래그 선택 ④ 텍스트 확인·수정 ⑤ 저장. Talk후감도 이 순서를 그대로 따른다.

### 단계
1. composer `+` 시트에서 「사진에서 문장 가져오기」 → 「사진 찍기」 / 「사진 고르기」(스크린샷 포함).
2. 인식 중 상태: 사진을 흐리게 보여 주고 "문장을 읽고 있어요".
3. 선택 화면: 사진을 화면 폭에 맞추고 인식된 줄마다 옅은 박스를 그린다.
   - **탭:** 줄 하나를 켜고 끈다.
   - **끌기:** 시작 줄부터 끝 줄까지 연속 범위를 선택한다(줄 단위로 스냅. 글자 단위 선택은 MVP에서 제외).
   - **두 손가락:** 확대·이동. 320px에서는 확대가 사실상 필수다. 확대 중에는 한 손가락 끌기를 선택으로 처리한다.
   - 끌 때 손가락 위쪽에 현재 줄 텍스트를 말풍선(돋보기 대용)으로 띄운다.
   - 하단 고정 바: "3줄 · 142자"와 「다음」.
4. 확인 화면: 정리된 문단을 편집 가능한 입력창에 넣는다. 글자 수 카운터, 「쪽」 입력(선택), 「원문 줄바꿈 유지」 토글을 둔다.
5. 「글에 넣기」 → composer draft 끝에 인용 형식으로 삽입하고 쪽 라벨을 채운다 → 사용자가 자기 생각을 덧붙여 기존 「글 남기기」로 저장한다.

### 텍스트 정리 규칙 (`@talkhugam/domain`, 웹·모바일 공용 단위 테스트)
- 줄 끝 하이픈 + 다음 줄 영문 소문자로 시작 → 하이픈을 지우고 붙인다.
- 한국어 줄바꿈 → 기본은 공백 하나로 잇는다. 한국어 조판은 어절 중간에서도 줄을 바꾸는 경우가 있어 완벽한 자동 판정은 불가능하다. 그래서 확인 화면에서 반드시 수정할 수 있게 하고, 개선 단계에서 선택적으로 LLM 교정을 붙인다.
- 연속 공백 축약, 전각/반각 따옴표 정리, 쪽 번호·머리말(박스가 맨 위·아래에 있고 짧은 숫자) 자동 제외 제안.
- 문단 경계: 줄 사이 간격이나 첫 줄 들여쓰기로 추정해 빈 줄을 넣는다(개선 단계).

### 320px 스케치

```
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ ←  문장 고르기          다시 │   │ ←  가져올 문장 확인          │
├──────────────────────────────┤   ├──────────────────────────────┤
│ ┌──────────────────────────┐ │   │ ┌──────────────────────────┐ │
│ │ 그 해 여름은 유난히 길었 │ │   │ │ 우리는 늘 떠나는 쪽이었고│ │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░ │ │   │ │ 남는 쪽의 마음을 헤아린 │ │
│ │█우리는 늘 떠나는 쪽이었█│ │   │ │ 적이 없었다.             │ │
│ │█고 남는 쪽의 마음을 헤█ │ │   │ │                          │ │
│ │█아린 적이 없었다.      █ │ │   │ └──────────────────── 58/300┘ │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░ │ │   │ 쪽  [ 87 ]                   │
│ │ ░░░░░░░░░░░░░░░░░       │ │   │ ○ 원문 줄바꿈 유지           │
│ │            - 87 -        │ │   │                              │
│ └──────────────────────────┘ │   │ 사진은 저장되지 않아요.       │
├──────────────────────────────┤   ├──────────────────────────────┤
│ 3줄 · 58자          [ 다음 ] │   │          [ 글에 넣기 ]       │
└──────────────────────────────┘   └──────────────────────────────┘
  █ 선택한 줄   ░ 인식된 줄(미선택)
```

(문구는 구현 시 `talkhugam-copy-review` 스킬로 톤을 점검한다.)

## 5. 코드베이스 적합성 (읽기 전용 확인)

- **웹 composer:** `apps/web/src/pages/rooms/BookDiscussionPage.tsx`의 `ChatComposer`(759행~)가 `BottomSheet`로 `+` 시트를 연다. 현재 항목은 페이지 라벨, 챕터 라벨, 영상 올리기, 영상 기록, 별점, 책방 초대하기/초대 요청이다. 영상은 숨은 `<input accept="video/mp4,video/quicktime">`(1078행)로 받는다. 같은 패턴으로 `accept="image/*"` 입력을 추가하고 「사진에서 문장 가져오기」 항목을 넣으면 된다. 삽입은 기존 `onChangeDraft`, 쪽은 `onChangeLabels`(`labelKind: 'page'`)를 재사용한다.
- **모바일 composer:** `apps/mobile/src/features/reading-room/MobileBookDiscussionScreen.tsx`는 웹 같은 `+` 시트 없이 본문 `TextInput`, 라벨 입력("라벨 (예: 87쪽)"), 헤더의 「영상 기록」, 「별점」으로 구성된다. 입력창 근처에 사진 버튼을 두거나 `MobileVideoUploadSheet` 같은 시트를 새로 만든다. 삽입은 `setBody`, 쪽은 `setLabel`로 한다.
- **이미 있는 기능:** `expo-image-picker ~57.0.11`이 설치돼 있다(영상 촬영 `launchCameraAsync`, 아바타 `launchImageLibraryAsync({ mediaTypes: ['images'] })`). `expo-camera`와 `react-native-vision-camera`는 없다. MVP는 image-picker의 시스템 카메라로 충분하다. 실시간 프레임 인식은 불필요하다.
- **권한 문구:** `app.json`의 image-picker `cameraPermission`이 "독서 순간 **영상을** 촬영하려면…"으로 돼 있다. 사진 촬영 용도까지 포함하도록 바꿔야 한다(예: "독서 순간을 영상이나 사진으로 남기려면…"). Info.plist 문자열이 바뀌므로 **네이티브 재빌드(EAS)와 스토어 심사 대상**이다. 서버 OCR 경로만 쓰는 MVP도 이 문구 변경 때문에 새 빌드가 필요하다는 점을 기억해 둔다.
- **본문 제한:** `posts.body`는 DB check와 RPC에서 500자 제한이다(`supabase/migrations/20260716001200_create_posts.sql`, `..._create_post_rpcs.sql`). 인용 상한은 이보다 작게(예: 300자) 잡아 감상을 덧붙일 여유를 남긴다.
- **Edge Function:** `supabase/functions/`에 `book-search`, `mux-create-upload` 등 외부 API 프록시 선례가 있으므로 같은 구조(`_shared` 인증 유틸, `*-boundaries.test.ts`)를 따른다.
- **법적 문서:** `legalDocumentVersion = '2026-10-26.1'`(`packages/domain/src/authFlow.ts`)이다. 개인정보처리방침 2장에 처리 위탁처로 Supabase와 Mux가 나열돼 있다. 사진을 Google(또는 NAVER Cloud)로 보내면 **처리 위탁/국외 이전 항목 추가 → 버전 상향 → 전 사용자 재동의**가 필요하다. 사진이 저장되지 않더라도 제3자 처리 사실은 고지 대상으로 보는 것이 안전하다(법률 자문 아님). 문안 예: "사진에서 문장 가져오기를 사용하면 선택한 사진을 문자 인식을 위해 Google Cloud Vision에 전송하며, 인식 직후 폐기하고 저장하지 않습니다." 국외 이전이 싫다면 CLOVA(한국 리전)나 모바일 온디바이스 전용 출시(웹 제외)가 대안이다.

## 6. 저작권·인용 메모 (짧게)

- 저작권법 제28조는 공표된 저작물을 보도·비평·교육·연구 등을 위해 "정당한 범위 안에서 공정한 관행에 합치되게" 인용하는 것을 허용한다. 판례는 **인용하는 글이 주, 인용되는 글이 종**이어야 하고, 분량, 원저작물 수요 대체 여부 등을 종합해서 본다. 비공개 소모임 앱이라도 페이지 전체를 옮기는 기능처럼 보이면 곤란하다.
- 제품 가드레일 제안:
  - 한 번에 가져오는 분량 상한(예: 300자, 대략 3~6줄)과 "책 속 문장은 짧게 인용하고 내 생각을 함께 남겨 주세요" 안내.
  - 인용만 있는 글은 저장하지 않도록 경고하거나 "생각 한 줄"을 권장한다(강제 여부는 열린 질문).
  - 인용 블록 스타일(왼쪽 선 + 「책 제목 · 87쪽」 출처)을 둔다. MVP는 본문 텍스트 규칙(예: `> ` 접두나 「」)으로 표현하고, 개선 단계에서 `posts`에 `quote_text`/`quote_page` 같은 별도 필드를 마이그레이션으로 추가해 렌더링한다.
  - 사진 미저장 원칙(페이지 이미지 재배포 방지)을 화면에 명시한다.

## 7. 단계별 구현 범위

| 단계 | 범위 | 대략 공수 |
|---|---|---|
| 0. 검증 스파이크 | 실제 책 사진 20~30장(곡면, 반사, 한자·영문 혼용, 스크린샷)으로 Google Vision과 CLOVA 결과를 비교하고, 줄 묶기 로직을 프로토타입으로 만든다. ML Kit 라이브러리를 RN 0.86 dev build에 붙여 보고 앱 크기 증가를 잰다. | 1~1.5일 |
| 1. MVP (웹+모바일, 서버 OCR) | Edge Function `ocr-page`(인증, 호출 제한, Vision 호출, 줄 정규화, 경계 테스트). `@talkhugam/domain`에 `OcrLine` 타입, `joinOcrLines`, 정리 규칙 단위 테스트. 웹 선택 화면(이미지 + 절대배치 박스, Pointer Events 탭·드래그, 핀치 줌), 확인 화면, composer 삽입과 쪽 라벨. 모바일 동일 화면(RN `Image` + 박스 오버레이, Gesture Responder). 권한 문구 변경과 EAS 빌드. 개인정보처리방침 문안과 버전 상향. | 5~7일 |
| 2. 모바일 온디바이스 | ML Kit 라이브러리 또는 자체 Expo 모듈(iOS Vision, Android ML Kit unbundled Korean). 실패 시 서버로 전환. | 2~4일 |
| 3. 인용 표현 강화 | `posts` 인용 필드 마이그레이션, RPC 수정, 웹·모바일 인용 블록 렌더링, 책·쪽 출처 표시. | 2~3일 |
| 4. 품질 개선 (선택) | 글자 단위 선택 핸들, 문단 경계 추정, 머리말·쪽번호 자동 제외, 선택 텍스트만 LLM(예: Claude Haiku)으로 띄어쓰기 교정. 교정 전후 비교를 보여 주고 사용자가 고른다. | 2~4일 |

**로드맵 위치:** 현재 진행 중인 2단계(talk-109 운영자 역할)와 데이터·권한 의존성이 없는 **독립 기능**이다. 다만 6단계(talk-113)가 "`+` 메뉴 정리"를 포함하므로 둘 중 하나를 택한다. ① 6단계 이후에 붙이거나, ② 먼저 만들 경우 `+` 시트 항목 추가를 6단계 정리 계획에 반영한다. 법적 문서 버전 상향은 다른 약관 변경과 묶어서 재동의를 한 번만 받게 하는 편이 좋다.

## 8. 리스크와 열린 질문

**리스크**
- 한국어 책 사진의 실제 인식 품질(곡면, 반사, 작은 글씨, 2단 편집)은 측정하지 않았다. 스파이크(0단계) 전에는 공급자를 확정하지 않는다.
- Google Vision 응답에 "줄" 단위가 없어 단어와 `detectedBreak`로 줄을 직접 묶어야 한다. 2단 편집이나 기울어진 사진에서 묶음이 틀릴 수 있다.
- `@react-native-ml-kit/text-recognition`: 새 아키텍처 호환은 확인되지 않았다. 5개 스크립트 모델 번들로 앱 크기가 늘어난다(대략 수십 MB, 미측정).
- 재동의: 버전을 올리면 모든 사용자가 다시 동의해야 해서 이탈 마찰이 생긴다.
- 비용 남용: 인증 사용자만 쓰더라도 호출 상한이 없으면 과금 위험이 있다.
- 320px 화면에서 줄 박스가 작아 탭 정확도가 떨어진다. 확대와 드래그 스냅으로 보완해야 한다.
- 카메라 권한 문구 변경과 새 빌드로 스토어 심사 일정이 생긴다.

**사장님(오너)께 확인할 질문**
1. 사진을 Google(미국 등 국외)로 보내는 데 동의하는가? 아니면 국내(CLOVA)나 모바일 온디바이스 전용(웹은 나중에)을 우선하는가?
2. 개인정보처리방침 개정과 전 사용자 재동의를 이번 기능 때문에 감수할지, 다른 약관 변경과 묶을지.
3. 인용 분량 상한(제안 300자)과 "인용만 있는 글" 허용 여부.
4. 인용을 지금처럼 본문 텍스트로만 넣을지, DB 필드를 추가해 인용 블록으로 보여 줄지(3단계 포함 여부).
5. 사용자별 일일 OCR 호출 상한(제안 20회)과 월 예산 상한.
6. 착수 시점: 6단계 `+` 메뉴 정리 이전인가, 이후인가.

## 9. 출처 (접근일 2026-10-26)

**온디바이스 / 라이브러리**
- ML Kit Text Recognition v2 개요(지원 스크립트, Block/Line/Element 구조, 좌표·신뢰도): https://developers.google.com/ml-kit/vision/text-recognition/v2
- ML Kit Android 가이드(Korean bundled 약 4MB / unbundled 약 260KB, 입력 해상도 권장): https://developers.google.com/ml-kit/vision/text-recognition/v2/android
- ML Kit iOS Korean 레퍼런스: https://developers.google.com/ml-kit/reference/ios/mlkittextrecognitionkorean/api/reference/Classes/MLKKoreanTextRecognizerOptions
- `@react-native-ml-kit/text-recognition` npm 레지스트리(2.0.0, 2025-09-01, README의 `line.frame`, `TextRecognitionScript`): https://registry.npmjs.org/@react-native-ml-kit/text-recognition , 소스 https://github.com/a7medev/react-native-ml-kit , 네이티브 의존성 https://unpkg.com/@react-native-ml-kit/text-recognition@2.0.0/android/build.gradle
- `expo-text-extractor` 2.0.0(2026-02-28, `extractTextFromImage(): Promise<string[]>`, SDK 52+): https://registry.npmjs.org/expo-text-extractor , https://unpkg.com/expo-text-extractor@2.0.0/build/index.d.ts
- `@zhanziyang/expo-text-extractor`(CJK 포크): https://www.jsdelivr.com/package/npm/@zhanziyang/expo-text-extractor
- `@infinitered/react-native-mlkit-text-recognition` 5.0.1(Latin 모델만 연결): https://cdn.jsdelivr.net/npm/@infinitered/react-native-mlkit-text-recognition@5.0.1/android/build.gradle
- `react-native-vision-camera` 5.2.3(2026-08-20): https://registry.npmjs.org/react-native-vision-camera
- Apple Vision `VNRecognizeTextRequest.recognitionLanguages`: https://developer.apple.com/documentation/vision/vnrecognizetextrequest/recognitionlanguages , 텍스트 인식 가이드 https://developer.apple.com/documentation/vision/recognizing-text-in-images , 리비전별 한국어 지원 논의 https://developer.apple.com/forums/thread/684807 (iOS 16 이상에서 `ko-KR` 지원으로 알려져 있으나 공식 표로 확인하지 못함, 런타임 확인 권장)
- VisionKit `ImageAnalysisInteraction`: https://developer.apple.com/documentation/visionkit/imageanalysisinteraction , WWDC22 Live Text https://developer.apple.com/wwdc22/10026 (RN/Expo 래퍼는 검색으로 찾지 못함)

**웹**
- Tesseract.js 7.0.0(2025-12-15): https://registry.npmjs.org/tesseract.js , 한국어 데이터 `@tesseract.js-data/kor`(gz 기준 `4.0.0_best_int` 약 1.57MB, `4.0.0` 약 6.95MB, HTTP Content-Length로 측정): https://cdn.jsdelivr.net/npm/@tesseract.js-data/kor/
- Shape Detection API(`TextDetector` 상태, 플래그): https://developer.chrome.com/docs/capabilities/shape-detection

**클라우드**
- Google Cloud Vision 가격(Text/Document Text Detection 월 1,000건 무료, 1,001~5,000,000건 $1.50/1,000): https://cloud.google.com/vision/pricing
- Google Cloud Vision 데이터 사용 FAQ(동기 요청은 디스크에 저장하지 않음, 학습에 쓰지 않음): https://cloud.google.com/vision/docs/data-usage
- Google Vision 전체 텍스트 주석 구조(page/block/paragraph/word/symbol, detectedBreak): https://cloud.google.com/vision/docs/fulltext-annotations
- CLOVA OCR 사용 준비(언어 ko/en/ja, 1 TPS, 데이터 미저장, 종량제): https://guide.ncloud-docs.com/docs/clovaocr-spec
- CLOVA OCR General API(V2 `boundingPoly`, `lineBreak`, `lang`): https://api.ncloud-docs.com/docs/ai-application-service-ocr-ocr
- CLOVA OCR General 사용 가이드(파일 50MB, 장축 권장 1960px): https://guide.ncloud-docs.com/docs/clovaocr-general
- CLOVA OCR 상품·요금 페이지(단가 확인 실패): https://www.ncloud.com/product/aiService/ocr . 제3자 자료는 무료량을 월 1,000건과 5,000건으로 서로 다르게 적고 있어 신뢰하지 않음: https://www.lido.app/kr/clova-ocr-daean
- Upstage 가격(Document OCR $0.0015/페이지): https://www.upstage.ai/pricing
- Azure Document Intelligence Read 언어 지원(인쇄체 Korean `ko`): https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/language-support/ocr , 가격(공식 페이지에서 수치 렌더링 실패, $1.50/1,000은 Q&A·제3자 자료): https://azure.microsoft.com/pricing/details/ai-document-intelligence/ , https://learn.microsoft.com/en-us/answers/questions/1349767/why-prebuilt-read-model-charge-10-1000-pages-inste
- Claude 비전(토큰 계산, 좌표는 근사치, 업로드 이미지 학습 미사용, Haiku 4.5 기준 1000×1000 약 $1.30/1,000장): https://platform.claude.com/docs/en/build-with-claude/vision , 가격 https://platform.claude.com/docs/en/about-claude/pricing
- Supabase Edge Functions 제한(CPU 2초, 메모리 256MB, 유휴 150초): https://supabase.com/docs/guides/functions/limits (요청 본문 크기 한도는 공식 문서에서 확인하지 못함)

**UX 사례**
- Readwise App Store(사진으로 하이라이트): https://apps.apple.com/us/app/-/id1476885528 , 사용자 후기 https://talk.macpowerusers.com/t/readwise-ios-app-for-scanning-real-highlights-in-books/46290
- Quollect(퀄렉트): https://apps.apple.com/kr/app/quollect-%ED%80%84%EB%A0%89%ED%8A%B8-%EB%8F%85%EC%84%9C-%EA%B8%B0%EB%A1%9D-%EB%AC%B8%EC%9E%A5-%EC%88%98%EC%A7%91/id6744570970
- 틈틈독서: https://apps.apple.com/us/app/%ED%8B%88%ED%8B%88%EB%8F%85%EC%84%9C/id6745096972?l=ko
- 밀리의서재, 북적북적, 플라이북: 사진 문장 인식 기능을 확인하지 못함.

**저작권**
- 대법원 2014. 8. 26. 선고 2012도10786 판결 요지: https://www.nepla.ai/case/대법원/2012도10786
- 대법원 2013. 2. 15. 선고 2011도5835 판결: https://www.nepla.ai/case/대법원/2011도5835
- 현행 조문 원문: 국가법령정보센터 저작권법 제28조 https://www.law.go.kr/법령/저작권법 (이번 조사에서 원문은 직접 열람하지 않음)
