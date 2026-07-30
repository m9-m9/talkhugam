import '@testing-library/jest-dom/vitest'

if (typeof CSS !== 'undefined' && typeof CSS.supports !== 'function') {
  Object.defineProperty(CSS, 'supports', {
    configurable: true,
    value: () => false,
  })
}
