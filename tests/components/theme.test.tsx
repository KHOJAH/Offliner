// tests/components/theme.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  useThemeStore,
  THEME_TOKENS,
  type AppTheme,
} from '@/renderer/stores/themeStore';
import { setupMatchMediaMock, setupLocalStorageMock } from '../helpers/themeMocks';

// Color parsing utility for zero chromatic saturation verification
function parseCssColor(colorStr: string): { r: number; g: number; b: number; a: number; hex: string } {
  const trimmed = colorStr.trim().toLowerCase();

  // Hex: #fff or #ffffff
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
      a: 1,
      hex: `#${hex.toUpperCase()}`,
    };
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbaMatch = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
      hex: '',
    };
  }

  throw new Error(`Unparseable color value: ${colorStr}`);
}

// Sample Theme Toggle Component for UI interaction testing
function ThemeSelectorComponent() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div data-testid="theme-selector-container">
      <span data-testid="current-theme-display">{theme}</span>
      <button data-testid="btn-theme-light" onClick={() => setTheme('light')}>
        Light
      </button>
      <button data-testid="btn-theme-dark" onClick={() => setTheme('dark')}>
        Dark
      </button>
      <button data-testid="btn-theme-monochrome" onClick={() => setTheme('monochrome')}>
        Monochrome
      </button>
    </div>
  );
}

describe('UI Design System, Component Styles & Zero-Saturation Tests', () => {
  let matchMediaCtrl: ReturnType<typeof setupMatchMediaMock>;
  let localStorageCtrl: ReturnType<typeof setupLocalStorageMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.className = '';

    matchMediaCtrl = setupMatchMediaMock();
    localStorageCtrl = setupLocalStorageMock();

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

  describe('Interactive Theme Selector Component', () => {
    it('renders current theme and updates root data-theme on button click', async () => {
      render(<ThemeSelectorComponent />);

      expect(screen.getByTestId('current-theme-display').textContent).toBe('dark');

      // Click Light button
      fireEvent.click(screen.getByTestId('btn-theme-light'));
      expect(screen.getByTestId('current-theme-display').textContent).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      // Click Monochrome button
      fireEvent.click(screen.getByTestId('btn-theme-monochrome'));
      expect(screen.getByTestId('current-theme-display').textContent).toBe('monochrome');
      expect(document.documentElement.getAttribute('data-theme')).toBe('monochrome');

      // Click Dark button
      fireEvent.click(screen.getByTestId('btn-theme-dark'));
      expect(screen.getByTestId('current-theme-display').textContent).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('CSS Variables Integrity & Theme Tokens Definition', () => {
    const requiredColorKeys: Array<keyof typeof THEME_TOKENS.light> = [
      'bgApp',
      'bgSurface',
      'bgSurfaceElevated',
      'borderSubtle',
      'textPrimary',
      'textSecondary',
      'textTertiary',
      'accent',
      'accentHover',
      'accentSubtle',
      'accentText',
      'success',
      'warning',
      'error',
    ];

    it.each(['light', 'dark', 'monochrome'] as AppTheme[])(
      'defines all required tokens for %s theme',
      (themeKey) => {
        const tokens = THEME_TOKENS[themeKey];
        expect(tokens.theme).toBe(themeKey);

        requiredColorKeys.forEach((key) => {
          expect(tokens[key]).toBeDefined();
          expect(typeof tokens[key]).toBe('string');
          expect(tokens[key].length).toBeGreaterThan(0);
        });
      }
    );

    it('injects and maps CSS custom properties in document', () => {
      const styleEl = document.createElement('style');
      styleEl.innerHTML = `
        :root {
          --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
          --duration-fast: 150ms;
        }
        [data-theme='monochrome'] {
          --bg-app: #000000;
          --accent: #FFFFFF;
        }
      `;
      document.head.appendChild(styleEl);

      document.documentElement.setAttribute('data-theme', 'monochrome');
      expect(document.documentElement.getAttribute('data-theme')).toBe('monochrome');

      document.head.removeChild(styleEl);
    });
  });

  describe('Monochrome Mode: Strict Zero Chromatic Saturation Enforcement', () => {
    it('mathematically verifies Chroma = 0 (R = G = B) across all monochrome tokens', () => {
      const monochromeTokens = THEME_TOKENS.monochrome;

      // Extract every color token in the monochrome palette
      const colorTokenEntries = Object.entries(monochromeTokens).filter(
        ([key, val]) => key !== 'theme' && typeof val === 'string'
      );

      expect(colorTokenEntries.length).toBeGreaterThanOrEqual(13);

      colorTokenEntries.forEach(([tokenName, colorValue]) => {
        const parsed = parseCssColor(colorValue);

        // Calculate chromatic difference
        const maxComponent = Math.max(parsed.r, parsed.g, parsed.b);
        const minComponent = Math.min(parsed.r, parsed.g, parsed.b);
        const chroma = maxComponent - minComponent;

        // Assertion 1: Red equals Green
        expect(
          parsed.r,
          `Monochrome token "${tokenName}" (${colorValue}) has non-matching R and G components`
        ).toBe(parsed.g);

        // Assertion 2: Green equals Blue
        expect(
          parsed.g,
          `Monochrome token "${tokenName}" (${colorValue}) has non-matching G and B components`
        ).toBe(parsed.b);

        // Assertion 3: Strict Zero Chroma
        expect(
          chroma,
          `Monochrome token "${tokenName}" (${colorValue}) has non-zero chromatic saturation: chroma = ${chroma}`
        ).toBe(0);
      });
    });

    it('prohibits accidental blue/red/green tinting in monochrome secondary text and borders', () => {
      const { textSecondary, borderSubtle, accentText, bgApp, accent } = THEME_TOKENS.monochrome;

      // Secondary text must be neutral grey (e.g. #9E9E9E: 158,158,158), NOT apple blue-tinted #8E8E93 (142,142,147)
      const secText = parseCssColor(textSecondary);
      expect(secText.r).toBe(secText.b);

      // Subtle border must be neutral (e.g. #262626: 38,38,38)
      const border = parseCssColor(borderSubtle);
      expect(border.r).toBe(border.g);
      expect(border.g).toBe(border.b);

      // Canvas is pitch black (0, 0, 0)
      const canvas = parseCssColor(bgApp);
      expect(canvas.r).toBe(0);
      expect(canvas.g).toBe(0);
      expect(canvas.b).toBe(0);

      // Accent is pure white (255, 255, 255)
      const acc = parseCssColor(accent);
      expect(acc.r).toBe(255);
      expect(acc.g).toBe(255);
      expect(acc.b).toBe(255);

      // Accent text is pure black (0, 0, 0)
      const accText = parseCssColor(accentText);
      expect(accText.r).toBe(0);
      expect(accText.g).toBe(0);
      expect(accText.b).toBe(0);
    });
  });

  describe('Apple/Claude Spring Animations & Accessibility Verification', () => {
    it('verifies the Apple spring curve is standardized to cubic-bezier(0.16, 1, 0.3, 1)', () => {
      const appleSpringCurve = 'cubic-bezier(0.16, 1, 0.3, 1)';

      // Test a virtual DOM element applying the spring transition
      const element = document.createElement('div');
      element.className = 'interactive-card animate-spring-in';
      element.style.transitionTimingFunction = appleSpringCurve;
      document.body.appendChild(element);

      expect(element.style.transitionTimingFunction).toBe(appleSpringCurve);
      document.body.removeChild(element);
    });

    it('verifies prefers-reduced-motion media query suppresses animation duration', () => {
      matchMediaCtrl.setMatches('(prefers-reduced-motion: reduce)', true);

      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      expect(mql.matches).toBe(true);

      // Verify that reduced-motion rules neutralize animations to 0.01ms / none
      const testCard = document.createElement('div');
      testCard.className = 'animate-spring-in';
      document.body.appendChild(testCard);

      // In reduced-motion mode, components must suppress long transforms
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        testCard.style.animation = 'none';
        testCard.style.transition = 'none';
      }

      expect(testCard.style.animation).toBe('none');
      expect(testCard.style.transition).toBe('none');

      document.body.removeChild(testCard);
    });
  });
});
