// tests/helpers/themeMocks.ts
import { vi } from 'vitest';

export interface MatchMediaController {
  setMatches: (query: string, matches: boolean) => void;
  dispatchChange: (query: string, matches: boolean) => void;
  reset: () => void;
}

/**
 * Creates a high-fidelity window.matchMedia mock supporting query matching,
 * addEventListener / removeEventListener, and programmatic event dispatching.
 */
export function setupMatchMediaMock(initialQueries: Record<string, boolean> = {}): MatchMediaController {
  const queryState: Record<string, boolean> = { ...initialQueries };
  const listenersMap = new Map<string, Set<(e: MediaQueryListEvent) => void>>();

  const getOrCreateListeners = (query: string) => {
    if (!listenersMap.has(query)) {
      listenersMap.set(query, new Set());
    }
    return listenersMap.get(query)!;
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const listeners = getOrCreateListeners(query);
      return {
        get matches() {
          return queryState[query] ?? false;
        },
        media: query,
        onchange: null,
        addListener: vi.fn((cb) => listeners.add(cb)),
        removeListener: vi.fn((cb) => listeners.delete(cb)),
        addEventListener: vi.fn((event: string, cb: any) => {
          if (event === 'change') listeners.add(cb);
        }),
        removeEventListener: vi.fn((event: string, cb: any) => {
          if (event === 'change') listeners.delete(cb);
        }),
        dispatchEvent: vi.fn((event: Event) => {
          listeners.forEach((cb) => cb(event as MediaQueryListEvent));
          return true;
        }),
      };
    }),
  });

  return {
    setMatches(query: string, matches: boolean) {
      queryState[query] = matches;
    },
    dispatchChange(query: string, matches: boolean) {
      queryState[query] = matches;
      const listeners = listenersMap.get(query);
      if (listeners) {
        const event = { matches, media: query } as MediaQueryListEvent;
        listeners.forEach((cb) => cb(event));
      }
    },
    reset() {
      Object.keys(queryState).forEach((k) => delete queryState[k]);
      listenersMap.clear();
    },
  };
}

/**
 * Mock localStorage helper with clean memory backing.
 */
export function setupLocalStorageMock() {
  let store: Record<string, string> = {};

  const mock = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };

  Object.defineProperty(window, 'localStorage', {
    value: mock,
    writable: true,
    configurable: true,
  });

  return {
    mock,
    clearStore: () => {
      store = {};
      mock.getItem.mockClear();
      mock.setItem.mockClear();
    },
    getStore: () => store,
  };
}
