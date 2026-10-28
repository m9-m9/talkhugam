import { fireEvent, render, screen } from '@testing-library/react-native'
import { describe, expect, it } from '@jest/globals'

import { MobileProfileAvatar } from '../src/shared/ui/MobileProfileAvatar'

describe('MobileProfileAvatar', () => {
  it('사진 경로가 있고 URL을 기다리는 동안 첫 글자를 보여 주지 않는다', () => {
    render(<MobileProfileAvatar avatarPath="p/avatar" avatarUrl={undefined} displayName="정민" />)
    expect(screen.queryByText('정')).toBeNull()
    expect(screen.getByTestId('profile-avatar-placeholder')).toBeVisible()
  })

  it('사진을 불러오지 못하면 첫 글자로 돌아간다', () => {
    render(<MobileProfileAvatar avatarPath="p/avatar" avatarUrl="https://x/a" displayName="정민" />)
    fireEvent(screen.getByLabelText('프로필 사진'), 'error')
    expect(screen.getByText('정')).toBeVisible()
  })

  it('사진 경로가 없으면 첫 글자를 보여 준다', () => {
    render(<MobileProfileAvatar avatarPath={null} avatarUrl={undefined} displayName="정민" />)
    expect(screen.getByText('정')).toBeVisible()
  })
})
