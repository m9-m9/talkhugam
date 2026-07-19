import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ProfileAvatar } from './ProfileAvatar'

describe('ProfileAvatar', () => {
  afterEach(cleanup)

  it('renders the signed profile image when one is available', () => {
    render(
      <ProfileAvatar
        alt="민규 프로필 사진"
        displayName="민규"
        src="https://example.com/profile.png"
      />,
    )

    expect(screen.getByRole('img', { name: '민규 프로필 사진' })).toHaveAttribute(
      'src',
      'https://example.com/profile.png',
    )
  })

  it('falls back to the first display-name character without an image', () => {
    render(<ProfileAvatar alt="민규 프로필 사진" displayName="민규" src={null} />)

    expect(screen.queryByRole('img', { name: '민규 프로필 사진' })).not.toBeInTheDocument()
    expect(screen.getByText('민')).toBeInTheDocument()
  })
})
