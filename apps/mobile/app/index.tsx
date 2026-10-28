import * as WebBrowser from 'expo-web-browser'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { openMobileOAuthSession } from '../src/features/auth/openMobileOAuthSession'
import {
  createMobileAuthenticatedRoute,
  parseMobileReturnPath,
} from '../src/features/auth/mobileReturnRoute'
import { resolveMobileAuthDestination } from '../src/features/auth/resolveMobileAuthDestination'
import { type MobileOAuthProvider } from '../src/features/auth/startMobileOAuth'
import { createMobileSupabaseClient } from '../src/shared/api/mobileSupabaseClient'
import { MobileRouteLoadingScreen } from '../src/shared/ui/MobileRouteLoadingScreen'
import { mobileColors } from '../src/shared/ui/mobileTheme'

type SocialLoginButtonProps = {
  accessibilityLabel: string
  isDisabled: boolean
  onPress: () => void
  providerName: string
}

/** 소셜 제공자 로그인 요청을 시작하는 44px 이상의 접근 가능한 버튼을 표시한다. */
function SocialLoginButton({
  accessibilityLabel,
  isDisabled,
  onPress,
  providerName,
}: SocialLoginButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.loginButton,
        isDisabled && styles.loginButtonDisabled,
        pressed && !isDisabled && styles.loginButtonPressed,
      ]}
    >
      <Text style={styles.loginButtonText}>{providerName}로 계속하기</Text>
    </Pressable>
  )
}

/** Talk후감 계정을 만들거나 기존 소셜 계정으로 로그인하는 첫 화면을 표시한다. */
export default function WelcomeScreen(): React.JSX.Element {
  const router = useRouter()
  const parameters = useLocalSearchParams<{ returnTo?: string | string[] }>()
  const returnPath = parseMobileReturnPath(parameters.returnTo)
  const [isSessionChecking, setIsSessionChecking] = useState(true)
  const [isLoginPending, setIsLoginPending] = useState(false)
  const [loginErrorMessage, setLoginErrorMessage] = useState<string | null>(null)
  const isOAuthLaunchLockedRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    /** 기기에 남아 있는 세션을 읽고 현재 계정이 접근할 첫 화면으로 이동한다. */
    async function restoreSession(): Promise<void> {
      try {
        const client = createMobileSupabaseClient()
        const sessionResponse = await client.auth.getSession()
        if (sessionResponse.error) throw sessionResponse.error
        if (!sessionResponse.data.session) {
          if (isMounted) setIsSessionChecking(false)
          return
        }

        const destination = await resolveMobileAuthDestination(client)
        if (isMounted) router.replace(createMobileAuthenticatedRoute(destination, returnPath))
      } catch {
        // 세션을 복원하지 못한 경우에도 로그인 화면에서 다시 인증할 수 있다.
        if (isMounted) setIsSessionChecking(false)
      }
    }

    void restoreSession()

    return () => {
      isMounted = false
    }
  }, [returnPath, router])

  /** 선택한 제공자의 OAuth 브라우저 흐름을 실행하고 화면 상태를 안전하게 갱신한다. */
  async function handleLogin(provider: MobileOAuthProvider): Promise<void> {
    if (isLoginPending || isOAuthLaunchLockedRef.current) return

    isOAuthLaunchLockedRef.current = true
    setIsLoginPending(true)
    setLoginErrorMessage(null)

    try {
      const client = createMobileSupabaseClient()
      const result = await openMobileOAuthSession(client, provider, WebBrowser)
      if (result === 'authenticated') {
        const destination = await resolveMobileAuthDestination(client)
        router.replace(createMobileAuthenticatedRoute(destination, returnPath))
      }
    } catch {
      setLoginErrorMessage('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      isOAuthLaunchLockedRef.current = false
      setIsLoginPending(false)
    }
  }

  /** 카카오 OAuth 브라우저를 연다. */
  function handleKakaoLogin(): void {
    void handleLogin('kakao')
  }

  /** Google OAuth 브라우저를 연다. */
  function handleGoogleLogin(): void {
    void handleLogin('google')
  }

  if (isSessionChecking) {
    return <MobileRouteLoadingScreen label="계정 정보를 확인하고 있어요." />
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <Text style={styles.wordmark}>Talk후감</Text>
        <Text style={styles.title}>읽고 나눈 마음을{'\n'}책방에 남겨 보세요.</Text>
        <Text style={styles.message}>친구와 함께 읽은 책의 이야기를 이어갈 수 있어요.</Text>
      </View>
      <View style={styles.loginSection}>
        {isLoginPending ? (
          <View
            accessibilityLabel="로그인을 연결하고 있어요."
            accessibilityLiveRegion="polite"
            accessibilityRole="progressbar"
            style={styles.status}
          >
            <ActivityIndicator color={mobileColors.accent} />
            <Text style={styles.statusText}>로그인을 연결하고 있어요.</Text>
          </View>
        ) : null}
        {loginErrorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorMessage}>
            {loginErrorMessage}
          </Text>
        ) : null}
        <SocialLoginButton
          accessibilityLabel="카카오로 계속하기"
          isDisabled={isLoginPending}
          onPress={handleKakaoLogin}
          providerName="카카오"
        />
        <SocialLoginButton
          accessibilityLabel="Google로 계속하기"
          isDisabled={isLoginPending}
          onPress={handleGoogleLogin}
          providerName="Google"
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: mobileColors.surface,
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 48,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  errorMessage: {
    color: mobileColors.danger,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  loginButton: {
    alignItems: 'center',
    backgroundColor: mobileColors.surfaceRaised,
    borderColor: mobileColors.border,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonPressed: {
    backgroundColor: mobileColors.surfacePressed,
  },
  loginButtonText: {
    color: mobileColors.ink,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  loginSection: {
    gap: 12,
  },
  message: {
    color: mobileColors.inkSubtle,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
  },
  status: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusText: {
    color: mobileColors.inkSubtle,
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    color: mobileColors.ink,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 40,
    marginTop: 24,
  },
  wordmark: {
    color: mobileColors.ink,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
})
