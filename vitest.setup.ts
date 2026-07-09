import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom's localStorage is not reliably functional under vitest — install a
// simple in-memory implementation.
function makeStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  } as Storage;
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", { value: makeStorage(), configurable: true, writable: true });
  Object.defineProperty(globalThis, "localStorage", { value: window.localStorage, configurable: true, writable: true });
}

// jsdom doesn't implement these; stub so components using them don't crash.
if (typeof window !== "undefined") {
  window.scrollTo = vi.fn();
  if (!("IntersectionObserver" in window)) {
    // @ts-expect-error minimal stub
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
  Element.prototype.scrollIntoView = vi.fn();
  // Radix UI uses these in jsdom
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
}

afterEach(() => {
  cleanup();
});
