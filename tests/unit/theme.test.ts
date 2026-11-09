// tests/unit/theme.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useThemeStore,
  THEME_TOKENS,
  THEME_STORAGE_KEY,
  applyThemeToDOM,
  getSystemTheme,
  type AppTheme,
} from '@/renderer/stores/themeStore';
import { setupMatchMediaMock, setupLocalStorageMock } from '../helpers/themeMocks';

// Mock ipcClient to verify settings synchronization
vi.mock('@/renderer/ipc/client', () => ({
  ipcClient: {
    getSettings: vi.fn().mockResolvedValue({ theme: 'dark' }),
    updateSettings: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Theme Engine & Store Unit Tests', () => {
  let matchMediaCtrl: ReturnType<typeof setupMatchMediaMock>;
  let localStorageCtrl: ReturnType<typeof setupLocalStorageMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.className = '';

    matchMediaCtrl = setupMatchMediaMock({
      '(prefers-color-scheme: dark)': false,
      '(prefers-reduced-motion: reduce)': false,
    });
    localStorageCtrl = setupLocalStorageMock();

    // Reset store state
    useThemeStore.setState({
      theme: 'dark',
      preference: 'system',
      tokens: THEME_TOKENS.dark,
    });
  });

  afterEach(() => {
    matchMediaCtrl.reset();
    localStorageCtrl.clearStore();
  });

  describe('DOM Attribute & Class Synchronization', () => {
    it('synchronizes data-theme="light" and classes to root element', () => {
      applyThemeToDOM('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.classList.contains('theme-light')).toBe(true);
      expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
      expect(document.documentElement.classList.contains('theme-monochrome')).toBe(false);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('synchronizes data-theme="dark" and classes to root element', () => {
      applyThemeToDOM('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
      expect(document.documentElement.classList.contains('theme-light')).toBe(false);
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('synchronizes data-theme="monochrome" and classes to root element', () => {
      applyThemeToDOM('monochrome');
      expect(document.documentElement.getAttribute('data-theme')).toBe('monochrome');
      expect(document.documentElement.classList.contains('theme-monochrome')).toBe(true);
      expect(document.documentElement.classList.contains('theme-light')).toBe(false);
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('State Transitions & Token Updates', () => {
    it('transitions to light mode and updates tokens', async () => {
      const { setTheme } = useThemeStore.getState();
      await setTheme('light');

      const state = useThemeStore.getState();
      expect(state.theme).toBe('light');
      expect(state.preference).toBe('light');
      expect(state.tokens).toEqual(THEME_TOKENS.light);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('transitions to dark mode and updates tokens', async () => {
      const { setTheme } = useThemeStore.getState();
      await setTheme('dark');

      const state = useThemeStore.getState();
      expect(state.theme).toBe('dark');
      expect(state.preference).toBe('dark');
      expect(state.tokens).toEqual(THEME_TOKENS.dark);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('transitions to monochrome mode and updates tokens', async () => {
      const { setTheme } = useThemeStore.getState();
      await setTheme('monochrome');

      const state = useThemeStore.getState();
      expect(state.theme).toBe('monochrome');
      expect(state.preference).toBe('monochrome');
      expect(state.tokens).toEqual(THEME_TOKENS.monochrome);
      expect(document.documentElement.getAttribute('data-theme')).toBe('monochrome');
    });

    it('cycles sequentially through light -> dark -> monochrome -> light', async () => {
      const { setTheme, toggleTheme } = useThemeStore.getState();

      await setTheme('light');
      expect(useThemeStore.getState().theme).toBe('light');

      await toggleTheme();
      expect(useThemeStore.getState().theme).toBe('dark');

      await toggleTheme();
      expect(useThemeStore.getState().theme).toBe('monochrome');

      await toggleTheme();
      expect(useThemeStore.getState().theme).toBe('light');
    });
  });

  describe('LocalStorage Persistence', () => {
    it('persists theme selection to localStorage on setTheme', async () => {
      const { setTheme } = useThemeStore.getState();
      await setTheme('monochrome');

      expect(localStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'monochrome');
      expect(localStorageCtrl.getStore()[THEME_STORAGE_KEY]).toBe('monochrome');
    });

    it('initializes from saved localStorage preference', async () => {
      localStorageCtrl.getStore()[THEME_STORAGE_KEY] = 'monochrome';

      const { initTheme } = useThemeStore.getState();
      await initTheme();

      expect(useThemeStore.getState().theme).toBe('monochrome');
      expect(useThemeStore.getState().preference).toBe('monochrome');
      expect(document.documentElement.getAttribute('data-theme')).toBe('monochrome');
    });

    it('safely falls back to system preference if localStorage has corrupted/unknown value', async () => {
      localStorageCtrl.getStore()[THEME_STORAGE_KEY] = 'neon-pink-invalid';
      matchMediaCtrl.setMatches('(prefers-color-scheme: dark)', true);

      const { initTheme } = useThemeStore.getState();
      await initTheme();

      expect(useThemeStore.getState().theme).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('System Preference & MatchMedia Fallback', () => {
    it('resolves getSystemTheme() to "dark" when prefers-color-scheme: dark matches', () => {
      matchMediaCtrl.setMatches('(prefers-color-scheme: dark)', true);
      expect(getSystemTheme()).toBe('dark');
    });

    it('resolves getSystemTheme() to "light" when prefers-color-scheme: dark is false', () => {
      matchMediaCtrl.setMatches('(prefers-color-scheme: dark)', false);
      expect(getSystemTheme()).toBe('light');
    });

    it('reacts dynamically to OS system theme changes when preference is "system"', async () => {
      matchMediaCtrl.setMatches('(prefers-color-scheme: dark)', false);

      const { setTheme, initTheme } = useThemeStore.getState();
      await initTheme();
      await setTheme('system');
      expect(useThemeStore.getState().theme).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      // Simulate user toggling OS Dark Mode in system preferences
      matchMediaCtrl.dispatchChange('(prefers-color-scheme: dark)', true);

      expect(useThemeStore.getState().theme).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('does not override explicit user theme selection when OS changes theme', async () => {
      const { setTheme, initTheme } = useThemeStore.getState();
      await initTheme();
      await setTheme('monochrome'); // Explicit choice

      // Trigger OS dark mode change
      matchMediaCtrl.dispatchChange('(prefers-color-scheme: dark)', false);

      // Must remain monochrome
      expect(useThemeStore.getState().theme).toBe('monochrome');
      expect(document.documentElement.getAttribute('data-theme')).toBe('monochrome');
    });
  });
});
