import { describe, expect, it } from '@jest/globals'

import appConfig from '../app.json'

describe('Android App Link configuration', () => {
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
})
