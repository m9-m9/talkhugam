import { describe, expect, it } from '@jest/globals'

import appConfig from '../app.json'

describe('Android App Link configuration', () => {
  it('links native push registration to the configured EAS project', () => {
    expect(appConfig.expo.extra?.eas?.projectId).toBe('df9281eb-d568-434a-a7a7-a3b8ea5feb64')
    expect(appConfig.expo.owner).toBe('facilance')
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
