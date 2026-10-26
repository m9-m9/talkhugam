import { Stack } from 'expo-router'

import { MobileAppProviders } from '../src/shared/api/MobileAppProviders'
import { MobilePushRegistration } from '../src/features/notification/MobilePushRegistration'

/** 모바일 앱의 최상위 화면 전환과 공통 헤더 표시 방식을 구성한다. */
export default function RootLayout(): React.JSX.Element {
  return (
    <MobileAppProviders>
      <MobilePushRegistration />
      <Stack screenOptions={{ headerShown: false }} />
    </MobileAppProviders>
  )
}
