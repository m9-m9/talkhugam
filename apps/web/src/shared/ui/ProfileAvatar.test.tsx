import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ProfileAvatar } from './ProfileAvatar'
import { resolveAvatarDisplay } from './profileAvatarDisplay'

describe('resolveAvatarDisplay', () => {
  it('구분한다: 경로 없음은 첫 글자, 경로 있음·URL 대기는 빈 자리, URL 있음은 사진, 실패는 첫 글자', () => {
    expect(resolveAvatarDisplay({ avatarPath: null, avatarUrl: undefined })).toBe('initial')
    expect(resolveAvatarDisplay({ avatarPath: 'a/avatar', avatarUrl: undefined })).toBe(
      'placeholder',
    )
    expect(resolveAvatarDisplay({ avatarPath: undefined, avatarUrl: undefined })).toBe(
      'placeholder',
    )
    expect(resolveAvatarDisplay({ avatarPath: 'a/avatar', avatarUrl: 'https://x/a' })).toBe('image')
    expect(
      resolveAvatarDisplay({ avatarPath: 'a/avatar', avatarUrl: undefined, hasAvatarError: true }),
    ).toBe('initial')
  })
})

describe('ProfileAvatar', () => {
  afterEach(cleanup)

  it('사진 경로가 있고 URL을 기다리는 동안 첫 글자를 보여 주지 않는다', () => {
    render(<ProfileAvatar avatarPath="a/avatar" avatarUrl={undefined} displayName="정민" />)

    expect(screen.queryByText('정')).not.toBeInTheDocument()
    expect(screen.getByTestId('profile-avatar')).toHaveAttribute('data-avatar-state', 'placeholder')
  })

  it('사진이 다 불러와지기 전에는 투명하게 두고 불러온 뒤 보여 준다', () => {
    render(<ProfileAvatar avatarPath="a/avatar" avatarUrl="https://x/a" displayName="정민" />)

    const image = screen.getByRole('img', { name: '정민 프로필 사진' })
    expect(image).toHaveClass('opacity-0')
    expect(screen.queryByText('정')).not.toBeInTheDocument()
    fireEvent.load(image)
    expect(image).toHaveClass('opacity-100')
  })

  it('사진을 불러오지 못하면 첫 글자로 돌아간다', () => {
    render(<ProfileAvatar avatarPath="a/avatar" avatarUrl="https://x/a" displayName="정민" />)

    fireEvent.error(screen.getByRole('img', { name: '정민 프로필 사진' }))

    expect(screen.getByText('정')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('임시 URL 조회가 실패하면 첫 글자를 보여 준다', () => {
    render(
      <ProfileAvatar
        avatarPath="a/avatar"
        avatarUrl={undefined}
        displayName="정민"
        hasAvatarError
      />,
    )

    expect(screen.getByText('정')).toBeInTheDocument()
  })

  it('사진 경로가 없으면 첫 글자를 보여 준다', () => {
    render(<ProfileAvatar avatarPath={null} avatarUrl={undefined} displayName="정민" />)

    expect(screen.getByText('정')).toBeInTheDocument()
  })
})
