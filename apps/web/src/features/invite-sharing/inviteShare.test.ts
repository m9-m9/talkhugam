import { describe, expect, it, vi } from 'vitest'

import {
  copyInviteText,
  createInviteShareData,
  getInvitePlatformUrl,
  shareInviteWithKakao,
} from './inviteShare'

describe('createInviteShareData', () => {
  it('creates a join link and share message from the one-time invite token', () => {
    expect(
      createInviteShareData('https://talkhugam.example', '금요일 아침 책방', {
        code: 'TALK87',
        token: 'a'.repeat(64),
      }),
    ).toEqual({
      text: '금요일 아침 책방에 초대해요.\n초대 코드: TALK87\nTalk후감에서 코드를 입력해 함께 읽기 시작해요.',
      title: '금요일 아침 책방 초대',
      url: `https://talkhugam.example/rooms/join?invite=${'a'.repeat(64)}`,
    })
  })
})

describe('getInvitePlatformUrl', () => {
  const shareData = {
    text: '초대 문구',
    title: '책방 초대',
    url: 'https://talkhugam.example/rooms/join?invite=token',
  }

  it('uses the SMS URI and Facebook share URL supported by browsers', () => {
    expect(getInvitePlatformUrl('sms', shareData)).toBe(
      'sms:?&body=%EC%B4%88%EB%8C%80%20%EB%AC%B8%EA%B5%AC%0Ahttps%3A%2F%2Ftalkhugam.example%2Frooms%2Fjoin%3Finvite%3Dtoken',
    )
    expect(getInvitePlatformUrl('facebook', shareData)).toBe(
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Ftalkhugam.example%2Frooms%2Fjoin%3Finvite%3Dtoken',
    )
    expect(getInvitePlatformUrl('instagram', shareData)).toBe('https://www.instagram.com/')
    expect(getInvitePlatformUrl('kakao', shareData)).toBeNull()
  })
})

describe('copyInviteText', () => {
  it('uses the legacy copy command if the Clipboard API is unavailable', async () => {
    const execCommand = vi.fn().mockReturnValue(true)
    const appendChild = vi.spyOn(document.body, 'appendChild')
    const removeChild = vi.spyOn(document.body, 'removeChild')
    const documentApi = {
      body: document.body,
      createElement: document.createElement.bind(document),
      execCommand,
    }

    await expect(copyInviteText('초대 링크', undefined, documentApi)).resolves.toBeUndefined()

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(appendChild).toHaveBeenCalled()
    expect(removeChild).toHaveBeenCalled()
  })
})

describe('shareInviteWithKakao', () => {
  it('initializes Kakao once and sends the invite link with the text template', async () => {
    const init = vi.fn()
    const sendDefault = vi.fn()
    const loadKakao = vi.fn().mockResolvedValue({
      Share: { sendDefault },
      init,
      isInitialized: () => false,
    })
    const shareData = {
      text: '금요일 아침 책방에 초대해요.\n초대 코드: TALK87',
      title: '금요일 아침 책방 초대',
      url: 'https://talkhugam.example/rooms/join?invite=token',
    }

    await shareInviteWithKakao(shareData, 'javascript-key', loadKakao)

    expect(init).toHaveBeenCalledWith('javascript-key')
    expect(sendDefault).toHaveBeenCalledWith({
      link: {
        mobileWebUrl: 'https://talkhugam.example/rooms/join?invite=token',
        webUrl: 'https://talkhugam.example/rooms/join?invite=token',
      },
      objectType: 'text',
      text: '금요일 아침 책방에 초대해요.\n초대 코드: TALK87',
    })
  })
})
