import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Testing Library's automatic cleanup only registers when Vitest globals are
// enabled, so unmount between tests explicitly and keep queries unambiguous.
afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia, which the theme preference, the Motion
// reduced-motion hook and the responsive panel logic all rely on.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }),
  });
}

// jsdom has no layout engine, so the score canvas cannot report a screen CTM.
// Interaction geometry is covered by the pure geometry tests and by the
// Playwright suite; here we only need the DOM to render.
if (typeof SVGSVGElement !== 'undefined' && !SVGSVGElement.prototype.getScreenCTM) {
  SVGSVGElement.prototype.getScreenCTM = function getScreenCTM() {
    return null as unknown as DOMMatrix;
  };
}

// jsdom ships a `scrollTo` that logs "not implemented"; route it to a no-op.
Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() });
