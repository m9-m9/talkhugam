import { afterEach, describe, expect, it } from 'vitest'

import { loadClarity } from './clarity'

describe('loadClarity', () => {
  afterEach(() => {
    document.getElementById('talkhugam-clarity')?.remove()
    delete window.clarity
  })

  it('loads the supplied project tag once and prepares the Clarity command queue', () => {
    loadClarity('xoernfdaoq')
    loadClarity('xoernfdaoq')

    const script = document.getElementById('talkhugam-clarity') as HTMLScriptElement

    expect(script.src).toBe('https://www.clarity.ms/tag/xoernfdaoq')
    expect(script.async).toBe(true)
    expect(document.querySelectorAll('#talkhugam-clarity')).toHaveLength(1)
    expect(window.clarity).toBeTypeOf('function')
  })
})
