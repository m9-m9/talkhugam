#!/usr/bin/env bash
# macOS 키체인(서비스 talkhugam-clova-ocr)에 넣어 둔 CLOVA OCR 호출 주소·Secret을 환경 변수로 넣고 뒤 명령을 실행한다.
# 값은 화면·로그에 출력하지 않는다. 처음 한 번 등록하는 방법은 openwiki/testing-guide의 「OCR 코퍼스」를 본다.
set -euo pipefail

read_keychain() {
  if ! security find-generic-password -s talkhugam-clova-ocr -a "$1" -w 2>/dev/null; then
    echo "키체인에 talkhugam-clova-ocr / $1 항목이 없습니다. 등록: security add-generic-password -U -s talkhugam-clova-ocr -a $1 -w" >&2
    exit 1
  fi
}

CLOVA_OCR_INVOKE_URL="$(read_keychain invoke-url)"
CLOVA_OCR_SECRET="$(read_keychain secret)"
export CLOVA_OCR_INVOKE_URL CLOVA_OCR_SECRET
exec "$@"
