import { describe, expect, it } from '@jest/globals'

import appConfig from '../app.json'

describe('Android App Link configuration', () => {
  it('links native push registration to the configured EAS project', () => {
    expect(appConfig.expo.extra?.eas?.projectId).toBe('df9281eb-d568-434a-a7a7-a3b8ea5feb64')
    expect(appConfig.expo.owner).toBe('facilance')
  })

  it('keeps associated domains and Android intent filters unique after EAS configuration', () => {
    const associatedDomains = appConfig.expo.ios.associatedDomains
    const intentFilters = appConfig.expo.android.intentFilters.map((filter) => {
      return JSON.stringify(filter)
    })

    expect(new Set(associatedDomains).size).toBe(associatedDomains.length)
    expect(new Set(intentFilters).size).toBe(intentFilters.length)
  })

  it('keeps Android microphone permission once for audio video capture', () => {
    const microphonePermissions = appConfig.expo.android.permissions.filter((permission) => {
      return permission === 'android.permission.RECORD_AUDIO'
    })

    expect(microphonePermissions).toHaveLength(1)
  })

  it('routes verified Talk후감 room invite links into the native rooms route', () => {
    const intentFilters = appConfig.expo.android.intentFilters
    const roomLink = intentFilters
      .flatMap((filter) => filter.data)
      .find((data) => {
        return (
          data.scheme === 'https' &&
          data.host === 'talkhugam.vercel.app' &&
          data.pathPrefix === '/rooms'
        )
      })

    expect(roomLink).toBeDefined()
  })

  it('routes verified open community links into the native community route', () => {
    const intentFilters = appConfig.expo.android.intentFilters
    const communityLink = intentFilters
      .flatMap((filter) => filter.data)
      .find((data) => {
        return (
          data.scheme === 'https' &&
          data.host === 'talkhugam.vercel.app' &&
          data.pathPrefix === '/community'
        )
      })

    expect(communityLink).toBeDefined()
  })
})
