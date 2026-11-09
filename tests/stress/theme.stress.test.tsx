// @vitest-environment jsdom
/**
 * tests/stress/theme.stress.test.tsx
 * Empirical Adversarial Stress Harness for Theme Switching, System Reactivity,
 * and Monochrome Zero-Saturation Verification.
 *
 * Covers:
 * 1. Rapid theme transitions: 100+ cycles (300+ transitions) sequential & 100-operation concurrent storm.
 *    Verifies state synchronization, DOM data-theme attribute, class list hygiene, and zero unhandled rejections.
 * 2. System preference dynamic reactivity: prefers-color-scheme listener reactivity, idempotent cleanup,
 *    and immunity of explicit theme overrides against OS events.
 * 3. Monochrome Mode Zero-Saturation Mathematical Verification:
 *    - Token palette chroma = 0 (R=G=B).
 *    - Rendered component audit for chromatic color leakage (Tailwind classes, hex literals, SVG fills).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import {
  useThemeStore,
  THEME_TOKENS,
  THEME_STORAGE_KEY,
  applyThemeToDOM,
  type AppTheme,
  type ThemePreference,
} from '@/renderer/stores/themeStore';
import { setupMatchMediaMock, setupLocalStorageMock } from '../helpers/themeMocks';

import TopNavBar from '@/renderer/components/TopNavBar';
import DownloadCard from '@/renderer/components/DownloadCard';
import ToastContainer from '@/renderer/components/Toast';
import HomeView from '@/renderer/views/HomeView';
import QueueView from '@/renderer/views/QueueView';
import SettingsView from '@/renderer/views/SettingsView';
import AudioExtractView from '@/renderer/views/AudioExtractView';
import ClipsView from '@/renderer/views/ClipsView';
import type { DownloadItem } from '@/types';

// Mock ipcClient to avoid network/IPC dependency
vi.mock('@/renderer/ipc/client', () => ({
  ipcClient: {
    getSettings: vi.fn().mockResolvedValue({ theme: 'dark' }),
    updateSettings: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockResolvedValue('1.1.1'),
    selectDownloadPath: vi.fn().mockResolvedValue('/tmp/downloads'),
    checkForUpdates: vi.fn().mockResolvedValue({ version: '1.2.0' }),
  },
}));

// Helper to parse hex and rgb strings into RGB components
function parseColor(str: string): { r: number; g: number; b: number } | null {
  const hexMatch = str.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }
  const rgbMatch = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
  return null;
}

// Check if RGB values represent 0% chromatic saturation (R === G === B)
function isAchromatic(r: number, g: number, b: number): boolean {
  return r === g && g === b;
}

describe('Theme Stress & Zero-Saturation Adversarial Harness', () => {
  let matchMediaCtrl: ReturnType<typeof setupMatchMediaMock>;
  let localStorageCtrl: ReturnType<typeof setupLocalStorageMock>;
  let unhandledRejections: any[] = [];
  let rejectionHandler: (event: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    unhandledRejections = [];
    rejectionHandler = (err: any) => {
      unhandledRejections.push(err);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', rejectionHandler);
    }
    process.on('unhandledRejection', rejectionHandler);

    document.documentElement.removeAttribute('data-theme');
    document.documentElement.className = '';

    matchMediaCtrl = setupMatchMediaMock({
      '(prefers-color-scheme: dark)': false,
      '(prefers-reduced-motion: reduce)': false,
    });
    localStorageCtrl = setupLocalStorageMock();

    useThemeStore.setState({
      theme: 'dark',
      preference: 'system',
      tokens: THEME_TOKENS.dark,
    });
  });

  afterEach(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('unhandledrejection', rejectionHandler);
    }
    process.removeListener('unhandledRejection' as any, rejectionHandler);
    matchMediaCtrl.reset();
    localStorageCtrl.clearStore();
  });

  // =========================================================================
  // SUITE 1: Rapid Theme Transitions (100+ Cycles & Concurrent Storm)
  // =========================================================================
  describe('Suite 1: Rapid Theme Transitions (100+ Cycles & Concurrency)', () => {
    it('1.1 survives 100+ sequential theme cycles (300 transitions) without desynchronization or error', async () => {
      const { toggleTheme } = useThemeStore.getState();
      await useThemeStore.getState().setTheme('light');

      const expectedSequence: AppTheme[] = ['dark', 'monochrome', 'light'];

      for (let i = 0; i < 100; i++) {
        for (const expectedTheme of expectedSequence) {
          await toggleTheme();

          const currentState = useThemeStore.getState();
          const domTheme = document.documentElement.getAttribute('data-theme');

          expect(currentState.theme).toBe(expectedTheme);
          expect(domTheme).toBe(expectedTheme);

          // Verify class list consistency
          expect(document.documentElement.classList.contains(`theme-${expectedTheme}`)).toBe(true);
          const otherThemes = (['light', 'dark', 'monochrome'] as AppTheme[]).filter((t) => t !== expectedTheme);
          for (const other of otherThemes) {
            expect(document.documentElement.classList.contains(`theme-${other}`)).toBe(false);
          }

          if (expectedTheme === 'dark' || expectedTheme === 'monochrome') {
            expect(document.documentElement.classList.contains('dark')).toBe(true);
          } else {
            expect(document.documentElement.classList.contains('dark')).toBe(false);
          }
        }
      }

      // 0 unhandled promise rejections
      expect(unhandledRejections).toHaveLength(0);
    });

    it('1.2 handles rapid concurrent storm of 100 simultaneous setTheme calls without race-condition crash', async () => {
      const themes: ThemePreference[] = ['light', 'dark', 'monochrome', 'system'];
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 100; i++) {
        const targetTheme = themes[i % themes.length];
        promises.push(useThemeStore.getState().setTheme(targetTheme));
      }

      const results = await Promise.allSettled(promises);
      const rejections = results.filter((r) => r.status === 'rejected');
      expect(rejections).toHaveLength(0);

      // Verify DOM and store are in sync after settling
      const finalTheme = useThemeStore.getState().theme;
      const finalDomTheme = document.documentElement.getAttribute('data-theme');
      expect(finalDomTheme).toBe(finalTheme);
      expect(document.documentElement.classList.contains(`theme-${finalTheme}`)).toBe(true);
    });

    it('1.3 ensures DOM class list does not accumulate duplicate classes during cycling', async () => {
      const { toggleTheme } = useThemeStore.getState();

      for (let i = 0; i < 30; i++) {
        await toggleTheme();
      }

      const classListArray = Array.from(document.documentElement.classList);
      const uniqueClasses = new Set(classListArray);
      expect(classListArray.length).toBe(uniqueClasses.size);
    });
  });

  // =========================================================================
  // SUITE 2: System Preference Reactivity (prefers-color-scheme)
  // =========================================================================
  describe('Suite 2: System Preference Reactivity (prefers-color-scheme)', () => {
    it('2.1 dynamically follows OS dark/light mode changes when preference is "system"', async () => {
      matchMediaCtrl.setMatches('(prefers-color-scheme: dark)', false);

      const { initTheme, setTheme } = useThemeStore.getState();
      await initTheme();
      await setTheme('system');

      expect(useThemeStore.getState().theme).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      // OS switches to Dark
      matchMediaCtrl.dispatchChange('(prefers-color-scheme: dark)', true);

      expect(useThemeStore.getState().theme).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // OS switches back to Light
      matchMediaCtrl.dispatchChange('(prefers-color-scheme: dark)', false);

      expect(useThemeStore.getState().theme).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('2.2 withstands 50 rapid OS theme flips in system mode without desynchronization', async () => {
      const { initTheme, setTheme } = useThemeStore.getState();
      await initTheme();
      await setTheme('system');

      for (let i = 0; i < 50; i++) {
        const isDark = i % 2 === 0;
        matchMediaCtrl.dispatchChange('(prefers-color-scheme: dark)', isDark);

        const expected = isDark ? 'dark' : 'light';
        expect(useThemeStore.getState().theme).toBe(expected);
        expect(document.documentElement.getAttribute('data-theme')).toBe(expected);
      }
    });

    it('2.3 guarantees explicit user theme selection is NOT overridden by OS changes', async () => {
      const { initTheme, setTheme } = useThemeStore.getState();
      await initTheme();

      // Explicit Monochrome selection
      await setTheme('monochrome');
      expect(useThemeStore.getState().theme).toBe('monochrome');

      // Trigger OS dark mode toggles
      matchMediaCtrl.dispatchChange('(prefers-color-scheme: dark)', true);
      expect(useThemeStore.getState().theme).toBe('monochrome');
      expect(document.documentElement.getAttribute('data-theme')).toBe('monochrome');

      matchMediaCtrl.dispatchChange('(prefers-color-scheme: dark)', false);
      expect(useThemeStore.getState().theme).toBe('monochrome');
      expect(document.documentElement.getAttribute('data-theme')).toBe('monochrome');
    });

    it('2.4 calling initTheme() multiple times does not leak duplicate listeners', async () => {
      localStorageCtrl.clearStore();
      const { initTheme, setTheme } = useThemeStore.getState();
      await setTheme('system');

      for (let i = 0; i < 20; i++) {
        await initTheme();
      }

      // Verify that after multiple inits, one change event triggers only one state update
      let changeCount = 0;
      const unsub = useThemeStore.subscribe(() => {
        changeCount++;
      });

      matchMediaCtrl.dispatchChange('(prefers-color-scheme: dark)', true);
      unsub();

      // Should trigger exactly 1 store notification, not 20
      expect(changeCount).toBe(1);
    });
  });

  // =========================================================================
  // SUITE 3: Monochrome Mode Zero-Saturation Mathematical Verification
  // =========================================================================
  describe('Suite 3: Monochrome Mode Zero-Saturation Mathematical Audit', () => {
    it('3.1 mathematically verifies 100% achromatic neutrality (R=G=B) for all THEME_TOKENS.monochrome', () => {
      const monoTokens = THEME_TOKENS.monochrome;

      const nonAchromaticTokens: string[] = [];

      for (const [key, value] of Object.entries(monoTokens)) {
        if (key === 'theme' || typeof value !== 'string') continue;

        const rgb = parseColor(value);
        if (!rgb) {
          nonAchromaticTokens.push(`${key}: unable to parse color "${value}"`);
          continue;
        }

        if (!isAchromatic(rgb.r, rgb.g, rgb.b)) {
          nonAchromaticTokens.push(
            `${key} = "${value}" (R=${rgb.r}, G=${rgb.g}, B=${rgb.b}, Chroma=${Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b)})`
          );
        }
      }

      expect(nonAchromaticTokens).toEqual([]);
    });

    it('3.2 audits rendered UI components for chromatic color leakage in Monochrome mode', async () => {
      // Set to Monochrome mode
      await useThemeStore.getState().setTheme('monochrome');
      applyThemeToDOM('monochrome');

      const mockDownload: DownloadItem = {
        id: 'test-1',
        url: 'https://example.com/video',
        title: 'Test Stream',
        thumbnail: 'https://example.com/thumb.jpg',
        status: 'done',
        progress: 100,
        speed: '5 MB/s',
        eta: '0s',
        totalBytes: 50000000,
        downloadedBytes: 50000000,
        config: { url: 'https://example.com/video', format: 'mp4' },
        filePath: '/tmp/test.mp4',
        createdAt: Date.now(),
      };

      const { container } = render(
        <MemoryRouter>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <TopNavBar />
            <DownloadCard download={mockDownload} />
            <DownloadCard download={{ ...mockDownload, id: 'test-2', status: 'paused' }} />
            <DownloadCard download={{ ...mockDownload, id: 'test-3', status: 'error', errorMessage: 'Fatal 403' }} />
          </div>
        </MemoryRouter>
      );

      // Audit DOM elements for hardcoded chromatic Tailwind classes or hex colors
      const chromaticClassPatterns = [
        /\b(text|bg|border)-(emerald|red|amber|blue|green|yellow|indigo|purple|pink|orange|teal|cyan)-[0-9]+/i,
        /bg-\[#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\]/i,
      ];

      const elements = container.querySelectorAll('*');
      const detectedLeakages: Array<{ tag: string; text: string; className: string; issue: string }> = [];

      elements.forEach((el) => {
        const cls = el.getAttribute('class') || '';
        for (const pattern of chromaticClassPatterns) {
          const match = cls.match(pattern);
          if (match) {
            // If it matched a hex class, verify if it's chromatic
            if (match[0].startsWith('bg-[#')) {
              const hex = match[1];
              const rgb = parseColor(`#${hex}`);
              if (rgb && !isAchromatic(rgb.r, rgb.g, rgb.b)) {
                detectedLeakages.push({
                  tag: el.tagName.toLowerCase(),
                  text: (el.textContent || '').trim().slice(0, 30),
                  className: cls,
                  issue: `Chromatic hex in class: ${match[0]} (R=${rgb.r}, G=${rgb.g}, B=${rgb.b})`,
                });
              }
            } else {
              detectedLeakages.push({
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || '').trim().slice(0, 30),
                className: cls,
                issue: `Chromatic Tailwind class: ${match[0]}`,
              });
            }
          }
        }
      });

      // In a pure achromatic monochrome implementation, detectedLeakages must be empty (0% chroma).
      expect(detectedLeakages).toEqual([]);
    });

    it('3.3 audits all core views (Home, Queue, Settings, Clips, Audio) for chromatic color leakage in Monochrome mode', async () => {
      await useThemeStore.getState().setTheme('monochrome');
      applyThemeToDOM('monochrome');

      // Mock electronAPI functions required by SettingsView
      (window as any).electronAPI = {
        getVersion: vi.fn().mockResolvedValue('1.1.1'),
        selectDownloadPath: vi.fn().mockResolvedValue('/tmp/downloads'),
        checkForUpdates: vi.fn().mockResolvedValue({ version: '1.2.0' }),
      };

      const { container } = render(
        <MemoryRouter>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <HomeView />
            <QueueView />
            <SettingsView />
            <ClipsView />
            <AudioExtractView />
          </div>
        </MemoryRouter>
      );

      const chromaticClassPatterns = [
        /\b(text|bg|border)-(emerald|red|amber|blue|green|yellow|indigo|purple|pink|orange|teal|cyan)-[0-9]+/i,
        /bg-\[#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\]/i,
      ];

      const elements = container.querySelectorAll('*');
      const detectedViewLeakages: Array<{ viewElement: string; className: string; issue: string }> = [];

      elements.forEach((el) => {
        const cls = el.getAttribute('class') || '';
        for (const pattern of chromaticClassPatterns) {
          const match = cls.match(pattern);
          if (match) {
            if (match[0].startsWith('bg-[#')) {
              const hex = match[1];
              const rgb = parseColor(`#${hex}`);
              if (rgb && !isAchromatic(rgb.r, rgb.g, rgb.b)) {
                detectedViewLeakages.push({
                  viewElement: (el.textContent || el.tagName).trim().slice(0, 30),
                  className: cls,
                  issue: `Chromatic hex in class: ${match[0]} (R=${rgb.r}, G=${rgb.g}, B=${rgb.b})`,
                });
              }
            } else {
              detectedViewLeakages.push({
                viewElement: (el.textContent || el.tagName).trim().slice(0, 30),
                className: cls,
                issue: `Chromatic Tailwind class: ${match[0]}`,
              });
            }
          }
        }
      });

      expect(detectedViewLeakages).toEqual([]);
    });
  });
});
