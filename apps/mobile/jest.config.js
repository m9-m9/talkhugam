/** Expo 런타임과 동일한 변환 규칙으로 네이티브 화면 테스트를 실행한다. */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.ts?(x)'],
}
