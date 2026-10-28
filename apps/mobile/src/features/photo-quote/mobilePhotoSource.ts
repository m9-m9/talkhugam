import { getScaledImageSize, ocrPhotoJpegQuality, PhotoDecodeError } from '@talkhugam/domain'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'

import { parsePickedPhoto, type PickedPhoto } from './pickedPhoto'

export type PhotoSource = 'camera' | 'library'

export type PhotoPickResult =
  | { photo: PickedPhoto; status: 'picked' }
  | { status: 'canceled' }
  | { status: 'denied' }

/** 서버로 보낼 줄인 사진. uri는 화면 미리보기용이고 base64는 ocr-page 전송용이며 둘 다 저장하지 않는다. */
export type PreparedOcrPhoto = PickedPhoto & { base64: string }

/** 카메라 또는 사진 보관함 권한을 요청하고 허용 여부를 반환한다. */
async function requestPhotoPermission(source: PhotoSource): Promise<boolean> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
  return permission.granted
}

/**
 * 카메라로 책 페이지를 찍거나 앨범에서 고르게 하고, 결과를 권한 거부·취소·선택으로 나눠 반환한다.
 * EXIF(위치 등)는 요청하지 않는다.
 */
export async function pickPhotoForQuote(source: PhotoSource): Promise<PhotoPickResult> {
  if (!(await requestPhotoPermission(source))) return { status: 'denied' }
  const options: ImagePicker.ImagePickerOptions = { exif: false, mediaTypes: ['images'], quality: 1 }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options)
  const photo = parsePickedPhoto(result)
  return photo ? { photo, status: 'picked' } : { status: 'canceled' }
}

/**
 * 고른 사진을 긴 변 2000px JPEG로 줄이고 base64를 함께 반환한다. 사진을 열거나 줄이지 못하면
 * 서버를 부르기 전에 PhotoDecodeError로 멈춘다. 결과는 메모리·임시 파일로만 쓴다.
 */
export async function preparePhotoForOcr(photo: PickedPhoto): Promise<PreparedOcrPhoto> {
  try {
    const size = getScaledImageSize({ height: photo.height, width: photo.width })
    const image = await ImageManipulator.manipulate(photo.uri).resize(size).renderAsync()
    const saved = await image.saveAsync({
      base64: true,
      compress: ocrPhotoJpegQuality,
      format: SaveFormat.JPEG,
    })
    if (!saved.base64) throw new Error('base64 missing')
    return { base64: saved.base64, height: saved.height, uri: saved.uri, width: saved.width }
  } catch (error) {
    throw new PhotoDecodeError(error)
  }
}
