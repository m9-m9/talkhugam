/** 브라우저가 열 수 없는 사진 형식(예: Mac Chrome의 HEIC)을 알릴 때 보여 줄 문구. */
export const unsupportedPhotoFormatMessage =
  '이 사진 형식은 이 브라우저에서 열 수 없어요. JPG나 PNG로 바꿔 다시 골라 주세요.'

/** 사진을 서버로 보내기 전, 브라우저에서 디코드·축소하지 못했음을 서버 인식 실패와 구분해 나타낸다. */
export class PhotoDecodeError extends Error {
  /** 원인 오류를 받아 사진 형식 오류를 만든다. 원인은 기록하지 않고 구분용으로만 둔다. */
  constructor(cause?: unknown) {
    super('photo decode failed', { cause })
    this.name = 'PhotoDecodeError'
  }
}

/** 오류가 브라우저 사진 디코드 실패인지 판단한다. */
export function isPhotoDecodeError(error: unknown): error is PhotoDecodeError {
  return error instanceof PhotoDecodeError
}
