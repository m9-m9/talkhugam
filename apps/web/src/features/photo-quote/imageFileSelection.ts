export type PastedImageResult =
  { file: File; status: 'image' } | { status: 'none' } | { status: 'unsupported' }

/** 이미지가 아닌 파일만 붙여넣거나 끌어 놓았을 때 보여 줄 짧은 안내. */
export const unsupportedPhotoFileMessage = '사진 파일만 넣을 수 있어요.'

/**
 * 붙여넣기(clipboardData.files)나 끌어다 놓기(dataTransfer.files)의 파일 목록을 받아
 * 첫 이미지 파일을 고른다. 파일이 없으면 none(텍스트 붙여넣기는 그대로 둔다),
 * 이미지가 아닌 파일만 있으면 unsupported를 반환한다.
 */
export function findPastedImageFile(files: ArrayLike<File> | undefined | null): PastedImageResult {
  const list = Array.from(files ?? [])
  if (list.length === 0) return { status: 'none' }
  const file = list.find((candidate) => candidate.type.startsWith('image/'))
  return file ? { file, status: 'image' } : { status: 'unsupported' }
}
