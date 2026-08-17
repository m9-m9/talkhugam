import '@testing-library/jest-dom/vitest'

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverMock {
    /** 관찰 콜백을 받아 jsdom용 ResizeObserver 대역을 만든다. */
    constructor(callback: ResizeObserverCallback) {
      void callback
    }

    /** 관찰을 끝내는 브라우저 API를 빈 동작으로 흉내 낸다. */
    disconnect() {}

    /** 요소와 옵션을 받아 크기 관찰 시작 API를 빈 동작으로 흉내 낸다. */
    observe(target: Element, options?: ResizeObserverOptions) {
      void target
      void options
    }

    /** 요소를 받아 크기 관찰 해제 API를 빈 동작으로 흉내 낸다. */
    unobserve(target: Element) {
      void target
    }
  }

  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
    writable: true,
  })
}

if (typeof CSS !== 'undefined' && typeof CSS.supports !== 'function') {
  Object.defineProperty(CSS, 'supports', {
    configurable: true,
    value: () => false,
  })
}
