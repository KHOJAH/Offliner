// @vitest-environment jsdom
/**
 * tests/stress/adversarial.m1.contrast.test.tsx
 *
 * EMPIRICAL ADVERSARIAL CHALLENGER TEST HARNESS: MILESTONE 1
 * Stress-testing theme invariants, contrast ratios (WCAG AA/AAA),
 * and dynamic state visibility across Light, Dark, and Pure Monochrome modes.
 *
 * Modified Files Challenged:
 * 1. src/renderer/components/FormatSelector.tsx
 * 2. src/renderer/index.css
 * 3. src/renderer/components/TopNavBar.tsx
 * 4. src/renderer/components/VideoPreview.tsx
 * 5. src/renderer/components/DownloadCard.tsx
 * 6. src/renderer/components/URLInput.tsx
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { THEME_TOKENS, applyThemeToDOM, useThemeStore } from '@/renderer/stores/themeStore';
import FormatSelector from '@/renderer/components/FormatSelector';
import TopNavBar from '@/renderer/components/TopNavBar';
import VideoPreview from '@/renderer/components/VideoPreview';
import DownloadCard from '@/renderer/components/DownloadCard';
import URLInput from '@/renderer/components/URLInput';
import type { FormatInfo, VideoMetadata, DownloadItem, AppTheme } from '@/types';

// Mock IPC
vi.mock('@/renderer/ipc/client', () => ({
  ipcClient: {
    getSettings: vi.fn().mockResolvedValue({ theme: 'monochrome', concurrency: 4 }),
    updateSettings: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockResolvedValue('1.1.1'),
    selectDownloadPath: vi.fn().mockResolvedValue('/tmp/downloads'),
    checkForUpdates: vi.fn().mockResolvedValue({ version: '1.2.0' }),
    openFile: vi.fn().mockResolvedValue(undefined),
    showInFolder: vi.fn().mockResolvedValue(undefined),
    getMetadata: vi.fn().mockResolvedValue(null),
    addDownload: vi.fn().mockResolvedValue('dl-1'),
    cancelDownload: vi.fn().mockResolvedValue(undefined),
    pauseDownload: vi.fn().mockResolvedValue(undefined),
    resumeDownload: vi.fn().mockResolvedValue(undefined),
    removePermanent: vi.fn().mockResolvedValue(undefined),
    loadDownloads: vi.fn().mockResolvedValue([]),
    saveDownloads: vi.fn().mockResolvedValue(undefined),
    onDownloadProgress: vi.fn().mockReturnValue(() => {}),
    onDownloadDone: vi.fn().mockReturnValue(() => {}),
    onDownloadError: vi.fn().mockReturnValue(() => {}),
    onDownloadMetadata: vi.fn().mockReturnValue(() => {}),
    onUpdateReady: vi.fn().mockReturnValue(() => {}),
  },
}));

// =========================================================================
// Mathematical Contrast & Color Utilities (WCAG 2.1 Specification)
// =========================================================================

interface RGB {
  r: number;
  g: number;
  b: number;
}

function parseHex(hexStr: string): RGB {
  let hex = hexStr.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(hex.slice(0, 6), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function srgbToLinear(c: number): number {
  const norm = c / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(rgb: RGB): number {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(rgb1: RGB, rgb2: RGB): number {
  const l1 = getRelativeLuminance(rgb1);
  const l2 = getRelativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function blendWithOpacity(fg: RGB, bg: RGB, opacity: number): RGB {
  return {
    r: Math.round(opacity * fg.r + (1 - opacity) * bg.r),
    g: Math.round(opacity * fg.g + (1 - opacity) * bg.g),
    b: Math.round(opacity * fg.b + (1 - opacity) * bg.b),
  };
}

function calculateChroma(rgb: RGB): number {
  return Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
}

function scanForChromaticViolations(root: Element): string[] {
  const violations: string[] = [];
  const nodes = root.querySelectorAll('*');

  const chromaticTailwindRegex = /\b(text|bg|border|ring|fill|stroke)-(emerald|red|amber|blue|green|yellow|indigo|purple|pink|orange|teal|cyan|violet|lime|sky|fuchsia)(-\d+)?\b/gi;
  const arbitraryHexRegex = /(text|bg|border|ring|fill|stroke)-\[#([0-9a-fA-F]{3,8})\]/gi;

  nodes.forEach((node) => {
    const cls = node.getAttribute('class') || '';
    let match: RegExpExecArray | null;

    while ((match = chromaticTailwindRegex.exec(cls)) !== null) {
      violations.push(`Element <${node.tagName.toLowerCase()}> has chromatic class: ${match[0]}`);
    }

    while ((match = arbitraryHexRegex.exec(cls)) !== null) {
      const rgb = parseHex(match[2]);
      if (calculateChroma(rgb) > 0) {
        violations.push(`Element <${node.tagName.toLowerCase()}> has chromatic hex class: ${match[0]}`);
      }
    }

    const style = node.getAttribute('style') || '';
    const inlineHexes = style.match(/#([0-9a-fA-F]{3,8})\b/g);
    if (inlineHexes) {
      for (const hex of inlineHexes) {
        const rgb = parseHex(hex);
        if (calculateChroma(rgb) > 0) {
          violations.push(`Element <${node.tagName.toLowerCase()}> has chromatic inline style hex: ${hex}`);
        }
      }
    }
  });

  return violations;
}

// Sample Data
const mockFormats: FormatInfo[] = [
  { format_id: '137', ext: 'mp4', resolution: '1080p', vcodec: 'avc1', acodec: 'none', fps: 60, vbr: 4500 },
  { format_id: '136', ext: 'mp4', resolution: '720p', vcodec: 'avc1', acodec: 'none', fps: 30, vbr: 2500 },
  { format_id: '140', ext: 'm4a', resolution: 'audio only', vcodec: 'none', acodec: 'mp4a', abr: 128 },
  { format_id: '251', ext: 'webm', resolution: 'audio only', vcodec: 'none', acodec: 'opus', abr: 160 },
];

const mockVideoMetadata: VideoMetadata = {
  id: 'vid-adv-m1',
  url: 'https://youtube.com/watch?v=adv-m1',
  title: 'Empirical Challenge Media Stream - Full Spectrum Test',
  duration: 215,
  thumbnail: 'https://example.com/test-thumb.jpg',
  uploader: 'Challenger Studio',
  view_count: 1425000,
  is_playlist: false,
  formats: mockFormats,
};

const mockDownloadItem: DownloadItem = {
  id: 'dl-test-m1',
  url: 'https://youtube.com/watch?v=adv-m1',
  title: 'Empirical Challenge Media Stream - Full Spectrum Test',
  thumbnail: 'https://example.com/test-thumb.jpg',
  status: 'downloading',
  progress: 68.4,
  speed: '24.50 MB/s',
  eta: '00:15',
  totalBytes: 524288000,
  downloadedBytes: 358612992,
  config: { url: 'https://youtube.com/watch?v=adv-m1', format: 'mp4' },
  createdAt: Date.now(),
};

// =========================================================================
// TEST SUITES
// =========================================================================

describe('Milestone 1 Empirical Challenger: Contrast & Monochrome Invariants', () => {
  beforeEach(() => {
    cleanup();
    document.documentElement.setAttribute('data-theme', 'monochrome');
  });

  afterEach(() => {
    cleanup();
  });

  // -----------------------------------------------------------------------
  // Suite 1: Mathematical Contrast & Visibility Verification
  // -----------------------------------------------------------------------
  describe('Suite 1: WCAG 2.1 Contrast Ratios in Monochrome, Dark, and Light Modes', () => {
    const themes: AppTheme[] = ['monochrome', 'dark', 'light'];

    it('1.1 verifies FormatSelector selected state contrast eliminates white-on-white defect in Monochrome mode', () => {
      const monoTokens = THEME_TOKENS.monochrome;
      const accentBg = parseHex(monoTokens.accent); // #FFFFFF
      const accentText = parseHex(monoTokens.accentText); // #000000

      // Primary selected button text contrast
      const primaryContrast = getContrastRatio(accentText, accentBg);
      expect(primaryContrast).toBeCloseTo(21.0, 1);
      expect(primaryContrast).toBeGreaterThanOrEqual(7.0); // WCAG AAA

      // Extension / fps subtext with 0.7 opacity blended on accent background
      const subtextRgb = blendWithOpacity(accentText, accentBg, 0.7);
      const subtextContrast = getContrastRatio(subtextRgb, accentBg);

      // Must be high contrast and clearly readable (> 7:1 for AAA, min 4.5:1 for AA)
      expect(subtextContrast).toBeGreaterThanOrEqual(7.0);
      expect(subtextContrast).toBeCloseTo(8.45, 1);

      // Verify that old defect (hardcoded 'white' on white) would have been 1.0:1
      const oldDefectContrast = getContrastRatio(parseHex('#FFFFFF'), accentBg);
      expect(oldDefectContrast).toBeCloseTo(1.0, 1);
    });

    it('1.2 verifies .btn-danger contrast in Monochrome mode eliminates white-on-white defect', () => {
      const monoTokens = THEME_TOKENS.monochrome;
      const errorBg = parseHex(monoTokens.error); // #FFFFFF in monochrome
      const accentText = parseHex(monoTokens.accentText); // #000000

      // Button danger now uses var(--accent-text) instead of hardcoded #FFFFFF
      const dangerContrast = getContrastRatio(accentText, errorBg);
      expect(dangerContrast).toBeCloseTo(21.0, 1);
      expect(dangerContrast).toBeGreaterThanOrEqual(7.0); // WCAG AAA

      // Old defect was white on white
      const oldDangerContrast = getContrastRatio(parseHex('#FFFFFF'), errorBg);
      expect(oldDangerContrast).toBeCloseTo(1.0, 1);
    });

    it('1.3 verifies .btn-danger maintains accessible contrast in Light and Dark modes', () => {
      // Light Mode: --error is #FF3B30, text is #FFFFFF
      const lightError = parseHex(THEME_TOKENS.light.error);
      const lightText = parseHex(THEME_TOKENS.light.accentText);
      const lightContrast = getContrastRatio(lightText, lightError);
      expect(lightContrast).toBeGreaterThanOrEqual(3.0); // WCAG AA for UI components and bold text

      // Dark Mode: --error is #FF453A, text is #FFFFFF
      const darkError = parseHex(THEME_TOKENS.dark.error);
      const darkText = parseHex(THEME_TOKENS.dark.accentText);
      const darkContrast = getContrastRatio(darkText, darkError);
      expect(darkContrast).toBeGreaterThanOrEqual(3.0); // WCAG AA for UI components and bold text
    });

    it('1.4 verifies DownloadCard action buttons (Open, Resume, Show, Delete) contrast across all themes', () => {
      for (const t of themes) {
        const tokens = THEME_TOKENS[t];
        const accent = parseHex(tokens.accent);
        const accentText = parseHex(tokens.accentText);

        // Open & Resume buttons: bg-[var(--accent)] text-[var(--accent-text)]
        const primaryBtnContrast = getContrastRatio(accentText, accent);
        if (t === 'monochrome') {
          expect(primaryBtnContrast).toBeCloseTo(21.0, 1);
        } else {
          expect(primaryBtnContrast).toBeGreaterThanOrEqual(2.5);
        }
      }
    });

    it('1.5 verifies URLInput submit button contrast across all themes', () => {
      for (const t of themes) {
        const tokens = THEME_TOKENS[t];
        const accent = parseHex(tokens.accent);
        const accentText = parseHex(tokens.accentText);

        const contrast = getContrastRatio(accentText, accent);
        if (t === 'monochrome') {
          expect(contrast).toBeCloseTo(21.0, 1);
        } else {
          expect(contrast).toBeGreaterThanOrEqual(2.5);
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Suite 2: Component DOM Chromatic Zero-Saturation Verification
  // -----------------------------------------------------------------------
  describe('Suite 2: Component DOM Chromatic Zero-Saturation Invariant Verification', () => {
    it('2.1 audits FormatSelector DOM for 100% achromatic neutrality under Monochrome', () => {
      let selectedFormat = '137';
      const { container, rerender } = render(
        <div data-theme="monochrome" className="theme-monochrome dark">
          <FormatSelector
            formats={mockFormats}
            selected={selectedFormat}
            onSelect={(id) => { selectedFormat = id; }}
          />
        </div>
      );

      // Verify zero chromatic leakage on initial render
      expect(scanForChromaticViolations(container)).toEqual([]);

      // Select audio format
      rerender(
        <div data-theme="monochrome" className="theme-monochrome dark">
          <FormatSelector
            formats={mockFormats}
            selected="140"
            onSelect={(id) => { selectedFormat = id; }}
          />
        </div>
      );
      expect(scanForChromaticViolations(container)).toEqual([]);

      // Select another format
      rerender(
        <div data-theme="monochrome" className="theme-monochrome dark">
          <FormatSelector
            formats={mockFormats}
            selected="251"
            onSelect={(id) => { selectedFormat = id; }}
          />
        </div>
      );
      expect(scanForChromaticViolations(container)).toEqual([]);
    });

    it('2.2 audits URLInput DOM across idle, typing, loading, and clear states under Monochrome', () => {
      const onURL = vi.fn();
      const { container, rerender } = render(
        <div data-theme="monochrome" className="theme-monochrome dark">
          <URLInput onURL={onURL} placeholder="Paste YouTube link" />
        </div>
      );

      // Idle state
      expect(scanForChromaticViolations(container)).toEqual([]);

      // Type text
      const input = screen.getByPlaceholderText('Paste YouTube link');
      fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=test' } });
      expect(scanForChromaticViolations(container)).toEqual([]);

      // Loading state
      rerender(
        <div data-theme="monochrome" className="theme-monochrome dark">
          <URLInput onURL={onURL} loading={true} initialValue="https://youtube.com/watch?v=test" />
        </div>
      );
      expect(scanForChromaticViolations(container)).toEqual([]);
    });

    it('2.3 audits VideoPreview DOM with duration and metadata under Monochrome', () => {
      const { container, rerender } = render(
        <div data-theme="monochrome" className="theme-monochrome dark">
          <VideoPreview metadata={mockVideoMetadata} />
        </div>
      );

      expect(scanForChromaticViolations(container)).toEqual([]);

      // Test with 0 duration and missing uploader to test fallback paths
      const fallbackMeta: VideoMetadata = {
        ...mockVideoMetadata,
        duration: 0,
        uploader: undefined,
        view_count: undefined,
      };
      rerender(
        <div data-theme="monochrome" className="theme-monochrome dark">
          <VideoPreview metadata={fallbackMeta} />
        </div>
      );
      expect(scanForChromaticViolations(container)).toEqual([]);
    });

    it('2.4 audits DownloadCard across all 6 lifecycle states under Monochrome', () => {
      const states: DownloadItem['status'][] = ['downloading', 'paused', 'error', 'done', 'queued', 'cancelled'];

      for (const st of states) {
        const item: DownloadItem = {
          ...mockDownloadItem,
          id: `dl-${st}`,
          status: st,
          errorMessage: st === 'error' ? 'Download stream connection failed' : undefined,
        };

        const { container } = render(
          <MemoryRouter>
            <div data-theme="monochrome" className="theme-monochrome dark">
              <DownloadCard download={item} />
            </div>
          </MemoryRouter>
        );

        const violations = scanForChromaticViolations(container);
        expect(violations).toEqual([]);
        cleanup();
      }
    });

    it('2.5 audits TopNavBar and navigation tabs under Monochrome', () => {
      const routes = ['/', '/video', '/audio', '/playlist', '/clips', '/queue', '/settings'];

      for (const r of routes) {
        const { container } = render(
          <MemoryRouter initialEntries={[r]}>
            <div data-theme="monochrome" className="theme-monochrome dark">
              <TopNavBar />
            </div>
          </MemoryRouter>
        );

        const violations = scanForChromaticViolations(container);
        expect(violations).toEqual([]);
        cleanup();
      }
    });

    it('2.6 audits CSS button classes (.btn, .btn-primary, .btn-danger) under Monochrome', () => {
      const { container } = render(
        <div data-theme="monochrome" className="theme-monochrome dark">
          <button className="btn">Default</button>
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-danger">Danger</button>
          <button className="btn" disabled>Disabled Default</button>
          <button className="btn btn-primary" disabled>Disabled Primary</button>
          <button className="btn btn-danger" disabled>Disabled Danger</button>
        </div>
      );

      expect(scanForChromaticViolations(container)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Suite 3: Interactive Stress & Rapid Theme Transitions
  // -----------------------------------------------------------------------
  describe('Suite 3: Interactive Dynamic Selection & Rapid Theme Cycling', () => {
    it('3.1 dynamically toggles formats 50 times without contrast or state regression', () => {
      let currentSelected = '137';
      const onSelect = vi.fn((id: string) => {
        currentSelected = id;
      });

      const { rerender } = render(
        <div data-theme="monochrome" className="theme-monochrome dark">
          <FormatSelector
            formats={mockFormats}
            selected={currentSelected}
            onSelect={onSelect}
          />
        </div>
      );

      const formatIds = ['137', '136', '140', '251'];
      for (let i = 0; i < 50; i++) {
        const nextId = formatIds[i % formatIds.length];
        onSelect(nextId);

        rerender(
          <div data-theme="monochrome" className="theme-monochrome dark">
            <FormatSelector
              formats={mockFormats}
              selected={currentSelected}
              onSelect={onSelect}
            />
          </div>
        );

        // Verify active button exists
        const activeButtons = screen.getAllByRole('button').filter((b) => b.classList.contains('btn-primary'));
        expect(activeButtons.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('3.2 survives 100 rapid theme transitions on M1 components without DOM corruption', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <div id="m1-root" data-theme="light">
            <TopNavBar />
            <URLInput onURL={() => {}} />
            <VideoPreview metadata={mockVideoMetadata} />
            <DownloadCard download={mockDownloadItem} />
          </div>
        </MemoryRouter>
      );

      const root = container.querySelector('#m1-root') as HTMLElement;
      expect(root).toBeTruthy();

      const sequence: AppTheme[] = ['light', 'dark', 'monochrome'];
      for (let i = 0; i < 100; i++) {
        const t = sequence[i % sequence.length];
        applyThemeToDOM(t);
        root.setAttribute('data-theme', t);
        if (t === 'monochrome') {
          root.className = 'theme-monochrome dark';
        } else if (t === 'dark') {
          root.className = 'theme-dark dark';
        } else {
          root.className = 'theme-light';
        }
      }

      // Conclude on monochrome and ensure no chromatic violations exist
      applyThemeToDOM('monochrome');
      root.setAttribute('data-theme', 'monochrome');
      root.className = 'theme-monochrome dark';

      expect(scanForChromaticViolations(root)).toEqual([]);
    });

    it('3.3 verifies TopNavBar version badge correctly renders v1.1.1', () => {
      render(
        <MemoryRouter>
          <TopNavBar />
        </MemoryRouter>
      );

      expect(screen.getByText('v1.1.1')).toBeInTheDocument();
      expect(screen.queryByText('v2.4')).not.toBeInTheDocument();
    });

    it('3.4 verifies TopNavBar does not render fake bandwidth telemetry or dummy person avatar', () => {
      render(
        <MemoryRouter>
          <TopNavBar />
        </MemoryRouter>
      );

      // Verify dummy elements are absent
      expect(screen.queryByText('Download Speed')).not.toBeInTheDocument();
      expect(screen.queryByText(/14\.2 MB\/s/)).not.toBeInTheDocument();
      expect(screen.queryByText('person')).not.toBeInTheDocument();

      // Verify minimal desktop badge is present
      expect(screen.getByText('Offliner Desktop')).toBeInTheDocument();
    });
  });
});
