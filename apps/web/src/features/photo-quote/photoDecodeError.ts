export { isPhotoDecodeError, PhotoDecodeError } from '@talkhugam/domain'

/** 브라우저가 열 수 없는 사진 형식(예: Mac Chrome의 HEIC)을 알릴 때 보여 줄 문구. */
export const unsupportedPhotoFormatMessage =
  '이 사진 형식은 이 브라우저에서 열 수 없어요. JPG나 PNG로 바꿔 다시 골라 주세요.'
