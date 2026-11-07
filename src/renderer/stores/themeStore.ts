// src/renderer/stores/themeStore.ts
import { create } from 'zustand';
import type { AppTheme } from '@/types';
import { ipcClient } from '@/renderer/ipc/client';

export type { AppTheme };
export type ThemePreference = AppTheme | 'system';

export interface ThemeTokens {
  theme: AppTheme;
  bgApp: string;
  bgSurface: string;
  bgSurfaceElevated: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentHover: string;
  accentSubtle: string;
  accentText: string;
  success: string;
  warning: string;
  error: string;
}

export const THEME_TOKENS: Record<AppTheme, ThemeTokens> = {
  light: {
    theme: 'light',
    bgApp: '#FAFAF8',
    bgSurface: '#FFFFFF',
    bgSurfaceElevated: '#F5F5F7',
    borderSubtle: 'rgba(0, 0, 0, 0.08)',
    textPrimary: '#1D1D1F',
    textSecondary: '#6E6E73',
    textTertiary: '#86868B',
    accent: '#0071E3',
    accentHover: '#0077ED',
    accentSubtle: 'rgba(0, 113, 227, 0.10)',
    accentText: '#FFFFFF',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
  },
  dark: {
    theme: 'dark',
    bgApp: '#0D0E11',
    bgSurface: '#17181C',
    bgSurfaceElevated: '#222328',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    textPrimary: '#F5F5F7',
    textSecondary: '#86868B',
    textTertiary: '#636366',
    accent: '#2997FF',
    accentHover: '#40A2FF',
    accentSubtle: 'rgba(41, 151, 255, 0.15)',
    accentText: '#FFFFFF',
    success: '#30D158',
    warning: '#FF9F0A',
    error: '#FF453A',
  },
  monochrome: {
    theme: 'monochrome',
    bgApp: '#000000',
    bgSurface: '#121212',
    bgSurfaceElevated: '#1E1E1E',
    borderSubtle: '#262626',
    textPrimary: '#FFFFFF',
    textSecondary: '#9E9E9E',
    textTertiary: '#666666',
    accent: '#FFFFFF',
    accentHover: '#E0E0E0',
    accentSubtle: 'rgba(255, 255, 255, 0.12)',
    accentText: '#000000',
    success: '#FFFFFF',
    warning: '#CCCCCC',
    error: '#FFFFFF',
  },
};

export const THEME_STORAGE_KEY = 'offliner_theme';

export function getSystemTheme(): AppTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

export function applyThemeToDOM(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.remove('theme-light', 'theme-dark', 'theme-monochrome');
  root.classList.add(`theme-${theme}`);
  if (theme === 'dark' || theme === 'monochrome') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export interface ThemeState {
  theme: AppTheme;
  preference: ThemePreference;
  tokens: ThemeTokens;
  setTheme: (pref: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
  initTheme: () => Promise<void>;
}

let activeMq: MediaQueryList | null = null;
let activeMqListener: ((e: MediaQueryListEvent) => void) | null = null;

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  preference: 'system',
  tokens: THEME_TOKENS.dark,

  setTheme: async (pref: ThemePreference) => {
    const resolvedTheme: AppTheme = pref === 'system' ? getSystemTheme() : pref;

    // 1. Immediately apply to DOM
    applyThemeToDOM(resolvedTheme);

    // 2. Persist to localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, pref);
      } catch {
        // Ignore storage errors in restricted contexts
      }
    }

    // 3. Update Zustand state
    set({
      preference: pref,
      theme: resolvedTheme,
      tokens: THEME_TOKENS[resolvedTheme],
    });

    // 4. Synchronize with IPC backend settings
    try {
      if (ipcClient?.updateSettings) {
        await ipcClient.updateSettings({ theme: resolvedTheme });
      }
    } catch {
      // Ignore headless or IPC unavailable in tests
    }
  },

  toggleTheme: async () => {
    const current = get().theme;
    const cycle: Record<AppTheme, AppTheme> = {
      light: 'dark',
      dark: 'monochrome',
      monochrome: 'light',
    };
    await get().setTheme(cycle[current]);
  },

  initTheme: async () => {
    let savedPref: ThemePreference | null = null;

    // 1. Check localStorage first
    if (typeof localStorage !== 'undefined') {
      try {
        const item = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
        if (item && ['light', 'dark', 'monochrome', 'system'].includes(item)) {
          savedPref = item;
        }
      } catch {
        // Ignore
      }
    }

    // 2. Check IPC settings fallback
    if (!savedPref && ipcClient?.getSettings) {
      try {
        const settings = await ipcClient.getSettings();
        if (settings?.theme && ['light', 'dark', 'monochrome'].includes(settings.theme)) {
          savedPref = settings.theme as AppTheme;
        }
      } catch {
        // Ignore
      }
    }

    const pref: ThemePreference = savedPref || 'system';
    const resolvedTheme: AppTheme = pref === 'system' ? getSystemTheme() : pref;

    applyThemeToDOM(resolvedTheme);

    set({
      preference: pref,
      theme: resolvedTheme,
      tokens: THEME_TOKENS[resolvedTheme],
    });

    // 3. Clean up any existing media query listener before registering
    if (activeMq && activeMqListener) {
      try {
        if (activeMq.removeEventListener) {
          activeMq.removeEventListener('change', activeMqListener);
        } else if ((activeMq as any).removeListener) {
          (activeMq as any).removeListener(activeMqListener);
        }
      } catch {
        // Ignore
      }
      activeMq = null;
      activeMqListener = null;
    }

    // 4. Register system media query listener
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const listener = (e: MediaQueryListEvent) => {
          if (get().preference === 'system') {
            const nextTheme: AppTheme = e.matches ? 'dark' : 'light';
            applyThemeToDOM(nextTheme);
            set({
              theme: nextTheme,
              tokens: THEME_TOKENS[nextTheme],
            });
          }
        };
        if (mq.addEventListener) {
          mq.addEventListener('change', listener);
        } else if ((mq as any).addListener) {
          (mq as any).addListener(listener);
        }
        activeMq = mq;
        activeMqListener = listener;
      } catch {
        // Ignore
      }
    }
  },
}));
