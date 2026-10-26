import { useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'

import { mobileColors } from './mobileTheme'

type MobileProfileAvatarProps = {
  /** 프로필에 저장된 사진 경로. `null`이면 사진 없음이다. */
  avatarPath: string | null
  avatarUrl: string | null | undefined
  displayName: string
  hasAvatarError?: boolean
  size?: number
}

/**
 * 사진 경로·임시 URL·오류 여부를 받아 무엇을 보여 줄지 정한다.
 * 경로가 없거나 실패하면 첫 글자, 경로는 있는데 URL을 기다리면 빈 자리, URL이 있으면 사진이다.
 */
export function resolveMobileAvatarDisplay(
  avatarPath: string | null,
  avatarUrl: string | null | undefined,
  hasAvatarError: boolean,
): 'image' | 'initial' | 'placeholder' {
  if (hasAvatarError || avatarPath === null) return 'initial'
  return avatarUrl ? 'image' : 'placeholder'
}

/** 사진이 있는 사람에게 첫 글자가 먼저 보였다가 바뀌지 않도록, 사진이 다 불러와질 때까지 빈 원을 둔다. */
export function MobileProfileAvatar({
  avatarPath,
  avatarUrl,
  displayName,
  hasAvatarError = false,
  size = 64,
}: MobileProfileAvatarProps): React.JSX.Element {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const hasImageFailed = Boolean(avatarUrl) && failedUrl === avatarUrl
  const display = resolveMobileAvatarDisplay(avatarPath, avatarUrl, hasAvatarError || hasImageFailed)
  const circle = { borderRadius: size / 2, height: size, width: size }

  return (
    <View style={[styles.circle, circle]} testID={`profile-avatar-${display}`}>
      {display === 'initial' ? (
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.375) }]}>
          {displayName.slice(0, 1)}
        </Text>
      ) : null}
      {display === 'image' && avatarUrl ? (
        <Image
          accessibilityLabel="프로필 사진"
          onError={() => setFailedUrl(avatarUrl)}
          onLoad={() => setLoadedUrl(avatarUrl)}
          source={{ uri: avatarUrl }}
          style={[styles.image, circle, { opacity: loadedUrl === avatarUrl ? 1 : 0 }]}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.border,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { left: 0, position: 'absolute', top: 0 },
  initial: { color: mobileColors.ink, fontWeight: '700' },
})
